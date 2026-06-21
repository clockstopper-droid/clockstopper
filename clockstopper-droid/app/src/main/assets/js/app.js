/* ============================================================
   Global Time Clock — app.js
   All application logic:
   - Three fixed world clocks (Eastern, Central, Pacific)
   - Dark theme toggle with localStorage persistence
   - Mute toggle (audio alerts)
   - Connectivity panel with exponential backoff probe + timestamps
   - Mobile network detection & selection
   - Microphone permission pre-check
   - Dialer UI with keyboard input, backspace long-press clear
   - Caller ID name
   - Outgoing call audio (MediaDevices API)
   - Call duration timer
   - Network type badge
   - Call volume indicator
   - MIC MUTE during active call (new)
   ============================================================ */

'use strict';

/* ── Utility ─────────────────────────────────────────────── */
function pad2(n) { return String(n).padStart(2, '0'); }

/* ── Theme persistence ───────────────────────────────────── */
const THEME_KEY = 'darkTheme';

function applyTheme(dark) {
  document.body.classList.toggle('dark', dark);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = dark ? '☀ Light Mode' : '🌙 Dark Mode';
}

function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const dark = saved === null ? true : saved === 'true';
  applyTheme(dark);
}

function toggleTheme() {
  const dark = document.body.classList.contains('dark');
  const next = !dark;
  localStorage.setItem(THEME_KEY, String(next));
  applyTheme(next);
}

/* ── World Clocks ────────────────────────────────────────── */
const CLOCKS = [
  { id: 'clockEastern', zone: 'America/New_York',    label: 'Eastern' },
  { id: 'clockCentral', zone: 'America/Chicago',     label: 'Central' },
  { id: 'clockWestern', zone: 'America/Los_Angeles', label: 'Pacific' },
];

function updateClocks() {
  const now = new Date();
  CLOCKS.forEach(({ id, zone }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour:     '2-digit',
      minute:   '2-digit',
      second:   '2-digit',
      hour12:   true,
    }).format(now);
  });
}

/* ── Mute (audio alerts) ─────────────────────────────────── */
let alertsMuted = false;

function toggleMute() {
  alertsMuted = !alertsMuted;
  const btn = document.getElementById('muteBtn');
  if (btn) {
    btn.textContent    = alertsMuted ? '🔇 Unmute' : '🔔 Mute';
    btn.dataset.muted  = String(alertsMuted);
  }
}

/* ── Connectivity probe with exponential backoff ─────────── */
const PROBE_URL        = 'https://www.gstatic.com/generate_204';
const PROBE_TIMEOUT_MS = 5000;
const BACKOFF_BASE_MS  = 2000;
const BACKOFF_MAX_MS   = 60000;

let probeBackoffMs   = BACKOFF_BASE_MS;
let probeTimer       = null;
let probeController  = null;

function setConnectivityStatus(msg, ts) {
  const statusEl = document.getElementById('connectivityStatus');
  const tsEl     = document.getElementById('connectivityTimestamp');
  if (statusEl) statusEl.textContent = msg;
  if (tsEl)     tsEl.textContent     = ts ? `(${ts})` : '';
}

function scheduleProbe(delayMs) {
  clearTimeout(probeTimer);
  probeTimer = setTimeout(runProbe, delayMs);
}

async function runProbe() {
  if (probeController) probeController.abort();
  probeController = new AbortController();
  const ts = new Date().toLocaleTimeString();
  try {
    const res = await fetch(PROBE_URL, {
      method: 'HEAD',
      cache:  'no-store',
      signal: probeController.signal,
    });
    if (res.ok || res.status === 204) {
      probeBackoffMs = BACKOFF_BASE_MS;
      setConnectivityStatus('Online ✔', ts);
      scheduleProbe(30000);
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
    const failTs = new Date().toLocaleTimeString();
    setConnectivityStatus(`Probe failed — retrying in ${probeBackoffMs / 1000}s`, failTs);
    scheduleProbe(probeBackoffMs);
    probeBackoffMs = Math.min(probeBackoffMs * 2, BACKOFF_MAX_MS);
  }
}

function onOnline() {
  probeBackoffMs = BACKOFF_BASE_MS;
  const ts = new Date().toLocaleTimeString();
  setConnectivityStatus('Network online — probing…', ts);
  runProbe();
}

function onOffline() {
  clearTimeout(probeTimer);
  const ts = new Date().toLocaleTimeString();
  setConnectivityStatus('Offline ✖', ts);
}

/* ── Network information / mobile network ────────────────── */
let preferMobileNetwork = false;

function getNetworkType() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return 'unknown';
  return conn.type || conn.effectiveType || 'unknown';
}

