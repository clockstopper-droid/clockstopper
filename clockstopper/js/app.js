/* ==========================================================================
   app.js  —  Global Time Clock · Clockstopper
   All application logic: clocks, theme, mute, connectivity, dialer,
   caller-ID name, call-duration timer, keyboard input, and microphone
   permission pre-check.
   ========================================================================== */

'use strict';

/* --------------------------------------------------------------------------
   STATE
   -------------------------------------------------------------------------- */
let isMuted              = false;
let preferredNetwork     = 'wifi';        // 'wifi' | 'cellular'
let callerIdName         = '';
let dialedNumber         = '';
let isInCall             = false;
let callStartTime        = null;
let callDurationInterval = null;
let micPermissionStatus  = 'prompt';      // 'granted' | 'prompt' | 'denied'
let micPermissionObj     = null;          // PermissionStatus object (for change listener)

/* --------------------------------------------------------------------------
   FIXED TIME ZONES
   -------------------------------------------------------------------------- */
const TIME_ZONES = [
  { label: 'Eastern Time',  tz: 'America/New_York'    },
  { label: 'Central Time',  tz: 'America/Chicago'     },
  { label: 'Western Time',  tz: 'America/Los_Angeles' },
];

/* --------------------------------------------------------------------------
   CLOCK RENDERING
   -------------------------------------------------------------------------- */
function buildClockCards() {
  const grid = document.getElementById('clocksGrid');
  if (!grid) return;

  TIME_ZONES.forEach(({ label, tz }) => {
    const card = document.createElement('div');
    card.className = 'clock-card';
    card.innerHTML = `
      <div class="clock-label">${label}</div>
      <div class="clock-time" data-tz="${tz}">--:--:--</div>
      <div class="clock-date" data-tz-date="${tz}"></div>
    `;
    grid.appendChild(card);
  });
}

function tickClocks() {
  const now = new Date();

  document.querySelectorAll('.clock-time[data-tz]').forEach(el => {
    el.textContent = new Intl.DateTimeFormat('en-US', {
      timeZone : el.dataset.tz,
      hour     : '2-digit',
      minute   : '2-digit',
      second   : '2-digit',
      hour12   : true,
    }).format(now);
  });

  document.querySelectorAll('.clock-date[data-tz-date]').forEach(el => {
    el.textContent = new Intl.DateTimeFormat('en-US', {
      timeZone : el.dataset.tzDate,
      weekday  : 'short',
      month    : 'short',
      day      : 'numeric',
      year     : 'numeric',
    }).format(now);
  });
}

/* --------------------------------------------------------------------------
   THEME
   -------------------------------------------------------------------------- */
function toggleTheme() {
  document.body.classList.toggle('dark-theme');
}

/* --------------------------------------------------------------------------
   MUTE
   -------------------------------------------------------------------------- */
function toggleMute() {
  isMuted = !isMuted;
  const btn = document.getElementById('muteBtn');
  if (btn) {
    btn.textContent   = isMuted ? '🔇 Unmute' : '🔔 Mute';
    btn.setAttribute('aria-pressed', String(isMuted));
  }
}

/* --------------------------------------------------------------------------
   CONNECTIVITY PANEL
   -------------------------------------------------------------------------- */
function toggleConnectivityPanel() {
  const panel = document.getElementById('connectivityPanel');
  if (!panel) return;
  panel.classList.toggle('expanded');
  const btn = document.getElementById('connectivityToggleBtn');
  if (btn) {
    const isExpanded = panel.classList.contains('expanded');
    btn.setAttribute('aria-expanded', String(isExpanded));
    btn.textContent = isExpanded ? '📶 Network Status ▴' : '📶 Network Status ▾';
  }
}

function probeConnectivity() {
  const statusEl = document.getElementById('connectivityProbeStatus');
  if (!statusEl) return;

  if (!navigator.onLine) {
    statusEl.textContent = '⚠️ Offline — no network connection detected.';
    return;
  }

  statusEl.textContent = '🔄 Probing internet connectivity…';

  fetch('https://www.gstatic.com/generate_204', {
    method : 'HEAD',
    cache  : 'no-store',
    signal : AbortSignal.timeout(5000),
  })
    .then(r => {
      statusEl.textContent = r.ok || r.status === 204
        ? '✅ Internet reachable'
        : `⚠️ Probe returned HTTP ${r.status}`;
    })
    .catch(() => {
      statusEl.textContent = '⚠️ Internet probe failed — limited or no connectivity.';
    });
}

function refreshNetworkInfo() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const wifiStatus = document.getElementById('wifiStatus');

  if (!conn) {
    if (wifiStatus) wifiStatus.textContent = 'Network info: unavailable in this browser.';
    return;
  }

  const type          = conn.type          || 'unknown';
  const effectiveType = conn.effectiveType || 'unknown';
  const downlink      = conn.downlink      != null ? `${conn.downlink} Mbps` : 'unknown';

  if (wifiStatus) {
    wifiStatus.textContent = `Type: ${type} | Effective: ${effectiveType} | Downlink: ${downlink}`;
  }
}

