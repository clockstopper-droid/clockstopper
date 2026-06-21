// ─── Theme Persistence ────────────────────────────────────────────────────────
const THEME_STORAGE_KEY = 'clockstopper_theme';
const DARK_CLASS = 'dark-theme';

/**
 * Read the saved theme from localStorage and apply it to <body> immediately,
 * before any rendering occurs, to eliminate the flash of the default theme.
 */
(function applyStoredTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === DARK_CLASS) {
    document.body.classList.add(DARK_CLASS);
  }
})();

// ─── App State ────────────────────────────────────────────────────────────────
const state = {
  muted: false,
  dialedNumber: '',
  callerIdName: '',
  callActive: false,
  callStartTime: null,
  callDurationInterval: null,
  networkType: 'Unknown',
  connectivityOnline: navigator.onLine,
  connectivityTimestamp: null,
  probeRetryDelay: 2000,
  probeRetryHandle: null,
  micPermissionState: 'unknown',
  selectedNetwork: 'wifi',    // 'wifi' | 'mobile'
  stream: null,               // active MediaStream
};

// Backspace long-press constants
const LONG_PRESS_THRESHOLD_MS = 700;

// Connectivity probe constants
const PROBE_URL = 'https://www.gstatic.com/generate_204';
const PROBE_INITIAL_DELAY_MS  = 2000;
const PROBE_MAX_DELAY_MS      = 60000;

// ─── Fixed Time Zones ─────────────────────────────────────────────────────────
const TIME_ZONES = [
  { label: 'Eastern Time',  tz: 'America/New_York'    },
  { label: 'Central Time',  tz: 'America/Chicago'     },
  { label: 'Western Time',  tz: 'America/Los_Angeles' },
];

// ─── Clock Rendering ─────────────────────────────────────────────────────────
function renderClocks() {
  const container = document.getElementById('clocks');
  if (!container) return;
  container.innerHTML = '';

  const now = new Date();
  TIME_ZONES.forEach(({ label, tz }) => {
    const timeStr = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour:     '2-digit',
      minute:   '2-digit',
      second:   '2-digit',
      hour12:   true,
    }).format(now);

    const dateStr = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      month:   'short',
      day:     'numeric',
      year:    'numeric',
    }).format(now);

    const card = document.createElement('div');
    card.className = 'clock-card';
    card.innerHTML = `
      <div class="clock-label">${label}</div>
      <div class="clock-time">${timeStr}</div>
      <div class="clock-date">${dateStr}</div>
    `;
    container.appendChild(card);
  });
}

// ─── Theme Toggle ─────────────────────────────────────────────────────────────
/**
 * Toggle the dark theme class on <body> and persist the choice to localStorage
 * so the preference survives page reloads.
 */
function toggleTheme() {
  const isDark = document.body.classList.toggle(DARK_CLASS);
  try {
    if (isDark) {
      localStorage.setItem(THEME_STORAGE_KEY, DARK_CLASS);
    } else {
      localStorage.removeItem(THEME_STORAGE_KEY);
    }
  } catch (e) {
    // localStorage may be unavailable in some sandboxed contexts; fail silently.
    console.warn('clockstopper: unable to persist theme preference', e);
  }
}

// ─── Mute Toggle ──────────────────────────────────────────────────────────────
function toggleMute() {
  state.muted = !state.muted;
  const btn = document.getElementById('muteBtn');
  if (btn) btn.textContent = state.muted ? 'Unmute' : 'Mute';
}

// ─── Microphone Permission Pre-Check ─────────────────────────────────────────
async function checkMicPermission() {
  const el = document.getElementById('micPermissionStatus');
  if (!el) return;

  el.className = 'mic-status';

  if (navigator.permissions && navigator.permissions.query) {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' });
      applyMicState(result.state, el);
      result.onchange = () => applyMicState(result.state, el);
      return;
    } catch (_) {
      // Permissions API may not support 'microphone' on all browsers — fall through.
    }
  }

  // Fallback: probe via getUserMedia
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    applyMicState('granted', el);
  } catch (err) {
    applyMicState(err.name === 'NotAllowedError' ? 'denied' : 'prompt', el);
  }
}

function applyMicState(permState, el) {
  state.micPermissionState = permState;
  el.className = `mic-status mic-${permState}`;
  const labels = {
    granted: '🎤 Microphone access granted',
    denied:  '🚫 Microphone access denied — please enable in settings',
    prompt:  '⚠️ Microphone permission will be requested when you call',
  };
  el.textContent = labels[permState] || `Microphone: ${permState}`;
}

// ─── Connectivity Panel ───────────────────────────────────────────────────────
function formatTimestamp(date) {
  return date.toLocaleTimeString('en-US', { hour12: false });
}

function setConnectivityStatus(online, label) {
  state.connectivityOnline  = online;
  state.connectivityTimestamp = new Date();

  const statusEl    = document.getElementById('connectivityStatus');
  const timestampEl = document.getElementById('connectivityTimestamp');

  if (statusEl) {
    statusEl.textContent = label;
    statusEl.className   = `connectivity-status ${online ? 'status-online' : 'status-offline'}`;
  }
  if (timestampEl) {
    timestampEl.textContent = `Last updated: ${formatTimestamp(state.connectivityTimestamp)}`;
  }
}