function updateNetworkInfo() {
  const type   = getNetworkType();
  const el     = document.getElementById('networkInfo');
  if (el) el.textContent = `Network: ${type}`;

  const mobileOpt = document.getElementById('mobileNetworkOption');
  if (mobileOpt) {
    const isCellular = ['cellular', '4g', '3g', '2g'].includes(type);
    mobileOpt.style.display = isCellular ? 'block' : 'none';
  }
}

function toggleMobileNetwork() {
  preferMobileNetwork = !preferMobileNetwork;
  const btn = document.getElementById('mobileNetworkBtn');
  if (btn) btn.textContent = preferMobileNetwork
    ? '📶 Mobile Network: ON'
    : '📶 Mobile Network: OFF';
}

/* ── Microphone permission pre-check ─────────────────────── */
async function checkMicPermission() {
  const el = document.getElementById('micPermissionStatus');
  if (!el) return;

  if (navigator.permissions) {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' });
      applyMicStatus(el, result.state);
      result.onchange = () => applyMicStatus(el, result.state);
      return;
    } catch (_) { /* fall through to getUserMedia probe */ }
  }

  // Fallback: getUserMedia probe
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    applyMicStatus(el, 'granted');
  } catch (err) {
    applyMicStatus(el, err.name === 'NotAllowedError' ? 'denied' : 'prompt');
  }
}

function applyMicStatus(el, state) {
  const map = {
    granted: { text: '🎤 Microphone: Granted',  cls: 'mic-granted' },
    denied:  { text: '🎤 Microphone: Denied ✖', cls: 'mic-denied'  },
    prompt:  { text: '🎤 Microphone: Not yet requested', cls: 'mic-prompt' },
  };
  const info = map[state] || { text: `🎤 Microphone: ${state}`, cls: '' };
  el.textContent = info.text;
  el.className   = 'mic-status ' + info.cls;
}

/* ── Caller ID name ──────────────────────────────────────── */
let callerIdName = '';

function saveCallerIdName() {
  const input = document.getElementById('callerIdInput');
  if (!input) return;
  callerIdName = input.value.trim();
  const display = document.getElementById('callerIdDisplay');
  if (display) display.textContent = callerIdName
    ? `Caller ID: ${callerIdName}`
    : 'Caller ID: (not set)';
}

/* ── Dialer state ────────────────────────────────────────── */
let dialedNumber = '';

function updateDialDisplay() {
  const box     = document.getElementById('dialDisplay');
  const readout = document.getElementById('dialReadout');
  if (box)     box.textContent     = dialedNumber || ' ';
  if (readout) readout.textContent = dialedNumber
    ? `Dialing: ${dialedNumber}`
    : 'Enter a number';
}

function dialDigit(d) {
  dialedNumber += d;
  updateDialDisplay();
}

function clearLastDigit() {
  dialedNumber = dialedNumber.slice(0, -1);
  updateDialDisplay();
}

function clearDialed() {
  dialedNumber = '';
  updateDialDisplay();
}

/* ── Backspace long-press ────────────────────────────────── */
const LONG_PRESS_MS = 600;
let longPressTimer  = null;

function attachBackspaceLongPress() {
  const btn = document.getElementById('backspaceBtn');
  if (!btn) return;

  const startLongPress = () => {
    longPressTimer = setTimeout(() => {
      clearDialed();
      longPressTimer = null;
    }, LONG_PRESS_MS);
  };

  const cancelLongPress = (doShortAction) => {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
      if (doShortAction) clearLastDigit();
    }
  };

  btn.addEventListener('pointerdown',   () => startLongPress());
  btn.addEventListener('pointerup',     () => cancelLongPress(true));
  btn.addEventListener('pointercancel', () => cancelLongPress(false));
}