function selectMobileNetwork() {
  preferredNetwork = 'cellular';
  const indicator = document.getElementById('networkTypeIndicator');
  if (indicator) indicator.textContent = 'Network: Mobile/Cellular';
  const option = document.getElementById('mobileNetworkOption');
  if (option) option.classList.add('selected');
}

/* --------------------------------------------------------------------------
   CALLER ID NAME
   -------------------------------------------------------------------------- */
function setCallerIdName() {
  const input   = document.getElementById('callerIdNameInput');
  const display = document.getElementById('callerIdNameDisplay');
  if (!input) return;

  callerIdName = input.value.trim();
  if (display) {
    display.textContent = callerIdName
      ? `Caller ID: "${callerIdName}"`
      : 'Caller ID: (not set — number will be shown)';
  }
}

/* --------------------------------------------------------------------------
   DIALER
   -------------------------------------------------------------------------- */
function updateDialerDisplay() {
  const display = document.getElementById('dialerDisplay');
  const readout = document.getElementById('dialedNumberReadout');
  if (display) display.textContent = dialedNumber || '';
  if (readout) readout.textContent = dialedNumber
    ? `Dialing: ${dialedNumber}`
    : 'Enter a number above';
}

function dialDigit(digit) {
  dialedNumber += String(digit);
  updateDialerDisplay();
}

function clearDialed() {
  if (dialedNumber.length > 0) {
    dialedNumber = dialedNumber.slice(0, -1);
  }
  updateDialerDisplay();
}

/* --------------------------------------------------------------------------
   CALL DURATION TIMER
   -------------------------------------------------------------------------- */
function formatDuration(totalSeconds) {
  const h  = Math.floor(totalSeconds / 3600);
  const m  = Math.floor((totalSeconds % 3600) / 60);
  const s  = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0
    ? `${String(h).padStart(2, '0')}:${mm}:${ss}`
    : `${mm}:${ss}`;
}

function startCallDurationTimer() {
  callStartTime = Date.now();
  callDurationInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
    const statusEl = document.getElementById('callStatus');
    if (statusEl) {
      statusEl.textContent = `📞 Call connected — ${formatDuration(elapsed)}`;
    }
  }, 1000);
}

function stopCallDurationTimer() {
  if (callDurationInterval) {
    clearInterval(callDurationInterval);
    callDurationInterval = null;
  }
  callStartTime = null;
}

/* --------------------------------------------------------------------------
   MICROPHONE PERMISSION PRE-CHECK
   -------------------------------------------------------------------------- */

/**
 * Reflects the current microphone permission state in the UI:
 *
 *  'granted' → green badge; call button enabled
 *  'prompt'  → amber badge (will ask at dial-time); call button enabled
 *  'denied'  → red badge with inline warning; call button gets .btn--disabled
 *
 * Also toggles aria-disabled on #callBtn so screen-readers and assistive
 * technology surface the disabled state correctly.
 */
function applyMicPermissionUI(state) {
  micPermissionStatus = state;

  const statusEl = document.getElementById('micPermissionStatus');
  const callBtn  = document.getElementById('callBtn');

  if (!statusEl) return;

  // Clear previous state classes
  statusEl.classList.remove(
    'mic-status--granted',
    'mic-status--prompt',
    'mic-status--denied'
  );

  switch (state) {
    case 'granted':
      statusEl.textContent = '🎤 Microphone: Granted';
      statusEl.classList.add('mic-status--granted');
      if (callBtn) {
        callBtn.classList.remove('btn--disabled');
        callBtn.setAttribute('aria-disabled', 'false');
      }
      break;

    case 'prompt':
      statusEl.textContent = '🎤 Microphone: Will ask when you dial';
      statusEl.classList.add('mic-status--prompt');
      if (callBtn) {
        callBtn.classList.remove('btn--disabled');
        callBtn.setAttribute('aria-disabled', 'false');
      }
      break;

    case 'denied':
      statusEl.textContent =
        '🚫 Microphone access denied — call audio unavailable. ' +
        'Enable microphone in your browser or device settings to place calls.';
      statusEl.classList.add('mic-status--denied');
      if (callBtn) {
        callBtn.classList.add('btn--disabled');
        callBtn.setAttribute('aria-disabled', 'true');
      }
      break;

    default:
      statusEl.textContent = '🎤 Microphone: Unknown';
      if (callBtn) {
        callBtn.classList.remove('btn--disabled');
        callBtn.setAttribute('aria-disabled', 'false');
      }
  }
}

/**
 * Queries navigator.permissions for the 'microphone' permission on page load
 * so the UI reflects the actual state before the user attempts to dial.
 *
 * Registers a `permissionchange` event handler on the returned PermissionStatus
 * object so mid-session updates (the user grants or revokes permission via
 * browser settings while the app is open) are reflected immediately without
 * requiring a page reload.
 *
 * Gracefully degrades: if the Permissions API is unavailable (older Android
 * WebView, Firefox with missing 'microphone' support) it falls back to
 * 'prompt' so the user can still attempt to dial.
 */
