/* ==========================================================================
   app.js — Global Time Clock + Dialer
   Targets: Android WebView (clockstopper-droid) & standalone browser
   ========================================================================== */

'use strict';

// ---------------------------------------------------------------------------
// 1. TIME-ZONE CLOCK STATE
// ---------------------------------------------------------------------------
const ZONES = [
  { label: 'Eastern Time',  tz: 'America/New_York'    },
  { label: 'Central Time',  tz: 'America/Chicago'     },
  { label: 'Western Time',  tz: 'America/Los_Angeles' },
];

// ---------------------------------------------------------------------------
// 2. APP STATE
// ---------------------------------------------------------------------------
let isDarkTheme      = true;
let isMuted          = false;
let callerIdName     = '';
let dialedNumber     = '';
let callActive       = false;

// Call-duration timer state
let callStartTime    = null;   // Date.now() snapshot when call connected
let callTimerInterval = null;  // setInterval handle for MM:SS counter

// Network-type badge state (polling during active call)
let networkBadgeInterval = null; // setInterval handle for badge refresh

// Selected network preference ('wifi' | 'mobile' | null)
let selectedNetwork  = null;

// MediaStream handle for active mic stream
let activeMicStream  = null;

// ---------------------------------------------------------------------------
// 3. DOM REFS — populated after DOMContentLoaded
// ---------------------------------------------------------------------------
let clocksGrid            = null;
let connectivityPanel     = null;
let wifiStatus            = null;
let networkList           = null;
let mobileNetworkOption   = null;
let connectivityProbeStatus = null;
let callPanel             = null;
let callerIdNameInput     = null;
let setCallerIdNameBtn    = null;
let callerIdNameDisplay   = null;
let dialerDisplay         = null;
let dialedNumberReadout   = null;
let callStatus            = null;
let micPermissionStatus   = null;
let networkTypeIndicator  = null;
let themeToggleBtn        = null;
let muteBtn               = null;

// ---------------------------------------------------------------------------
// 4. CLOCK RENDERING
// ---------------------------------------------------------------------------
function buildClockCards() {
  if (!clocksGrid) return;
  clocksGrid.innerHTML = '';
  ZONES.forEach(zone => {
    const card = document.createElement('div');
    card.className = 'clock-card';
    card.dataset.tz = zone.tz;

    const label = document.createElement('div');
    label.className = 'clock-label';
    label.textContent = zone.label;

    const time = document.createElement('div');
    time.className = 'clock-time';
    time.textContent = '--:--:--';

    card.appendChild(label);
    card.appendChild(time);
    clocksGrid.appendChild(card);
  });
}

function tickClocks() {
  if (!clocksGrid) return;
  const cards = clocksGrid.querySelectorAll('.clock-card');
  cards.forEach(card => {
    const tz = card.dataset.tz;
    const timeEl = card.querySelector('.clock-time');
    if (!timeEl) return;
    try {
      const formatted = new Intl.DateTimeFormat('en-US', {
        timeZone : tz,
        hour     : '2-digit',
        minute   : '2-digit',
        second   : '2-digit',
        hour12   : true,
      }).format(new Date());
      timeEl.textContent = formatted;
    } catch (e) {
      timeEl.textContent = 'ERR';
    }
  });
}

// ---------------------------------------------------------------------------
// 5. THEME TOGGLE
// ---------------------------------------------------------------------------
function applyTheme() {
  document.body.classList.toggle('light-theme', !isDarkTheme);
}

function toggleTheme() {
  isDarkTheme = !isDarkTheme;
  applyTheme();
  if (themeToggleBtn) {
    themeToggleBtn.textContent = isDarkTheme ? '☀️ Light Mode' : '🌙 Dark Mode';
  }
}

// ---------------------------------------------------------------------------
// 6. MUTE TOGGLE
// ---------------------------------------------------------------------------
function toggleMute() {
  isMuted = !isMuted;
  if (muteBtn) {
    muteBtn.textContent = isMuted ? '🔇 Unmute' : '🔔 Mute';
    muteBtn.classList.toggle('muted', isMuted);
  }
}