// ─── Connectivity Probe with Exponential Backoff ──────────────────────────────
function scheduleProbe(delayMs) {
  clearTimeout(state.probeRetryHandle);
  state.probeRetryHandle = setTimeout(runProbe, delayMs);
}

async function runProbe() {
  try {
    const resp = await fetch(PROBE_URL, { method: 'HEAD', cache: 'no-store' });
    if (resp.ok || resp.status === 204) {
      setConnectivityStatus(true, 'Online');
      state.probeRetryDelay = PROBE_INITIAL_DELAY_MS; // reset backoff
    } else {
      throw new Error(`HTTP ${resp.status}`);
    }
  } catch (_) {
    setConnectivityStatus(false, 'Offline (probe failed)');
    state.probeRetryDelay = Math.min(state.probeRetryDelay * 2, PROBE_MAX_DELAY_MS);
    scheduleProbe(state.probeRetryDelay);
  }
}

function initConnectivity() {
  setConnectivityStatus(navigator.onLine, navigator.onLine ? 'Online' : 'Offline');
  runProbe();

  window.addEventListener('online', () => {
    clearTimeout(state.probeRetryHandle);
    state.probeRetryDelay = PROBE_INITIAL_DELAY_MS;
    setConnectivityStatus(true, 'Online (network restored)');
    runProbe();
  });

  window.addEventListener('offline', () => {
    clearTimeout(state.probeRetryHandle);
    state.probeRetryDelay = PROBE_INITIAL_DELAY_MS;
    setConnectivityStatus(false, 'Offline');
  });

  detectNetworkType();
  if (navigator.connection) {
    navigator.connection.addEventListener('change', detectNetworkType);
  }
}

// ─── Network Type Detection ───────────────────────────────────────────────────
function detectNetworkType() {
  const conn = navigator.connection;
  if (!conn) { state.networkType = 'Unknown'; return; }

  if (conn.type === 'wifi') {
    state.networkType = 'WiFi';
  } else if (conn.type === 'cellular') {
    const map = { '4g': '4G', '3g': '3G', '2g': '2G' };
    state.networkType = map[conn.effectiveType] || 'Cellular';
  } else {
    state.networkType = conn.effectiveType ? conn.effectiveType.toUpperCase() : 'Unknown';
  }

  const badge = document.getElementById('networkTypeIndicator');
  if (badge && state.callActive) {
    badge.textContent = state.networkType;
    badge.dataset.nettype = state.networkType.toLowerCase();
  }
}

// ─── Mobile Network Selection ─────────────────────────────────────────────────
function selectNetwork(type) {
  state.selectedNetwork = type; // 'wifi' | 'mobile'
  const wifiBtn   = document.getElementById('selectWifi');
  const mobileBtn = document.getElementById('selectMobile');
  if (wifiBtn)   wifiBtn.classList.toggle('active',  type === 'wifi');
  if (mobileBtn) mobileBtn.classList.toggle('active', type === 'mobile');
}

// ─── Dialer ───────────────────────────────────────────────────────────────────
function updateDialDisplay() {
  const display = document.getElementById('dialDisplay');
  const readout = document.getElementById('dialReadout');
  if (display) display.textContent = state.dialedNumber || '';
  if (readout) readout.textContent = state.dialedNumber
    ? `Dialing: ${state.dialedNumber}`
    : '';
}

function dialDigit(digit) {
  if (state.callActive) return;
  state.dialedNumber += digit;
  updateDialDisplay();
}

function clearLastDigit() {
  state.dialedNumber = state.dialedNumber.slice(0, -1);
  updateDialDisplay();
}

function clearDialed() {
  state.dialedNumber = '';
  updateDialDisplay();
}

// ─── Caller ID Name ───────────────────────────────────────────────────────────
function saveCallerIdName() {
  const input = document.getElementById('callerIdInput');
  if (!input) return;
  state.callerIdName = input.value.trim();
  const saved = document.getElementById('callerIdSaved');
  if (saved) {
    saved.textContent = state.callerIdName
      ? `Caller ID set to: "${state.callerIdName}"`
      : 'Caller ID name cleared.';
  }
}

// ─── Call Duration Timer ──────────────────────────────────────────────────────
function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function startCallTimer() {
  state.callStartTime = Date.now();
  const statusEl = document.getElementById('callStatus');
  state.callDurationInterval = setInterval(() => {
    if (!statusEl) return;
    const elapsed = Date.now() - state.callStartTime;
    statusEl.textContent = `Call connected — ${formatElapsed(elapsed)}`;
  }, 1000);
}

function stopCallTimer() {
  clearInterval(state.callDurationInterval);
  state.callDurationInterval = null;
  state.callStartTime = null;
}

