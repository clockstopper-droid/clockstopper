/* ==========================================================================
   app.js — Global Time Clock + Dialer
   All application logic: clocks, theme, mute, connectivity, dialer, caller ID,
   call audio, mic permission pre-check, call duration timer, network type badge,
   keyboard input, backspace long-press clear.
   ========================================================================== */

'use strict';

/* --------------------------------------------------------------------------
   Constants
   -------------------------------------------------------------------------- */
const LONG_PRESS_THRESHOLD_MS = 700;   // ms hold before backspace clears all

// Connectivity probe backoff settings
const PROBE_INITIAL_DELAY_MS  = 2000;  // first retry after 2 s
const PROBE_BACKOFF_FACTOR    = 2;     // double each retry
const PROBE_MAX_DELAY_MS      = 30000; // cap at 30 s
const PROBE_URL               = 'https://www.gstatic.com/generate_204'; // 204 No Content

/* --------------------------------------------------------------------------
   State
   -------------------------------------------------------------------------- */
let isMuted        = false;
let dialedNumber   = '';
let callerIdName   = '';
let callActive     = false;
let callStartTime  = null;
let callTimerInterval = null;
let networkChangeListener = null;

// Probe retry state
let probeRetryTimeout   = null;   // handle from setTimeout
let probeRetryDelay     = PROBE_INITIAL_DELAY_MS;
let lastProbeSuccess    = null;   // Date | null
let lastProbeFailure    = null;   // Date | null

/* --------------------------------------------------------------------------
   Utility — format a Date as a locale time string (h:mm:ss AM/PM)
   -------------------------------------------------------------------------- */
function formatProbeTime(date) {
  if (!date) return 'Never';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

/* --------------------------------------------------------------------------
   Clock — three fixed time zones
   -------------------------------------------------------------------------- */
const TIMEZONES = [
  { label: 'Eastern Time',  zone: 'America/New_York'    },
  { label: 'Central Time',  zone: 'America/Chicago'     },
  { label: 'Western Time',  zone: 'America/Los_Angeles' },
];

function renderClocks() {
  const container = document.getElementById('clockContainer');
  if (!container) return;
  container.innerHTML = '';
  const now = new Date();
  TIMEZONES.forEach(({ label, zone }) => {
    const timeStr = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour:     'numeric',
      minute:   '2-digit',
      second:   '2-digit',
      hour12:   true,
    }).format(now);
    const dateStr = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      weekday: 'short',
      month:   'short',
      day:     'numeric',
    }).format(now);
    const card = document.createElement('div');
    card.className = 'clock-card';
    card.innerHTML = `
      <div class="clock-label">${label}</div>
      <div class="clock-time">${timeStr}</div>
      <div class="clock-date">${dateStr}</div>`;
    container.appendChild(card);
  });
}

/* --------------------------------------------------------------------------
   Theme toggle
   -------------------------------------------------------------------------- */
function initThemeToggle() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    document.body.classList.toggle('dark');
  });
}

/* --------------------------------------------------------------------------
   Mute toggle
   -------------------------------------------------------------------------- */
function initMuteToggle() {
  const btn = document.getElementById('muteToggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    isMuted = !isMuted;
    btn.textContent = isMuted ? '🔇 Unmute' : '🔔 Mute';
    btn.setAttribute('aria-pressed', String(isMuted));
  });
}

/* --------------------------------------------------------------------------
   Connectivity UI update
   Reflects navigator.onLine state + probe timestamps in #connectivityProbeStatus
   -------------------------------------------------------------------------- */