/* ── Keyboard input ──────────────────────────────────────── */
function handleKeydown(e) {
  const key = e.key;

  if (callActive) {
    // During a call: allow mic mute toggle via 'm' key
    if (key === 'm' || key === 'M') {
      toggleMicMute();
      return;
    }
    if (key === 'Escape') { endCall(); return; }
    return; // swallow other keys during call
  }

  if (/^[0-9*#+]$/.test(key)) { dialDigit(key);    return; }
  if (key === 'Backspace')     { clearLastDigit();  return; }
  if (key === 'Enter')         { initiateCall();    return; }
  if (key === 'Escape')        { clearDialed();     return; }
}

/* ── Call duration timer ─────────────────────────────────── */
let callStartTime  = null;
let callTimerInterval = null;

function startCallTimer() {
  callStartTime = Date.now();
  callTimerInterval = setInterval(updateCallTimer, 1000);
  updateCallTimer();
}

function stopCallTimer() {
  clearInterval(callTimerInterval);
  callTimerInterval = null;
  callStartTime     = null;
}

function updateCallTimer() {
  const el = document.getElementById('callStatus');
  if (!el || !callStartTime) return;
  const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const formatted = h > 0
    ? `${pad2(h)}:${pad2(m)}:${pad2(s)}`
    : `${pad2(m)}:${pad2(s)}`;
  el.textContent = `In call: ${formatted}`;
}

/* ── Network type badge ──────────────────────────────────── */
function updateNetworkTypeBadge() {
  const el = document.getElementById('networkTypeIndicator');
  if (!el) return;
  const type = getNetworkType();
  const labels = {
    wifi:     'WiFi',
    cellular: 'Cellular',
    '4g':     '4G',
    '3g':     '3G',
    '2g':     '2G',
    ethernet: 'Ethernet',
  };
  el.textContent = labels[type] || 'Unknown';
  el.style.display = callActive ? 'inline-block' : 'none';
}

/* ── Call volume indicator ───────────────────────────────── */
let callAudioEl = null;

function updateVolumeIndicator() {
  const el = document.getElementById('callVolumeIndicator');
  if (!el) return;
  const vol = callAudioEl ? callAudioEl.volume : 1;
  const pct = Math.round(vol * 100);
  el.textContent   = `🔊 ${pct}%`;
  el.style.display = callActive ? 'inline-block' : 'none';
}

function handleVolumeKey(e) {
  if (!callActive || !callAudioEl) return;
  if (e.key === 'VolumeUp') {
    callAudioEl.volume = Math.min(1, callAudioEl.volume + 0.1);
    updateVolumeIndicator();
    e.preventDefault();
  } else if (e.key === 'VolumeDown') {
    callAudioEl.volume = Math.max(0, callAudioEl.volume - 0.1);
    updateVolumeIndicator();
    e.preventDefault();
  }
}

/* ── Mic mute during call (NEW) ──────────────────────────── */
let callStream    = null;   // MediaStream from getUserMedia
let micMuted      = false;  // current mic-mute state

/**
 * Toggle the microphone mute state during an active call.
 * Muting disables every audio track on the live MediaStream so
 * the remote party cannot hear the local caller.  The UI button
 * and status element are updated to reflect the new state.
 */
function toggleMicMute() {
  if (!callStream) return;

  micMuted = !micMuted;

  // Enable/disable each audio track on the live stream
  callStream.getAudioTracks().forEach(track => {
    track.enabled = !micMuted;
  });

  _applyMicMuteUI();
}

/**
 * Update all mic-mute UI elements to match the current `micMuted` state.
 * Called after any state change (mute, unmute, call start, call end).
 */
function _applyMicMuteUI() {
  const btn       = document.getElementById('micMuteBtn');
  const statusEl  = document.getElementById('micMuteStatus');

  if (btn) {
    btn.textContent       = micMuted ? '🎙️ Unmute Mic' : '🎙️ Mute Mic';
    btn.dataset.micMuted  = String(micMuted);
    btn.setAttribute('aria-pressed', String(micMuted));
    btn.classList.toggle('active', micMuted);
  }

  if (statusEl) {
    statusEl.textContent = micMuted ? 'Mic muted 🔇' : 'Mic live 🔴';
    statusEl.className   = micMuted ? 'mic-mute-status muted' : 'mic-mute-status live';
  }
}

/**
 * Show mic-mute controls (visible only during an active call).
 */
function showMicMuteControls() {
  const wrap = document.getElementById('micMuteControls');
  if (wrap) wrap.style.display = 'flex';
}

/**
 * Hide mic-mute controls and reset mute state when call ends.
 */
function hideMicMuteControls() {
  // Unmute tracks before releasing stream so no audio stays suppressed
  if (callStream) {
    callStream.getAudioTracks().forEach(track => { track.enabled = true; });
  }
  micMuted = false;
  _applyMicMuteUI();

  const wrap = document.getElementById('micMuteControls');
  if (wrap) wrap.style.display = 'none';
}

/* ── Call state ──────────────────────────────────────────── */
let callActive = false;

async function initiateCall() {
  if (callActive)        return;
  if (!dialedNumber)     return;

  const statusEl = document.getElementById('callStatus');
  if (statusEl) statusEl.textContent = 'Requesting microphone…';

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    if (statusEl) statusEl.textContent = `Mic error: ${err.message}`;
    return;
  }

  callStream = stream;
  micMuted   = false;           // always start unmuted

  // Wire stream to an audio element for call audio output
  callAudioEl         = new Audio();
  callAudioEl.srcObject = stream;
  callAudioEl.muted   = true;   // prevent local echo; remote audio handled separately
  callAudioEl.play().catch(() => {});

  callActive = true;

  if (statusEl) statusEl.textContent = 'Connecting…';

  // Simulate connection after short delay (replace with real signalling)
  setTimeout(() => {
    if (!callActive) return;
    if (statusEl) statusEl.textContent = 'In call: 00:00';
    startCallTimer();
    updateNetworkTypeBadge();
    updateVolumeIndicator();
    showMicMuteControls();     // ← reveal mic mute controls

    // Listen for network changes during call
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) conn.addEventListener('change', onNetworkChangeDuringCall);
  }, 1000);
}

