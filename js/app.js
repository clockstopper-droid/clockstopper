/* ============================================================
   Global Time Clock — app.js  (root copy)
   All application logic:
   - Three fixed world clocks (Eastern, Central, Pacific)
   - Dark theme toggle with localStorage persistence
   - Mute toggle (audio alerts) — glass dial-pad key with
       neon underglow; glow REMOVED when mute is active
   - Connectivity panel with exponential backoff probe + timestamps
   - Mobile network detection & selection
   - Microphone permission pre-check
   - Dialer UI with keyboard input, backspace long-press clear
   - Caller ID name
   - Outgoing call audio (MediaDevices API)
   - Call duration timer
   - Network type badge
   - Call volume indicator
   - Mic mute during active call (mid-call mic track toggle)
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

/* ══════════════════════════════════════════════════════════
   MUTE (audio alerts) — dial-pad key variant
   When mute is ON  → class "muted-active" added  (glow OFF)
   When mute is OFF → class "muted-active" removed (glow ON)
   ══════════════════════════════════════════════════════════ */
let alertsMuted = false;

function applyMuteUI() {
  const btn = document.getElementById('muteBtn');
  if (!btn) return;
  if (alertsMuted) {
    btn.classList.add('muted-active');
    btn.setAttribute('aria-pressed', 'true');
    btn.textContent  = '🔇 Unmute';
    btn.title        = 'Audio alerts muted — click to restore';
    btn.dataset.muted = 'true';
  } else {
    btn.classList.remove('muted-active');
    btn.setAttribute('aria-pressed', 'false');
    btn.textContent  = '🔔 Mute';
    btn.title        = 'Mute / unmute audio alerts';
    btn.dataset.muted = 'false';
  }
}

function toggleMute() {
  alertsMuted = !alertsMuted;
  applyMuteUI();
}

/* ── Connectivity probe with exponential backoff ─────────── */
const PROBE_URL       = 'https://www.gstatic.com/generate_204';
const BACKOFF_BASE_MS = 2000;
const BACKOFF_MAX_MS  = 60000;

let probeBackoffMs  = BACKOFF_BASE_MS;
let probeTimer      = null;
let probeController = null;

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
  const type = getNetworkType();
  const el   = document.getElementById('networkInfo');
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
    } catch (_) {}
  }
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
    granted: { text: '🎤 Microphone: Granted',           cls: 'mic-granted' },
    denied:  { text: '🎤 Microphone: Denied ✖',          cls: 'mic-denied'  },
    prompt:  { text: '🎤 Microphone: Not yet requested', cls: 'mic-prompt'  },
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

function dialDigit(d) { dialedNumber += d; updateDialDisplay(); }
function clearLastDigit() { dialedNumber = dialedNumber.slice(0, -1); updateDialDisplay(); }
function clearDialed()    { dialedNumber = ''; updateDialDisplay(); }

/* ── Backspace long-press ────────────────────────────────── */
const LONG_PRESS_MS = 600;
let longPressTimer  = null;

function attachBackspaceLongPress() {
  const btn = document.getElementById('backspaceBtn');
  if (!btn) return;
  const startLP = () => {
    longPressTimer = setTimeout(() => { clearDialed(); longPressTimer = null; }, LONG_PRESS_MS);
  };
  const cancelLP = (doShort) => {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
      if (doShort) clearLastDigit();
    }
  };
  btn.addEventListener('pointerdown',   () => startLP());
  btn.addEventListener('pointerup',     () => cancelLP(true));
  btn.addEventListener('pointercancel', () => cancelLP(false));
}

