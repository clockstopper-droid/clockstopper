// ─── State ───────────────────────────────────────────────────────────────────
let isMuted         = false;
let isDarkTheme     = true;
let dialedNumber    = '';
let callerIdName    = '';
let callActive      = false;
let callStartTime   = null;
let callTimerInterval = null;
let networkChangeListener = null;
let micPermissionStatus = null;

// Long-press state for backspace button
let backspaceLongPressTimer = null;
const LONG_PRESS_THRESHOLD_MS = 600;

// ─── DOM References ───────────────────────────────────────────────────────────
const dialerDisplay       = document.getElementById('dialerDisplay');
const callStatus          = document.getElementById('callStatus');
const micPermissionEl     = document.getElementById('micPermissionStatus');
const networkTypeEl       = document.getElementById('networkTypeIndicator');
const callerIdNameDisplay = document.getElementById('callerIdNameDisplay');
const callerIdNameInput   = document.getElementById('callerIdNameInput');

// ─── Clock Logic ─────────────────────────────────────────────────────────────
const clocks = [
  { label: 'Eastern Time',  zone: 'America/New_York'    },
  { label: 'Central Time',  zone: 'America/Chicago'     },
  { label: 'Western Time',  zone: 'America/Los_Angeles' },
];

function buildClockCards() {
  const container = document.getElementById('clockContainer');
  if (!container) return;
  container.innerHTML = '';
  clocks.forEach(({ label, zone }) => {
    const card = document.createElement('div');
    card.className = 'clock-card';
    card.innerHTML = `
      <div class="clock-label">${label}</div>
      <div class="clock-time" id="clock-${zone}">--:--:--</div>
    `;
    container.appendChild(card);
  });
}

function updateClocks() {
  clocks.forEach(({ zone }) => {
    const el = document.getElementById(`clock-${zone}`);
    if (!el) return;
    el.textContent = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour:     '2-digit',
      minute:   '2-digit',
      second:   '2-digit',
      hour12:   true,
    }).format(new Date());
  });
}

// ─── Theme Toggle ─────────────────────────────────────────────────────────────
function toggleTheme() {
  isDarkTheme = !isDarkTheme;
  document.body.classList.toggle('light-theme', !isDarkTheme);
}

// ─── Mute Toggle ─────────────────────────────────────────────────────────────
function toggleMute() {
  isMuted = !isMuted;
  const btn = document.getElementById('muteBtn');
  if (btn) btn.textContent = isMuted ? 'Unmute' : 'Mute';
}

// ─── Connectivity ─────────────────────────────────────────────────────────────
function updateConnectivityStatus() {
  const el = document.getElementById('connectivityStatus');
  if (!el) return;
  el.textContent = navigator.onLine ? 'Online' : 'Offline';
  el.className   = navigator.onLine ? 'status-online' : 'status-offline';
}

function probeConnectivity() {
  fetch('https://www.google.com/favicon.ico', { method: 'HEAD', mode: 'no-cors', cache: 'no-store' })
    .then(() => { const el = document.getElementById('connectivityStatus'); if (el) { el.textContent = 'Connected'; el.className = 'status-online'; } })
    .catch(() => { const el = document.getElementById('connectivityStatus'); if (el) { el.textContent = 'No Connectivity'; el.className = 'status-offline'; } });
}

// ─── Network Type ─────────────────────────────────────────────────────────────
function getNetworkLabel() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return 'Unknown';
  const type = conn.type || '';
  const eff  = conn.effectiveType || '';
  if (type === 'wifi')     return 'WiFi';
  if (type === 'cellular') {
    if (eff === '4g') return '4G';
    if (eff === '3g') return '3G';
    if (eff === '2g') return '2G';
    return 'Cellular';
  }
  return 'Unknown';
}

function showNetworkBadge() {
  if (!networkTypeEl) return;
  networkTypeEl.textContent = getNetworkLabel();
  networkTypeEl.style.display = 'inline-block';
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) {
    networkChangeListener = () => { networkTypeEl.textContent = getNetworkLabel(); };
    conn.addEventListener('change', networkChangeListener);
  }
}

function hideNetworkBadge() {
  if (!networkTypeEl) return;
  networkTypeEl.style.display = 'none';
  networkTypeEl.textContent = '';
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn && networkChangeListener) {
    conn.removeEventListener('change', networkChangeListener);
    networkChangeListener = null;
  }
}

// ─── Microphone Permission Pre-Check ─────────────────────────────────────────
function setMicStatusUI(state) {
  if (!micPermissionEl) return;
  const messages = {
    granted: '🎙️ Microphone access granted.',
    prompt:  '⚠️ Microphone permission will be requested when you start a call.',
    denied:  '🚫 Microphone access denied. Enable it in device settings to make calls.',
    unknown: 'ℹ️ Microphone permission status unknown.',
  };
  const classes = {
    granted: 'mic-granted',
    prompt:  'mic-prompt',
    denied:  'mic-denied',
    unknown: 'mic-unknown',
  };
  micPermissionEl.textContent = messages[state] || messages.unknown;
  micPermissionEl.className   = `mic-status ${classes[state] || classes.unknown}`;
}

async function checkMicPermission() {
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const status = await navigator.permissions.query({ name: 'microphone' });
      setMicStatusUI(status.state);
      status.addEventListener('change', () => setMicStatusUI(status.state));
      return status.state;
    } catch (_) { /* fall through */ }
  }
  // Fallback: passive getUserMedia probe
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    setMicStatusUI('granted');
    return 'granted';
  } catch (e) {
    if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
      setMicStatusUI('denied');
      return 'denied';
    }
    setMicStatusUI('unknown');
    return 'unknown';
  }
}