function endCall() {
  if (!callActive) return;
  callActive = false;

  // Stop mic stream
  if (callStream) {
    callStream.getTracks().forEach(t => t.stop());
    callStream = null;
  }

  if (callAudioEl) {
    callAudioEl.pause();
    callAudioEl.srcObject = null;
    callAudioEl = null;
  }

  stopCallTimer();
  hideMicMuteControls();        // ← hide and reset mic mute controls

  const statusEl = document.getElementById('callStatus');
  if (statusEl) statusEl.textContent = 'Call ended';

  updateNetworkTypeBadge();
  updateVolumeIndicator();

  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) conn.removeEventListener('change', onNetworkChangeDuringCall);
}

function onNetworkChangeDuringCall() {
  updateNetworkTypeBadge();
  updateVolumeIndicator();
}

/* ── Init ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Theme
  loadTheme();
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Mute (audio alerts)
  const muteBtn = document.getElementById('muteBtn');
  if (muteBtn) muteBtn.addEventListener('click', toggleMute);

  // Clocks
  updateClocks();
  setInterval(updateClocks, 1000);

  // Connectivity
  window.addEventListener('online',  onOnline);
  window.addEventListener('offline', onOffline);
  const initialTs = new Date().toLocaleTimeString();
  if (navigator.onLine) {
    setConnectivityStatus('Online ✔', initialTs);
    scheduleProbe(2000);
  } else {
    setConnectivityStatus('Offline ✖', initialTs);
  }

  // Network info
  updateNetworkInfo();
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) conn.addEventListener('change', updateNetworkInfo);

  // Mobile network toggle
  const mobileBtn = document.getElementById('mobileNetworkBtn');
  if (mobileBtn) mobileBtn.addEventListener('click', toggleMobileNetwork);

  // Mic permission pre-check
  checkMicPermission();

  // Caller ID name
  const saveIdBtn = document.getElementById('saveCallerIdBtn');
  if (saveIdBtn) saveIdBtn.addEventListener('click', saveCallerIdName);

  // Dialer keypad
  document.querySelectorAll('.dial-key').forEach(btn => {
    btn.addEventListener('click', () => dialDigit(btn.dataset.digit));
  });
  updateDialDisplay();

  // Backspace long-press
  attachBackspaceLongPress();

  // Call buttons
  const callBtn = document.getElementById('callBtn');
  const endBtn  = document.getElementById('endCallBtn');
  if (callBtn) callBtn.addEventListener('click', initiateCall);
  if (endBtn)  endBtn.addEventListener('click',  endCall);

  // Mic mute button
  const micMuteBtn = document.getElementById('micMuteBtn');
  if (micMuteBtn) micMuteBtn.addEventListener('click', toggleMicMute);

  // Hide mic mute controls initially
  hideMicMuteControls();

  // Keyboard input
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('keydown', handleVolumeKey);

  // Initial badge/volume state
  updateNetworkTypeBadge();
  updateVolumeIndicator();
});