// ─── Network Type Badge ───────────────────────────────────────────────────────
function showNetworkBadge() {
  detectNetworkType();
  const badge = document.getElementById('networkTypeIndicator');
  if (!badge) return;
  badge.textContent = state.networkType;
  badge.dataset.nettype = state.networkType.toLowerCase();
  badge.hidden = false;
}

function hideNetworkBadge() {
  const badge = document.getElementById('networkTypeIndicator');
  if (badge) badge.hidden = true;
}

// ─── Call Control ─────────────────────────────────────────────────────────────
async function initiateCall() {
  if (state.callActive) return;
  if (!state.dialedNumber) {
    const statusEl = document.getElementById('callStatus');
    if (statusEl) statusEl.textContent = 'Enter a number to dial.';
    return;
  }

  const statusEl = document.getElementById('callStatus');
  if (statusEl) statusEl.textContent = 'Requesting microphone…';

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    if (statusEl) statusEl.textContent = `Microphone error: ${err.message}`;
    applyMicState(err.name === 'NotAllowedError' ? 'denied' : 'prompt',
      document.getElementById('micPermissionStatus') || document.createElement('span'));
    return;
  }

  state.callActive = true;

  if (statusEl) statusEl.textContent = 'Call connected — 00:00';
  startCallTimer();
  showNetworkBadge();

  const callBtn = document.getElementById('callBtn');
  const endBtn  = document.getElementById('endCallBtn');
  if (callBtn) callBtn.hidden = true;
  if (endBtn)  endBtn.hidden  = false;

  // Update mic status to granted now that stream is live
  applyMicState('granted',
    document.getElementById('micPermissionStatus') || document.createElement('span'));
}

function endCall() {
  if (!state.callActive) return;

  if (state.stream) {
    state.stream.getTracks().forEach(t => t.stop());
    state.stream = null;
  }

  state.callActive = false;
  stopCallTimer();
  hideNetworkBadge();

  const statusEl = document.getElementById('callStatus');
  if (statusEl) statusEl.textContent = 'Call ended.';

  const callBtn = document.getElementById('callBtn');
  const endBtn  = document.getElementById('endCallBtn');
  if (callBtn) callBtn.hidden = false;
  if (endBtn)  endBtn.hidden  = true;
}

// ─── Keyboard Input ───────────────────────────────────────────────────────────
function initKeyboardInput() {
  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;

    const digit = e.key;
    if (/^[0-9*#+]$/.test(digit)) {
      dialDigit(digit);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      clearLastDigit();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      state.callActive ? endCall() : initiateCall();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (state.callActive) endCall();
      else clearDialed();
    }
  });
}

// ─── Backspace Long-Press ─────────────────────────────────────────────────────
function initBackspaceLongPress() {
  const btn = document.getElementById('backspaceBtn');
  if (!btn) return;

  let longPressHandle = null;
  let longPressTriggered = false;

  function onDown(e) {
    e.preventDefault(); // suppress Android WebView long-press context menu
    longPressTriggered = false;
    longPressHandle = setTimeout(() => {
      longPressTriggered = true;
      clearDialed();
    }, LONG_PRESS_THRESHOLD_MS);
  }

  function onUp() {
    clearTimeout(longPressHandle);
    longPressHandle = null;
    if (!longPressTriggered) {
      clearLastDigit();
    }
    longPressTriggered = false;
  }

  btn.addEventListener('pointerdown',  onDown);
  btn.addEventListener('pointerup',    onUp);
  btn.addEventListener('pointercancel', onUp);
}

// ─── Wire Up UI Events ────────────────────────────────────────────────────────
function initUI() {
  // Theme
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Mute
  const muteBtn = document.getElementById('muteBtn');
  if (muteBtn) muteBtn.addEventListener('click', toggleMute);

  // Keypad digits
  document.querySelectorAll('[data-digit]').forEach(btn => {
    btn.addEventListener('click', () => dialDigit(btn.dataset.digit));
  });

  // Backspace (long-press wired separately below)
  initBackspaceLongPress();

  // Call / End
  const callBtn = document.getElementById('callBtn');
  if (callBtn) callBtn.addEventListener('click', initiateCall);

  const endBtn = document.getElementById('endCallBtn');
  if (endBtn) {
    endBtn.addEventListener('click', endCall);
    endBtn.hidden = true;
  }

  // Caller ID
  const callerIdSaveBtn = document.getElementById('saveCallerIdBtn');
  if (callerIdSaveBtn) callerIdSaveBtn.addEventListener('click', saveCallerIdName);

  // Network selection
  const wifiBtn   = document.getElementById('selectWifi');
  const mobileBtn = document.getElementById('selectMobile');
  if (wifiBtn)   wifiBtn.addEventListener('click',   () => selectNetwork('wifi'));
  if (mobileBtn) mobileBtn.addEventListener('click', () => selectNetwork('mobile'));

  // Hide network badge until a call is active
  hideNetworkBadge();
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderClocks();
  setInterval(renderClocks, 1000);

  initUI();
  initKeyboardInput();
  initConnectivity();
  checkMicPermission();
});