function updateConnectivityUI(probeResult) {
  const onlineIndicator = document.getElementById('onlineStatus');
  const probeStatusEl   = document.getElementById('connectivityProbeStatus');

  const isOnline = navigator.onLine;

  // Online / offline indicator
  if (onlineIndicator) {
    onlineIndicator.textContent = isOnline ? '✅ Online' : '❌ Offline';
    onlineIndicator.className   = isOnline ? 'status-online' : 'status-offline';
  }

  // Probe status + timestamps
  if (probeStatusEl) {
    let probeLabel = '';
    if (probeResult === true) {
      probeLabel = '✅ Probe OK';
    } else if (probeResult === false) {
      probeLabel = '⚠️ Probe failed';
    } else {
      // Called without a new result — keep existing probe label visible
      const existing = probeStatusEl.querySelector('.probe-result-label');
      probeLabel = existing ? existing.textContent : '— Probe pending';
    }

    const successLine = lastProbeSuccess
      ? `<span class="probe-timestamp probe-success">Last verified: ${formatProbeTime(lastProbeSuccess)}</span>`
      : `<span class="probe-timestamp probe-never">Last verified: Never</span>`;

    const failureLine = lastProbeFailure
      ? `<span class="probe-timestamp probe-failure">Last failed: ${formatProbeTime(lastProbeFailure)}</span>`
      : '';

    probeStatusEl.innerHTML =
      `<span class="probe-result-label">${probeLabel}</span>` +
      successLine +
      failureLine;
  }
}

/* --------------------------------------------------------------------------
   Connectivity probe with exponential backoff retry
   -------------------------------------------------------------------------- */

/**
 * Cancel any pending retry timeout (called before scheduling a new one, or
 * when a probe succeeds and no retry is needed).
 */
function cancelProbeRetry() {
  if (probeRetryTimeout !== null) {
    clearTimeout(probeRetryTimeout);
    probeRetryTimeout = null;
  }
}

/**
 * Schedule a retry after the current backoff delay, then double the delay
 * (up to PROBE_MAX_DELAY_MS) for the next failure.
 */
function scheduleProbeRetry() {
  cancelProbeRetry();
  const delay = probeRetryDelay;
  probeRetryTimeout = setTimeout(() => {
    probeRetryTimeout = null;
    probeConnectivity();
  }, delay);
  // Advance the delay for the next potential failure (capped)
  probeRetryDelay = Math.min(probeRetryDelay * PROBE_BACKOFF_FACTOR, PROBE_MAX_DELAY_MS);
}

/**
 * Fetch-based connectivity probe.
 *
 * On success:
 *   - Records lastProbeSuccess timestamp
 *   - Resets backoff delay to initial value
 *   - Cancels any pending retry
 *   - Updates UI with probe-ok state
 *
 * On failure:
 *   - Records lastProbeFailure timestamp
 *   - Schedules a retry with exponential backoff (2 s → 4 s → 8 s … ≤ 30 s)
 *   - Updates UI with probe-failed state
 */
async function probeConnectivity() {
  try {
    const response = await fetch(PROBE_URL, {
      method:  'HEAD',
      cache:   'no-store',
      mode:    'no-cors',   // gstatic 204 endpoint — no-cors is fine
    });
    // Treat any response (including opaque) as success when mode is no-cors
    lastProbeSuccess = new Date();
    probeRetryDelay  = PROBE_INITIAL_DELAY_MS;  // reset backoff
    cancelProbeRetry();
    updateConnectivityUI(true);
  } catch {
    lastProbeFailure = new Date();
    updateConnectivityUI(false);
    scheduleProbeRetry();
  }
}

/* --------------------------------------------------------------------------
   Connectivity panel — init
   -------------------------------------------------------------------------- */
function initConnectivity() {
  // Reflect immediate navigator.onLine state (no new probe result yet)
  updateConnectivityUI(null);

  // Browser online / offline events
  window.addEventListener('online',  () => {
    updateConnectivityUI(null);
    // When we come back online reset backoff and probe immediately
    probeRetryDelay = PROBE_INITIAL_DELAY_MS;
    probeConnectivity();
  });
  window.addEventListener('offline', () => {
    cancelProbeRetry();
    lastProbeFailure = new Date();
    updateConnectivityUI(false);
    // Re-arm backoff so retries resume when navigator.onLine flips back
    scheduleProbeRetry();
  });

  // Initial probe on load
  probeConnectivity();

  // Network-change listener (NetworkInformation API)
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) {
    conn.addEventListener('change', () => {
      updateNetworkInfoUI();
      // Re-probe whenever the network interface changes
      probeRetryDelay = PROBE_INITIAL_DELAY_MS;
      probeConnectivity();
    });
  }

  updateNetworkInfoUI();
}

/* --------------------------------------------------------------------------
   Network Information UI (WiFi / cellular type display)
   -------------------------------------------------------------------------- */