// ---------------------------------------------------------------------------
// 7. CONNECTIVITY DETECTION
// ---------------------------------------------------------------------------
function updateOnlineStatus() {
  if (!wifiStatus) return;
  const online = navigator.onLine;
  wifiStatus.textContent = online ? '🟢 Online' : '🔴 Offline';
  wifiStatus.className   = 'wifi-status ' + (online ? 'online' : 'offline');
}

async function probeConnectivity() {
  if (!connectivityProbeStatus) return;
  connectivityProbeStatus.textContent = 'Probing…';
  try {
    const res = await fetch('https://www.google.com/generate_204', {
      method: 'HEAD', mode: 'no-cors', cache: 'no-store',
    });
    connectivityProbeStatus.textContent = '✅ Internet reachable';
  } catch {
    connectivityProbeStatus.textContent = '❌ Internet unreachable';
  }
}

// ---------------------------------------------------------------------------
// 8. NETWORK INFORMATION & MOBILE NETWORK
// ---------------------------------------------------------------------------

/**
 * Returns an object describing the current network connection.
 * @returns {{ type: string, effectiveType: string }}
 */
function getNetworkInfo() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return { type: 'unknown', effectiveType: 'unknown' };
  return {
    type         : conn.type          || 'unknown',
    effectiveType: conn.effectiveType || 'unknown',
  };
}

function updateNetworkInfo() {
  if (!mobileNetworkOption) return;
  const { type, effectiveType } = getNetworkInfo();
  const isCellular = type === 'cellular';
  mobileNetworkOption.classList.toggle('available', isCellular);
  mobileNetworkOption.querySelector?.('.network-type-label') &&
    (mobileNetworkOption.querySelector('.network-type-label').textContent =
      isCellular ? `Mobile (${effectiveType.toUpperCase()})` : 'Mobile (unavailable)');
}

function selectNetwork(preference) {
  selectedNetwork = preference;
  document.querySelectorAll('.network-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.network === preference);
  });
}

// ---------------------------------------------------------------------------
// 9. NETWORK-TYPE BADGE  (shown on #networkTypeIndicator during active call)
// ---------------------------------------------------------------------------

/**
 * Badge modifier classes that map network identifiers to CSS classes.
 * Keys are lowercase strings matching effectiveType / type values.
 */
const BADGE_CLASS_MAP = {
  'wifi'    : 'badge--wifi',
  'ethernet': 'badge--wifi',   // treat wired as wifi-tier visually
  '4g'      : 'badge--4g',
  '3g'      : 'badge--3g',
  '2g'      : 'badge--2g',
  'slow-2g' : 'badge--2g',
  'cellular': 'badge--4g',     // generic cellular → 4g tier until effectiveType known
  'unknown' : 'badge--unknown',
};

/** All modifier classes used by the badge — used for clean class-swap. */
const ALL_BADGE_CLASSES = [
  'badge--wifi',
  'badge--4g',
  'badge--3g',
  'badge--2g',
  'badge--unknown',
];

/**
 * Resolve the best human-readable label and CSS modifier class for the
 * current network conditions.
 * @returns {{ label: string, modifierClass: string }}
 */