/* ── Keyboard input ──────────────────────────────────────── */
function handleKeydown(e) {
  const key = e.key;
  if (callActive) {
    if (key === 'm' || key === 'M') { toggleMicMute(); return; }
    if (key === 'Escape')           { endCall(); return; }
    return;
  }
  if (/^[0-9*#+]$/.test(key)) { dialDigit(key);   return; }
  if (key === 'Backspace')     { clearLastDigit(); return; }
  if (key === 'Enter')         { initiateCall();   return; }
  if (key === 'Escape')        { clearDialed();    return; }
}

/* ── Call duration timer ─────────────────────────────────── */
let callStartTime = null, callTimerInterval = null;

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
  el.textContent = `In call: ${h > 0 ? pad2(h) + ':' : ''}${pad2(m)}:${pad2(s)}`;
}

/* ── Network type badge ──────────────────────────────────── */
function updateNetworkTypeBadge() {
  const el = document.getElementById('networkTypeIndicator');
  if (!el) return;
  const labels = { wifi:'WiFi', cellular:'Cellular', '4g':'4G', '3g':'3G', '2g':'2G', ethernet:'Ethernet' };
  el.textContent   = labels[getNetworkType()] || 'Unknown';
  el.style.display = callActive ? 'inline-block' : 'none';
}

/* ── Call volume indicator ───────────────────────────────── */
let callAudioEl = null;

function updateVolumeIndicator() {
  const el = document.getElementById('callVolumeIndicator');
  if (!el) return;
  el.textContent   = `🔊 ${Math.round((callAudioEl ? callAudioEl.volume : 1) * 100)}%`;
  el.style.display = callActive ? 'inline-block' : 'none';
}

function handleVolumeKey(e) {
  if (!callActive || !callAudioEl) return;
  if (e.key === 'VolumeUp')   { callAudioEl.volume = Math.min(1, callAudioEl.volume + 0.1); updateVolumeIndicator(); e.preventDefault(); }
  if (e.key === 'VolumeDown') { callAudioEl.volume = Math.max(0, callAudioEl.volume - 0.1); updateVolumeIndicator(); e.preventDefault(); }
}

/* ── Mic mute during call ────────────────────────────────── */
let callStream = null, micMuted = false;

function toggleMicMute() {
  if (!callStream) return;
  micMuted = !micMuted;
  callStream.getAudioTracks().forEach(t => { t.enabled = !micMuted; });
  _applyMicMuteUI();
}

function _applyMicMuteUI() {
  const btn = document.getElementById('micMuteBtn');
  const st  = document.getElementById('micMuteStatus');
  if (btn) {
    btn.textContent = micMuted ? '🎙️ Unmute Mic' : '🎙️ Mute Mic';
    btn.dataset.micMuted = String(micMuted);
    btn.setAttribute('aria-pressed', String(micMuted));
    btn.classList.toggle('active', micMuted);
  }
  if (st) {
    st.textContent = micMuted ? 'Mic muted 🔇' : 'Mic live 🔴';
    st.className   = micMuted ? 'mic-mute-status muted' : 'mic-mute-status live';
  }
}

function showMicMuteControls() {
  const w = document.getElementById('micMuteControls');
  if (w) w.style.display = 'flex';
}

function hideMicMuteControls() {
  if (callStream) callStream.getAudioTracks().forEach(t => { t.enabled = true; });
  micMuted = false;
  _applyMicMuteUI();
  const w = document.getElementById('micMuteControls');
  if (w) w.style.display = 'none';
}

/* ── Call state ──────────────────────────────────────────── */
let callActive = false;

async function initiateCall() {
  if (callActive || !dialedNumber) return;
  const statusEl = document.getElementById('callStatus');
  if (statusEl) statusEl.textContent = 'Requesting microphone…';
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    if (statusEl) statusEl.textContent = `Mic error: ${err.message}`;
    return;
  }
  callStream = stream; micMuted = false;
  callAudioEl = new Audio();
  callAudioEl.srcObject = stream;
  callAudioEl.muted = true;
  callAudioEl.play().catch(() => {});
  callActive = true;
  if (statusEl) statusEl.textContent = 'Connecting…';
  setTimeout(() => {
    if (!callActive) return;
    if (statusEl) statusEl.textContent = 'In call: 00:00';
    startCallTimer(); updateNetworkTypeBadge(); updateVolumeIndicator(); showMicMuteControls();
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) conn.addEventListener('change', onNetworkChangeDuringCall);
  }, 1000);
}

function endCall() {
  if (!callActive) return;
  callActive = false;
  if (callStream) { callStream.getTracks().forEach(t => t.stop()); callStream = null; }
  if (callAudioEl) { callAudioEl.pause(); callAudioEl.srcObject = null; callAudioEl = null; }
  stopCallTimer(); hideMicMuteControls();
  const statusEl = document.getElementById('callStatus');
  if (statusEl) statusEl.textContent = 'Call ended';
  updateNetworkTypeBadge(); updateVolumeIndicator();
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) conn.removeEventListener('change', onNetworkChangeDuringCall);
}

function onNetworkChangeDuringCall() { updateNetworkTypeBadge(); updateVolumeIndicator(); }

/* ── Init ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  const muteBtn = document.getElementById('muteBtn');
  if (muteBtn) { muteBtn.addEventListener('click', toggleMute); applyMuteUI(); }

  updateClocks();
  setInterval(updateClocks, 1000);

  window.addEventListener('online',  onOnline);
  window.addEventListener('offline', onOffline);
  const ts = new Date().toLocaleTimeString();
  if (navigator.onLine) { setConnectivityStatus('Online ✔', ts); scheduleProbe(2000); }
  else                  { setConnectivityStatus('Offline ✖', ts); }

  updateNetworkInfo();
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) conn.addEventListener('change', updateNetworkInfo);

  const mobileBtn = document.getElementById('mobileNetworkBtn');
  if (mobileBtn) mobileBtn.addEventListener('click', toggleMobileNetwork);

  checkMicPermission();

  const saveIdBtn = document.getElementById('saveCallerIdBtn');
  if (saveIdBtn) saveIdBtn.addEventListener('click', saveCallerIdName);

  document.querySelectorAll('.dial-key[data-digit]').forEach(btn => {
    btn.addEventListener('click', () => dialDigit(btn.dataset.digit));
  });
  updateDialDisplay();
  attachBackspaceLongPress();

  const callBtn = document.getElementById('callBtn');
  const endBtn  = document.getElementById('endCallBtn');
  if (callBtn) callBtn.addEventListener('click', initiateCall);
  if (endBtn)  endBtn.addEventListener('click',  endCall);

  const micMuteBtn = document.getElementById('micMuteBtn');
  if (micMuteBtn) micMuteBtn.addEventListener('click', toggleMicMute);
  hideMicMuteControls();

  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('keydown', handleVolumeKey);
  updateNetworkTypeBadge();
  updateVolumeIndicator();
});