async function initMicPermissionCheck() {
  if (!navigator.permissions || typeof navigator.permissions.query !== 'function') {
    // Permissions API unavailable — assume prompt so users can still dial
    applyMicPermissionUI('prompt');
    return;
  }

  try {
    micPermissionObj = await navigator.permissions.query({ name: 'microphone' });
    applyMicPermissionUI(micPermissionObj.state);

    // Live update: fires when the user changes the permission mid-session
    micPermissionObj.addEventListener('change', () => {
      applyMicPermissionUI(micPermissionObj.state);
    });
  } catch (err) {
    // Some browsers throw for unrecognised permission names
    console.warn('[MicPermission] navigator.permissions.query failed:', err);
    applyMicPermissionUI('prompt');
  }
}

/* --------------------------------------------------------------------------
   OUTGOING CALL
   -------------------------------------------------------------------------- */
async function initiateCall() {
  if (!dialedNumber) return;

  // Guard: do not attempt the call if mic is definitively denied
  if (micPermissionStatus === 'denied') {
    const statusEl = document.getElementById('callStatus');
    if (statusEl) {
      statusEl.textContent =
        '🚫 Cannot place call — microphone permission is denied. ' +
        'Update your browser/device settings and try again.';
    }
    return;
  }

  const statusEl = document.getElementById('callStatus');
  if (statusEl) statusEl.textContent = '📡 Connecting…';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // If getUserMedia succeeded the permission is now 'granted'
    applyMicPermissionUI('granted');

    isInCall = true;
    startCallDurationTimer();

    if (statusEl) statusEl.textContent = '📞 Call connected — 00:00';

    // Store stream reference so endCall() can stop the tracks
    window._activeCallStream = stream;

    const indicator = document.getElementById('networkTypeIndicator');
    if (indicator) {
      indicator.textContent = preferredNetwork === 'cellular'
        ? 'Network: Mobile/Cellular'
        : 'Network: WiFi';
    }

    console.log(
      `[Call] Dialing: ${dialedNumber} | CallerID: "${callerIdName}" | Network: ${preferredNetwork}`
    );
  } catch (err) {
    isInCall = false;
    if (statusEl) {
      statusEl.textContent = err.name === 'NotAllowedError'
        ? '🚫 Microphone permission denied — cannot place call.'
        : `⚠️ Call failed: ${err.message}`;
    }
    // Reflect the newly-denied state (user clicked "Block" on the prompt)
    if (err.name === 'NotAllowedError') {
      applyMicPermissionUI('denied');
    }
  }
}

function endCall() {
  if (!isInCall && !dialedNumber) return;

  stopCallDurationTimer();
  isInCall = false;

  if (window._activeCallStream) {
    window._activeCallStream.getTracks().forEach(t => t.stop());
    window._activeCallStream = null;
  }

  const statusEl = document.getElementById('callStatus');
  if (statusEl) statusEl.textContent = '📵 Call ended.';

  dialedNumber = '';
  updateDialerDisplay();

  const indicator = document.getElementById('networkTypeIndicator');
  if (indicator) indicator.textContent = '';
}

/* --------------------------------------------------------------------------
   KEYBOARD INPUT
   -------------------------------------------------------------------------- */
function initKeyboardInput() {
  document.addEventListener('keydown', e => {
    // Pass through when a text field has focus (e.g. callerIdNameInput)
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    const key = e.key;

    if (/^[0-9]$/.test(key) || key === '*' || key === '#' || key === '+') {
      e.preventDefault();
      dialDigit(key);
    } else if (key === 'Backspace') {
      e.preventDefault();
      clearDialed();
    } else if (key === 'Enter') {
      e.preventDefault();
      initiateCall();
    } else if (key === 'Escape') {
      e.preventDefault();
      endCall();
    }
  });
}

/* --------------------------------------------------------------------------
   CONNECTIVITY EVENTS
   -------------------------------------------------------------------------- */
function initConnectivityEvents() {
  window.addEventListener('online', () => {
    const wifiStatus = document.getElementById('wifiStatus');
    if (wifiStatus) wifiStatus.textContent = '🟢 Back online';
    probeConnectivity();
    refreshNetworkInfo();
  });

  window.addEventListener('offline', () => {
    const wifiStatus = document.getElementById('wifiStatus');
    if (wifiStatus) wifiStatus.textContent = '🔴 Offline';
    const probeStatus = document.getElementById('connectivityProbeStatus');
    if (probeStatus) probeStatus.textContent = '⚠️ No network connection.';
  });

  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) {
    conn.addEventListener('change', refreshNetworkInfo);
  }
}

/* --------------------------------------------------------------------------
   BOOT
   -------------------------------------------------------------------------- */
function init() {
  buildClockCards();
  tickClocks();
  setInterval(tickClocks, 1000);

  refreshNetworkInfo();
  probeConnectivity();
  initConnectivityEvents();

  updateDialerDisplay();
  initKeyboardInput();

  // Microphone permission pre-check — async, non-blocking
  initMicPermissionCheck();
}

document.addEventListener('DOMContentLoaded', init);