function getNetworkLabel() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return 'Unknown';
  if (conn.type === 'wifi') return 'WiFi';
  if (conn.type === 'cellular') {
    const et = conn.effectiveType;
    if (et === '4g') return '4G';
    if (et === '3g') return '3G';
    if (et === '2g') return '2G';
    return 'Cellular';
  }
  return conn.effectiveType ? conn.effectiveType.toUpperCase() : 'Unknown';
}

function updateNetworkInfoUI() {
  const el = document.getElementById('networkInfo');
  if (!el) return;
  el.textContent = `Network: ${getNetworkLabel()}`;
}

/* --------------------------------------------------------------------------
   Mic permission pre-check
   -------------------------------------------------------------------------- */
function updateMicPermissionUI(state) {
  const el = document.getElementById('micPermissionStatus');
  if (!el) return;
  switch (state) {
    case 'granted':
      el.textContent = '🎤 Microphone: Granted';
      el.className = 'mic-granted';
      break;
    case 'denied':
      el.textContent = '🚫 Microphone: Denied — enable in device settings';
      el.className = 'mic-denied';
      break;
    case 'prompt':
      el.textContent = '⚠️ Microphone: Permission required — you will be prompted when calling';
      el.className = 'mic-prompt';
      break;
    default:
      el.textContent = '❓ Microphone: Status unknown';
      el.className = 'mic-unknown';
  }
}

async function checkMicPermission() {
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' });
      updateMicPermissionUI(result.state);
      result.addEventListener('change', () => updateMicPermissionUI(result.state));
      return;
    } catch {
      // Fall through to getUserMedia probe
    }
  }
  // Fallback: passive getUserMedia probe
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    updateMicPermissionUI('granted');
  } catch (err) {
    updateMicPermissionUI(err.name === 'NotAllowedError' ? 'denied' : 'prompt');
  }
}

/* --------------------------------------------------------------------------
   Dialer — digit input
   -------------------------------------------------------------------------- */
function dialDigit(digit) {
  dialedNumber += digit;
  updateDialerDisplay();
}

function clearLastDigit() {
  dialedNumber = dialedNumber.slice(0, -1);
  updateDialerDisplay();
}

function clearDialed() {
  dialedNumber = '';
  updateDialerDisplay();
}

function updateDialerDisplay() {
  const display    = document.getElementById('numberDisplay');
  const liveReadout = document.getElementById('dialedNumberReadout');
  if (display)     display.textContent    = dialedNumber || '';
  if (liveReadout) liveReadout.textContent = dialedNumber
    ? `Dialing: ${dialedNumber}`
    : '';
}

/* --------------------------------------------------------------------------
   Caller ID name
   -------------------------------------------------------------------------- */
function initCallerIdName() {
  const input  = document.getElementById('callerIdNameInput');
  const saveBtn = document.getElementById('saveCallerIdName');
  const display = document.getElementById('callerIdNameDisplay');
  if (!input || !saveBtn) return;

  saveBtn.addEventListener('click', () => {
    callerIdName = input.value.trim();
    if (display) display.textContent = callerIdName
      ? `Caller ID: "${callerIdName}"`
      : '';
  });
}

/* --------------------------------------------------------------------------
   Network type badge (shown during active call)
   -------------------------------------------------------------------------- */
function showNetworkBadge() {
  const badge = document.getElementById('networkTypeIndicator');
  if (!badge) return;
  const label = getNetworkLabel();
  badge.textContent = label;
  badge.className   = 'network-badge network-badge--' + label.toLowerCase().replace(/\s+/g, '-');
  badge.style.display = 'inline-block';

  // Update dynamically if network changes during the call
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) {
    networkChangeListener = () => {
      const newLabel = getNetworkLabel();
      badge.textContent = newLabel;
      badge.className   = 'network-badge network-badge--' + newLabel.toLowerCase().replace(/\s+/g, '-');
    };
    conn.addEventListener('change', networkChangeListener);
  }
}

function hideNetworkBadge() {
  const badge = document.getElementById('networkTypeIndicator');
  if (badge) badge.style.display = 'none';

  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn && networkChangeListener) {
    conn.removeEventListener('change', networkChangeListener);
    networkChangeListener = null;
  }
}