// ─── Call Duration Timer ──────────────────────────────────────────────────────
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = n => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function startCallTimer() {
  callStartTime = Date.now();
  callTimerInterval = setInterval(() => {
    if (!callStatus) return;
    const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
    callStatus.textContent = `Call in progress: ${formatDuration(elapsed)}`;
  }, 1000);
}

function stopCallTimer() {
  if (callTimerInterval) {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
  }
  callStartTime = null;
}

// ─── Dialer ───────────────────────────────────────────────────────────────────
function dialDigit(digit) {
  dialedNumber += digit;
  updateDialerDisplay();
}

function updateDialerDisplay() {
  if (dialerDisplay) dialerDisplay.textContent = dialedNumber || '';
  const readout = document.getElementById('dialReadout');
  if (readout) readout.textContent = dialedNumber ? `Dialing: ${dialedNumber}` : '';
}

/**
 * clearDialed — removes the last digit (short tap) or clears the entire
 * dialed string (long press / clearAll = true).
 *
 * @param {boolean} [clearAll=false]  When true, wipes the full number and
 *                                     plays the shake animation on #dialerDisplay.
 */
function clearDialed(clearAll = false) {
  if (clearAll) {
    dialedNumber = '';
    updateDialerDisplay();
    triggerShake();
  } else {
    dialedNumber = dialedNumber.slice(0, -1);
    updateDialerDisplay();
  }
}

/** Applies the CSS shake animation to #dialerDisplay for visual feedback. */
function triggerShake() {
  if (!dialerDisplay) return;
  // Remove first in case it's still running from a previous clear
  dialerDisplay.classList.remove('shake');
  // Force reflow so re-adding the class restarts the animation
  void dialerDisplay.offsetWidth;
  dialerDisplay.classList.add('shake');
  dialerDisplay.addEventListener('animationend', () => {
    dialerDisplay.classList.remove('shake');
  }, { once: true });
}

// ─── Caller ID Name ───────────────────────────────────────────────────────────
function setCallerIdName() {
  if (!callerIdNameInput) return;
  callerIdName = callerIdNameInput.value.trim();
  if (callerIdNameDisplay) {
    callerIdNameDisplay.textContent = callerIdName
      ? `Caller ID: ${callerIdName}`
      : 'No caller ID name set.';
  }
}

// ─── Call Handling ────────────────────────────────────────────────────────────
async function initiateCall() {
  if (callActive) return;
  if (!dialedNumber) {
    if (callStatus) callStatus.textContent = 'Enter a number to call.';
    return;
  }

  // Mic guard
  const micState = await checkMicPermission();
  if (micState === 'denied') {
    if (callStatus) callStatus.textContent = 'Cannot start call — microphone access denied.';
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    callActive = true;
    if (callStatus) callStatus.textContent = `Calling ${dialedNumber}…`;
    showNetworkBadge();
    startCallTimer();
    // In a real VOIP integration the stream would be handed to a peer connection.
    window._activeStream = stream;
  } catch (e) {
    if (callStatus) callStatus.textContent = `Microphone error: ${e.message}`;
  }
}

function endCall() {
  if (!callActive) return;
  callActive = false;
  stopCallTimer();
  hideNetworkBadge();
  if (callStatus) callStatus.textContent = 'Call ended.';
  if (window._activeStream) {
    window._activeStream.getTracks().forEach(t => t.stop());
    window._activeStream = null;
  }
}

// ─── Keyboard Input ───────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key >= '0' && e.key <= '9') { dialDigit(e.key); return; }
  if (e.key === '*' || e.key === '#' || e.key === '+') { dialDigit(e.key); return; }
  if (e.key === 'Backspace') { e.preventDefault(); clearDialed(false); return; }
  if (e.key === 'Enter')     { initiateCall(); return; }
  if (e.key === 'Escape')    { endCall(); return; }
});

// ─── Backspace Button Long-Press Setup ───────────────────────────────────────
/**
 * Attaches long-press behaviour to the backspace/clear button.
 *
 * Short tap  (< 600 ms) → clearDialed(false)  — removes last digit
 * Long press (≥ 600 ms) → clearDialed(true)   — clears entire number
 *
 * Uses pointer events so it works with both touch and mouse on Android WebView.
 */
function setupBackspaceLongPress() {
  const btn = document.getElementById('backspaceBtn');
  if (!btn) return;

  // Remove any legacy onclick so we have full control here
  btn.removeAttribute('onclick');

  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault(); // prevent ghost mouse events on touch screens
    backspaceLongPressTimer = setTimeout(() => {
      backspaceLongPressTimer = null;
      clearDialed(true); // long press → clear all
    }, LONG_PRESS_THRESHOLD_MS);
  });

  function cancelOrCommitShortPress() {
    if (backspaceLongPressTimer !== null) {
      // Timer still pending → it was a short tap
      clearTimeout(backspaceLongPressTimer);
      backspaceLongPressTimer = null;
      clearDialed(false); // short tap → remove last digit
    }
    // If timer already fired (long press) we do nothing extra here
  }

  btn.addEventListener('pointerup',     cancelOrCommitShortPress);
  btn.addEventListener('pointerleave',  cancelOrCommitShortPress);
  btn.addEventListener('pointercancel', cancelOrCommitShortPress);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildClockCards();
  updateClocks();
  setInterval(updateClocks, 1000);

  updateConnectivityStatus();
  window.addEventListener('online',  updateConnectivityStatus);
  window.addEventListener('offline', updateConnectivityStatus);

  checkMicPermission();
  setupBackspaceLongPress();
  hideNetworkBadge();
  updateDialerDisplay();

  // Wire up caller ID name save button
  const saveBtn = document.getElementById('setCallerIdNameBtn');
  if (saveBtn) saveBtn.addEventListener('click', setCallerIdName);
});