function resolveNetworkBadge() {
  const { type, effectiveType } = getNetworkInfo();

  // WiFi / ethernet take priority
  if (type === 'wifi' || type === 'ethernet') {
    return { label: 'WiFi', modifierClass: 'badge--wifi' };
  }

  // Cellular — use effectiveType for finer granularity
  if (type === 'cellular') {
    switch (effectiveType) {
      case '4g':      return { label: '4G',   modifierClass: 'badge--4g'  };
      case '3g':      return { label: '3G',   modifierClass: 'badge--3g'  };
      case '2g':
      case 'slow-2g': return { label: '2G',   modifierClass: 'badge--2g'  };
      default:        return { label: '4G',   modifierClass: 'badge--4g'  }; // cellular, type unknown → optimistic
    }
  }

  // Non-cellular — fall through to effectiveType alone (e.g. when type is absent)
  const badgeClass = BADGE_CLASS_MAP[effectiveType] || 'badge--unknown';
  switch (effectiveType) {
    case '4g':      return { label: '4G',      modifierClass: badgeClass };
    case '3g':      return { label: '3G',      modifierClass: badgeClass };
    case '2g':
    case 'slow-2g': return { label: '2G',      modifierClass: badgeClass };
    case 'wifi':    return { label: 'WiFi',    modifierClass: 'badge--wifi' };
    default:        return { label: 'Unknown', modifierClass: 'badge--unknown' };
  }
}

/**
 * Refresh the #networkTypeIndicator badge text and CSS modifier class to
 * reflect the live network type.  Called immediately on call connect and
 * every 5 seconds while the call is active.
 */
function refreshNetworkBadge() {
  if (!networkTypeIndicator) return;

  const { label, modifierClass } = resolveNetworkBadge();

  // Swap modifier class — remove all known badge classes first, then add the current one
  ALL_BADGE_CLASSES.forEach(cls => networkTypeIndicator.classList.remove(cls));
  networkTypeIndicator.classList.add('network-type-badge', modifierClass);
  networkTypeIndicator.textContent = label;
  networkTypeIndicator.style.display = 'inline-block';
}

/**
 * Start the 5-second polling interval that keeps the badge current.
 * Safe to call multiple times — clears any existing interval first.
 */
function startNetworkBadgePolling() {
  stopNetworkBadgePolling(); // ensure no duplicate interval
  refreshNetworkBadge();     // immediate first render
  networkBadgeInterval = setInterval(refreshNetworkBadge, 5000);
}

/**
 * Stop the badge polling interval and hide/reset the badge element.
 */
function stopNetworkBadgePolling() {
  if (networkBadgeInterval !== null) {
    clearInterval(networkBadgeInterval);
    networkBadgeInterval = null;
  }
  if (networkTypeIndicator) {
    ALL_BADGE_CLASSES.forEach(cls => networkTypeIndicator.classList.remove(cls));
    networkTypeIndicator.classList.remove('network-type-badge');
    networkTypeIndicator.textContent = '';
    networkTypeIndicator.style.display = 'none';
  }
}

// ---------------------------------------------------------------------------
// 10. MICROPHONE PERMISSION PRE-CHECK
// ---------------------------------------------------------------------------
function setMicStatusUI(state, message) {
  if (!micPermissionStatus) return;
  micPermissionStatus.textContent = message;
  micPermissionStatus.className = 'mic-permission-status mic-' + state; // mic-granted | mic-prompt | mic-denied
}

async function checkMicPermission() {
  if (!navigator.permissions) {
    // Fallback: try a silent getUserMedia probe
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setMicStatusUI('granted', '🎤 Microphone access granted.');
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicStatusUI('denied', '🚫 Microphone access denied. Enable it in device settings.');
      } else {
        setMicStatusUI('prompt', '🎤 Microphone status unknown — you will be prompted when dialing.');
      }
    }
    return;
  }

  try {
    const permStatus = await navigator.permissions.query({ name: 'microphone' });
    applyMicPermissionState(permStatus.state);

    permStatus.onchange = () => applyMicPermissionState(permStatus.state);
  } catch (e) {
    setMicStatusUI('prompt', '🎤 Microphone permission check unavailable.');
  }
}

function applyMicPermissionState(state) {
  switch (state) {
    case 'granted':
      setMicStatusUI('granted', '🎤 Microphone access granted.');
      break;
    case 'denied':
      setMicStatusUI('denied', '🚫 Microphone access denied. Enable it in device settings.');
      break;
    case 'prompt':
    default:
      setMicStatusUI('prompt', '🎤 Microphone permission not yet granted — you will be prompted when dialing.');
      break;
  }
}