/* --------------------------------------------------------------------------
   Call duration timer
   -------------------------------------------------------------------------- */
function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function startCallTimer() {
  callStartTime = Date.now();
  const statusEl = document.getElementById('callStatus');
  callTimerInterval = setInterval(() => {
    if (!statusEl) return;
    const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
    statusEl.textContent = `In call — ${formatElapsed(elapsed)}`;
  }, 1000);
}

function stopCallTimer() {
  if (callTimerInterval) {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
  }
  callStartTime = null;
}

/* --------------------------------------------------------------------------
   Call audio — outgoing call
   -------------------------------------------------------------------------- */
async function initiateCall() {
  if (callActive || !dialedNumber) return;
  const statusEl = document.getElementById('callStatus');

  try {
    await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    if (statusEl) statusEl.textContent = 'Microphone access denied — cannot place call.';
    return;
  }

  callActive = true;
  if (statusEl) statusEl.textContent = 'Connecting…';

  // Simulate call connect after short delay
  setTimeout(() => {
    if (!callActive) return;
    if (statusEl) statusEl.textContent = 'In call — 00:00';
    startCallTimer();
    showNetworkBadge();
    const endBtn = document.getElementById('endCallBtn');
    if (endBtn) endBtn.style.display = 'inline-block';
    const callBtn = document.getElementById('callBtn');
    if (callBtn) callBtn.disabled = true;
  }, 800);
}

function endCall() {
  if (!callActive) return;
  callActive = false;
  stopCallTimer();
  hideNetworkBadge();

  const statusEl = document.getElementById('callStatus');
  if (statusEl) statusEl.textContent = 'Call ended.';

  const endBtn  = document.getElementById('endCallBtn');
  const callBtn = document.getElementById('callBtn');
  if (endBtn)  endBtn.style.display = 'none';
  if (callBtn) callBtn.disabled = false;
}

/* --------------------------------------------------------------------------
   Dialer keypad — init buttons
   -------------------------------------------------------------------------- */
function initDialpad() {
  // Digit / symbol buttons
  document.querySelectorAll('[data-digit]').forEach(btn => {
    btn.addEventListener('click', () => dialDigit(btn.dataset.digit));
  });

  // Call button
  const callBtn = document.getElementById('callBtn');
  if (callBtn) callBtn.addEventListener('click', initiateCall);

  // End-call button
  const endBtn = document.getElementById('endCallBtn');
  if (endBtn) {
    endBtn.style.display = 'none';
    endBtn.addEventListener('click', endCall);
  }

  // Backspace — short tap vs long-press
  const backspaceBtn = document.getElementById('backspaceBtn');
  if (backspaceBtn) {
    let longPressTimer    = null;
    let longPressTriggered = false;

    const startLongPress = (e) => {
      e.preventDefault(); // suppress Android WebView context menu
      longPressTriggered = false;
      longPressTimer = setTimeout(() => {
        longPressTriggered = true;
        clearDialed();
      }, LONG_PRESS_THRESHOLD_MS);
    };

    const endLongPress = () => {
      if (longPressTimer !== null) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      if (!longPressTriggered) {
        clearLastDigit();
      }
      longPressTriggered = false;
    };

    const cancelLongPress = () => {
      if (longPressTimer !== null) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      longPressTriggered = false;
    };

    backspaceBtn.addEventListener('pointerdown',   startLongPress);
    backspaceBtn.addEventListener('pointerup',     endLongPress);
    backspaceBtn.addEventListener('pointercancel', cancelLongPress);
  }
}

/* --------------------------------------------------------------------------
   Keyboard input
   -------------------------------------------------------------------------- */
function initKeyboardInput() {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (/^[0-9\*\#\+]$/.test(e.key)) {
      dialDigit(e.key);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      clearLastDigit();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      initiateCall();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      endCall();
    }
  });
}

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  // Clocks
  renderClocks();
  setInterval(renderClocks, 1000);

  // Controls
  initThemeToggle();
  initMuteToggle();

  // Connectivity
  initConnectivity();

  // Dialer
  initDialpad();
  initCallerIdName();
  initKeyboardInput();
  updateDialerDisplay();

  // Mic permission pre-check
  checkMicPermission();
});