// ---------------------------------------------------------------------------
// 11. CALLER ID NAME
// ---------------------------------------------------------------------------
function saveCallerIdName() {
  if (!callerIdNameInput) return;
  callerIdName = callerIdNameInput.value.trim();
  if (callerIdNameDisplay) {
    callerIdNameDisplay.textContent = callerIdName
      ? `Caller ID: "${callerIdName}"`
      : 'No caller ID name set.';
  }
}

// ---------------------------------------------------------------------------
// 12. DIALER
// ---------------------------------------------------------------------------
function dialDigit(digit) {
  dialedNumber += digit;
  refreshDialerDisplay();
}

function clearDialed() {
  if (dialedNumber.length > 0) {
    dialedNumber = dialedNumber.slice(0, -1);
    refreshDialerDisplay();
  }
}

function clearAllDialed() {
  dialedNumber = '';
  refreshDialerDisplay();
}

function refreshDialerDisplay() {
  if (dialerDisplay)       dialerDisplay.textContent       = dialedNumber || '';
  if (dialedNumberReadout) dialedNumberReadout.textContent = dialedNumber
    ? `Dialing: ${dialedNumber}`
    : '';
}

// ---------------------------------------------------------------------------
// 13. CALL DURATION TIMER
// ---------------------------------------------------------------------------
function formatCallDuration(elapsedSeconds) {
  const h = Math.floor(elapsedSeconds / 3600);
  const m = Math.floor((elapsedSeconds % 3600) / 60);
  const s = elapsedSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

function startCallTimer() {
  stopCallTimer(); // clear any stale interval
  callStartTime = Date.now();
  callTimerInterval = setInterval(() => {
    if (!callStatus) return;
    const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
    callStatus.textContent = `📞 Call in progress — ${formatCallDuration(elapsed)}`;
  }, 1000);
}

function stopCallTimer() {
  if (callTimerInterval !== null) {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
  }
  callStartTime = null;
}

// ---------------------------------------------------------------------------
// 14. CALL MANAGEMENT
// ---------------------------------------------------------------------------
async function initiateCall() {
  if (callActive) return;
  if (!dialedNumber) {
    if (callStatus) callStatus.textContent = '⚠️ Enter a number to dial.';
    return;
  }

  // Check mic permission state before proceeding
  if (navigator.permissions) {
    try {
      const permStatus = await navigator.permissions.query({ name: 'microphone' });
      if (permStatus.state === 'denied') {
        if (callStatus) callStatus.textContent = '🚫 Microphone access denied. Cannot place call.';
        setMicStatusUI('denied', '🚫 Microphone access denied. Enable it in device settings.');
        return;
      }
    } catch (_) { /* ignore — proceed and let getUserMedia surface the error */ }
  }

  // Request microphone
  try {
    activeMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    if (callStatus) callStatus.textContent = '🚫 Microphone unavailable: ' + err.message;
    setMicStatusUI('denied', '🚫 Microphone access denied. Enable it in device settings.');
    return;
  }

  callActive = true;
  if (callStatus) callStatus.textContent = '📞 Call in progress — 00:00';

  // Start elapsed-time counter
  startCallTimer();

  // Start network-type badge polling every 5 seconds
  startNetworkBadgePolling();

  // Log call metadata (caller ID name, selected network)
  console.info('[call] Initiated', {
    to             : dialedNumber,
    callerIdName   : callerIdName || '(default)',
    network        : selectedNetwork || 'auto',
  });
}

function endCall() {
  if (!callActive && !dialedNumber) return;

  if (callActive) {
    // Stop call-duration timer
    stopCallTimer();

    // Stop network-type badge polling and reset badge
    stopNetworkBadgePolling();

    // Release microphone stream
    if (activeMicStream) {
      activeMicStream.getTracks().forEach(t => t.stop());
      activeMicStream = null;
    }

    callActive = false;
    if (callStatus) callStatus.textContent = '📵 Call ended.';
  }

  clearAllDialed();
}

// ---------------------------------------------------------------------------
// 15. KEYBOARD INPUT
// ---------------------------------------------------------------------------
function handleKeyDown(e) {
  // Do not intercept keyboard events when a text input / textarea is focused
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  const key = e.key;

  if (/^[0-9]$/.test(key) || key === '*' || key === '#' || key === '+') {
    e.preventDefault();
    dialDigit(key);
    return;
  }

  switch (key) {
    case 'Backspace':
      e.preventDefault();
      clearDialed();
      break;
    case 'Enter':
      e.preventDefault();
      initiateCall();
      break;
    case 'Escape':
      e.preventDefault();
      endCall();
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// 16. INIT
// ---------------------------------------------------------------------------
function init() {
  // Resolve DOM references
  clocksGrid              = document.getElementById('clocksGrid');
  connectivityPanel       = document.getElementById('connectivityPanel');
  wifiStatus              = document.getElementById('wifiStatus');
  networkList             = document.getElementById('networkList');
  mobileNetworkOption     = document.getElementById('mobileNetworkOption');
  connectivityProbeStatus = document.getElementById('connectivityProbeStatus');
  callPanel               = document.getElementById('callPanel');
  callerIdNameInput       = document.getElementById('callerIdNameInput');
  setCallerIdNameBtn      = document.getElementById('setCallerIdNameBtn');
  callerIdNameDisplay     = document.getElementById('callerIdNameDisplay');
  dialerDisplay           = document.getElementById('dialerDisplay');
  dialedNumberReadout     = document.getElementById('dialedNumberReadout');
  callStatus              = document.getElementById('callStatus');
  micPermissionStatus     = document.getElementById('micPermissionStatus');
  networkTypeIndicator    = document.getElementById('networkTypeIndicator');
  themeToggleBtn          = document.getElementById('themeToggleBtn');
  muteBtn                 = document.getElementById('muteBtn');

  // Ensure badge starts hidden
  if (networkTypeIndicator) {
    networkTypeIndicator.style.display = 'none';
    networkTypeIndicator.textContent   = '';
  }

  // Build clock cards and start ticking
  buildClockCards();
  tickClocks();
  setInterval(tickClocks, 1000);

  // Initial theme
  applyTheme();

  // Connectivity
  updateOnlineStatus();
  window.addEventListener('online',  updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  probeConnectivity();

  // Network info
  updateNetworkInfo();

  // Mic permission pre-check
  checkMicPermission();

  // Wire up network option buttons
  document.querySelectorAll('.network-option').forEach(btn => {
    btn.addEventListener('click', () => selectNetwork(btn.dataset.network));
  });

  // Wire up caller ID name controls
  if (setCallerIdNameBtn) setCallerIdNameBtn.addEventListener('click', saveCallerIdName);
  if (callerIdNameInput) {
    callerIdNameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); saveCallerIdName(); }
    });
  }

  // Wire up theme / mute buttons
  if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
  if (muteBtn)        muteBtn.addEventListener('click', toggleMute);

  // Wire up keypad digit buttons
  document.querySelectorAll('[data-digit]').forEach(btn => {
    btn.addEventListener('click', () => dialDigit(btn.dataset.digit));
  });

  // Wire up call action buttons
  const dialBtn = document.getElementById('dialBtn');
  const endBtn  = document.getElementById('endCallBtn');
  if (dialBtn) dialBtn.addEventListener('click', initiateCall);
  if (endBtn)  endBtn.addEventListener('click',  endCall);

  // Backspace button
  const backspaceBtn = document.getElementById('backspaceBtn');
  if (backspaceBtn) backspaceBtn.addEventListener('click', clearDialed);

  // Keyboard input
  document.addEventListener('keydown', handleKeyDown);
}

document.addEventListener('DOMContentLoaded', init);
