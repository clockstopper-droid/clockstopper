/**
 * app.js — Global Time Clock (clockstopper) — main application logic
 * ─────────────────────────────────────────────────────────────────────
 * Responsibilities (in rough order of declaration):
 *  1.  Three fixed world clocks  (Eastern / Central / Pacific)
 *  2.  Dark-theme toggle + localStorage persistence
 *  3.  Mute button + dialpad dark-red neon under-glow toggle
 *  4.  Dialer UI — digit entry, display, keyboard input, backspace long-press
 *  5.  Caller ID name
 *  6.  Microphone permission pre-check
 *  7.  Outgoing call audio — MediaDevices.getUserMedia, AudioContext, routing
 *  8.  Call duration timer
 *  9.  Network-type badge (WiFi / 4G / 3G / Cellular / Headset / …)
 * 10.  Connectivity panel — probe, exponential back-off, timestamps
 * 11.  Mobile network detection & selection
 * 12.  Call volume indicator (hardware volume-key events)
 * 13.  In-call microphone mute toggle
 * 14.  ── Android audio bridge ──────────────────────────────────────────
 *       Integrates with the native AndroidAudio JavascriptInterface
 *       (window.AndroidAudio) injected by MainActivity.  The bridge is
 *       called on call start/end so the Android layer can:
 *         • Request audio focus (AudioManager)
 *         • Route audio to Bluetooth SCO/A2DP earbuds or wired headset
 *         • Manage a MediaSession for headset hardware-button events
 *       The Android layer fires CustomEvents back into the page:
 *         • audioDeviceConnected   — {detail: {name, type}}
 *         • audioDeviceDisconnected — {detail: {name, type}}
 *         • bluetoothScoConnected / bluetoothScoDisconnected
 *         • audioOutputRouted      — {detail: {device, mode, fallback?}}
 *         • audioFocusGained / audioFocusLost / audioFocusDuck
 *         • mediaButtonPlay / mediaButtonPause / mediaButtonStop
 *         • micPermissionGranted / micPermissionDenied
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// 1. WORLD CLOCKS
// ═══════════════════════════════════════════════════════════════════════════

const CLOCKS = [
  { id: 'clock-eastern', label: 'Eastern',  tz: 'America/New_York'    },
  { id: 'clock-central', label: 'Central',  tz: 'America/Chicago'     },
  { id: 'clock-pacific', label: 'Pacific',  tz: 'America/Los_Angeles' },
];

function updateClocks() {
  const now = new Date();
  CLOCKS.forEach(({ id, tz }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour:     '2-digit',
      minute:   '2-digit',
      second:   '2-digit',
      hour12:   true,
    }).format(now);
  });
}

setInterval(updateClocks, 1000);
updateClocks();

// ═══════════════════════════════════════════════════════════════════════════
// 2. DARK THEME + localStorage PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════

const THEME_KEY = 'darkTheme';

function applyTheme(dark) {
  document.body.classList.toggle('dark', dark);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = dark ? '☀ Light' : '☾ Dark';
}

(function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === null ? true : saved === 'true');
})();

function toggleTheme() {
  const isDark = document.body.classList.contains('dark');
  const next   = !isDark;
  applyTheme(next);
  localStorage.setItem(THEME_KEY, String(next));
}

const themeToggleBtn = document.getElementById('themeToggle');
if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

// ═══════════════════════════════════════════════════════════════════════════
// 3. MUTE BUTTON + DIALPAD NEON UNDER-GLOW
// ═══════════════════════════════════════════════════════════════════════════

let isMuted = false;

function setMuteState(muted) {
  isMuted = muted;
  const dialpad = document.getElementById('dialpad');
  const muteBtn = document.getElementById('muteBtn');
  if (dialpad) dialpad.classList.toggle('muted', muted);
  if (muteBtn) {
    muteBtn.classList.toggle('active', muted);
    muteBtn.setAttribute('aria-pressed', String(muted));
    muteBtn.textContent = muted ? '🔇 Unmute' : '🔔 Mute';
  }
}

const muteBtn = document.getElementById('muteBtn');
if (muteBtn) muteBtn.addEventListener('click', () => setMuteState(!isMuted));

// ═══════════════════════════════════════════════════════════════════════════
// 4. DIALER — digit entry, display, keyboard, backspace long-press
// ═══════════════════════════════════════════════════════════════════════════

let dialedNumber = '';

function updateDialerDisplay() {
  const display = document.getElementById('dialerDisplay');
  const live    = document.getElementById('numberBeingDialed');
  if (display) display.textContent = dialedNumber || ' ';
  if (live)    live.textContent    = dialedNumber  ? `Dialing: ${dialedNumber}` : '';
}

function dialDigit(digit) {
  dialedNumber += String(digit);
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

document.querySelectorAll('[data-digit]').forEach(btn => {
  btn.addEventListener('click', () => dialDigit(btn.dataset.digit));
});

document.addEventListener('keydown', e => {
  if (/^[0-9*#+]$/.test(e.key)) {
    dialDigit(e.key);
  } else if (e.key === 'Backspace') {
    e.preventDefault();
    clearLastDigit();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    initiateCall();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    if (callActive) endCall(); else clearDialed();
  }
});

const backspaceBtn = document.getElementById('backspaceBtn');
if (backspaceBtn) {
  const LONG_PRESS_MS = 600;
  let longPressTimer  = null;

  function startLongPress() {
    longPressTimer = setTimeout(() => { clearDialed(); longPressTimer = null; }, LONG_PRESS_MS);
  }

  function cancelLongPress(didClear) {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
      if (!didClear) clearLastDigit();
    }
  }

  backspaceBtn.addEventListener('pointerdown',   startLongPress);
  backspaceBtn.addEventListener('pointerup',     () => cancelLongPress(false));
  backspaceBtn.addEventListener('pointercancel', () => cancelLongPress(true));
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. CALLER ID NAME
// ═══════════════════════════════════════════════════════════════════════════

let callerIdName = '';

const callerIdInput   = document.getElementById('callerIdInput');
const callerIdSaveBtn = document.getElementById('callerIdSave');
const callerIdStatus  = document.getElementById('callerIdStatus');

if (callerIdSaveBtn) {
  callerIdSaveBtn.addEventListener('click', () => {
    callerIdName = (callerIdInput ? callerIdInput.value.trim() : '') || '';
    if (callerIdStatus) {
      callerIdStatus.textContent = callerIdName
        ? `Caller ID set: "${callerIdName}"`
        : 'Caller ID cleared (number will be shown).';
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. MICROPHONE PERMISSION PRE-CHECK
// ═══════════════════════════════════════════════════════════════════════════

const micPermissionStatus = document.getElementById('micPermissionStatus');

async function checkMicPermission() {
  if (!micPermissionStatus) return;
  if (navigator.permissions) {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' });
      updateMicPermissionUI(result.state);
      result.onchange = () => updateMicPermissionUI(result.state);
      return;
    } catch (_) {}
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    updateMicPermissionUI('granted');
  } catch (err) {
    updateMicPermissionUI(err.name === 'NotAllowedError' ? 'denied' : 'prompt');
  }
}

function updateMicPermissionUI(state) {
  if (!micPermissionStatus) return;
  const map = {
    granted: { text: '🎤 Microphone access granted.',                                    cls: 'perm-granted' },
    denied:  { text: '🚫 Microphone access denied. Check your browser / app settings.', cls: 'perm-denied'  },
    prompt:  { text: '❓ Microphone permission not yet granted.',                         cls: 'perm-prompt'  },
  };
  const info = map[state] || map['prompt'];
  micPermissionStatus.textContent = info.text;
  micPermissionStatus.className   = `mic-permission-status ${info.cls}`;
}

window.addEventListener('micPermissionGranted', () => updateMicPermissionUI('granted'));
window.addEventListener('micPermissionDenied',  () => updateMicPermissionUI('denied'));

checkMicPermission();

// ═══════════════════════════════════════════════════════════════════════════
// 7. OUTGOING CALL AUDIO + ANDROID AUDIO BRIDGE
// ═══════════════════════════════════════════════════════════════════════════

let callActive   = false;
let localStream  = null;
let audioContext = null;
let callGainNode = null;
let micMuted     = false;

// ── Android Audio Bridge ─────────────────────────────────────────────────

/**
 * Notify the Android native layer that a call has started.
 * The native layer will request audio focus and route audio to the best
 * available output device (Bluetooth SCO/A2DP, wired headset, or speaker).
 */
function notifyAndroidCallStarted() {
  if (window.AndroidAudio && typeof window.AndroidAudio.onCallStarted === 'function') {
    window.AndroidAudio.onCallStarted();
  }
}

/** Notify the Android native layer that the call has ended. */
function notifyAndroidCallEnded() {
  if (window.AndroidAudio && typeof window.AndroidAudio.onCallEnded === 'function') {
    window.AndroidAudio.onCallEnded();
  }
}

/** Query the current audio output device label from the Android native layer. */
function getAndroidOutputDevice() {
  if (window.AndroidAudio && typeof window.AndroidAudio.getCurrentOutputDevice === 'function') {
    return window.AndroidAudio.getCurrentOutputDevice();
  }
  return null;
}

/** Returns true when a Bluetooth or wired headset is connected (Android bridge). */
function isAndroidHeadsetConnected() {
  if (window.AndroidAudio && typeof window.AndroidAudio.isHeadsetConnected === 'function') {
    return window.AndroidAudio.isHeadsetConnected();
  }
  return false;
}

// ── Audio-device events dispatched by Android ────────────────────────────

window.addEventListener('audioDeviceConnected', e => {
  const name = e.detail && e.detail.name ? e.detail.name : 'Headset';
  showCallStatus(`🎧 Audio device connected: ${name}`);
  updateNetworkTypeBadge();
});

window.addEventListener('audioDeviceDisconnected', e => {
  const name = e.detail && e.detail.name ? e.detail.name : 'Headset';
  showCallStatus(`⚠️ Audio device disconnected: ${name}. Using speaker.`);
  updateNetworkTypeBadge();
});

window.addEventListener('audioOutputRouted', e => {
  if (e.detail) {
    const { device, fallback } = e.detail;
    if (device) {
      updateNetworkTypeBadgeWithLabel(device);
      if (fallback) showCallStatus(`⚠️ Headset disconnected — audio rerouted to: ${device}`);
    }
  }
});

window.addEventListener('bluetoothScoConnected',    () => { showCallStatus('🦷 Bluetooth HFP connected — audio routed to headset.'); updateNetworkTypeBadge(); });
window.addEventListener('bluetoothScoDisconnected', () => { showCallStatus('🦷 Bluetooth HFP disconnected — audio routed to speaker.'); updateNetworkTypeBadge(); });

// ── Headset hardware-button events (MediaSession → Android → JS) ──────────

window.addEventListener('mediaButtonPlay',  () => { if (!callActive && dialedNumber.trim()) initiateCall(); });
window.addEventListener('mediaButtonPause', () => { if (callActive) toggleMicMute(); });
window.addEventListener('mediaButtonStop',  () => { if (callActive) endCall(); });

window.addEventListener('audioFocusLost',   () => { if (callActive && !micMuted) toggleMicMute(); });
window.addEventListener('audioFocusGained', () => { if (callActive && micMuted)  toggleMicMute(); });

// ── AudioContext ──────────────────────────────────────────────────────────

function createCallAudioContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try { return new Ctx({ latencyHint: 'interactive', sampleRate: 16000 }); }
  catch (_) { return new Ctx(); }
}

// ── Call lifecycle ────────────────────────────────────────────────────────

async function initiateCall() {
  if (callActive) return;
  const number = dialedNumber.trim();
  if (!number) { showCallStatus('Enter a number to dial.'); return; }

  showCallStatus('Requesting microphone…');

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
  } catch (err) {
    showCallStatus(
      err.name === 'NotAllowedError'
        ? '🚫 Microphone denied. Check permissions.'
        : `Microphone error: ${err.message}`
    );
    return;
  }

  localStream  = stream;
  callActive   = true;
  micMuted     = false;

  audioContext = createCallAudioContext();
  if (audioContext) {
    callGainNode = audioContext.createGain();
    callGainNode.gain.value = 1.0;
    const src = audioContext.createMediaStreamSource(stream);
    src.connect(callGainNode);
    callGainNode.connect(audioContext.destination);
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  }

  // Tell Android to route call audio to BT earbuds / wired headset
  notifyAndroidCallStarted();

  updateCallUI(true);
  startCallTimer();
  updateNetworkTypeBadge();
  showCallStatus(`Calling ${number}…`);

  const nativeDevice = getAndroidOutputDevice();
  if (nativeDevice) updateNetworkTypeBadgeWithLabel(nativeDevice);
}

function endCall() {
  if (!callActive) return;
  callActive = false;
  if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
  if (audioContext) { audioContext.close().catch(() => {}); audioContext = null; callGainNode = null; }
  notifyAndroidCallEnded();
  stopCallTimer();
  updateCallUI(false);
  showCallStatus('Call ended.');
  updateNetworkTypeBadge();
}

function showCallStatus(msg) {
  const el = document.getElementById('callStatus');
  if (el) el.textContent = msg;
}

function updateCallUI(active) {
  const callBtn     = document.getElementById('callBtn');
  const endCallBtn  = document.getElementById('endCallBtn');
  const inCallCtrls = document.getElementById('inCallControls');
  if (callBtn)     callBtn.style.display     = active ? 'none' : '';
  if (endCallBtn)  endCallBtn.style.display  = active ? ''     : 'none';
  if (inCallCtrls) inCallCtrls.style.display = active ? ''     : 'none';
}

const callBtn    = document.getElementById('callBtn');
const endCallBtn = document.getElementById('endCallBtn');
if (callBtn)    callBtn.addEventListener('click', initiateCall);
if (endCallBtn) endCallBtn.addEventListener('click', endCall);

// ═══════════════════════════════════════════════════════════════════════════
// 8. CALL DURATION TIMER
// ═══════════════════════════════════════════════════════════════════════════

let callStartTime   = 0;
let callTimerHandle = null;

function startCallTimer() { callStartTime = Date.now(); callTimerHandle = setInterval(tickCallTimer, 500); }
function stopCallTimer()  { if (callTimerHandle) { clearInterval(callTimerHandle); callTimerHandle = null; } }

function tickCallTimer() {
  const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
  const h = Math.floor(elapsed / 3600), m = Math.floor((elapsed % 3600) / 60), s = elapsed % 60;
  showCallStatus(h > 0 ? `${pad2(h)}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`);
}

function pad2(n) { return String(n).padStart(2, '0'); }

// ═══════════════════════════════════════════════════════════════════════════
// 9. NETWORK-TYPE BADGE
// ═══════════════════════════════════════════════════════════════════════════

function updateNetworkTypeBadge() {
  const el = document.getElementById('networkTypeIndicator');
  if (!el) return;
  if (!callActive) { el.style.display = 'none'; return; }

  const nativeDevice = getAndroidOutputDevice();
  if (nativeDevice) { updateNetworkTypeBadgeWithLabel(nativeDevice); return; }

  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  let label = 'Unknown';
  if (!navigator.onLine) { label = 'Offline'; }
  else if (conn) {
    if      (conn.type === 'wifi')    label = 'WiFi';
    else if (conn.type === 'cellular' || ['4g','3g','2g','slow-2g'].includes(conn.effectiveType))
      label = (conn.effectiveType || conn.type || 'Cellular').toUpperCase();
    else if (conn.type)         label = conn.type.charAt(0).toUpperCase() + conn.type.slice(1);
    else if (conn.effectiveType) label = conn.effectiveType.toUpperCase();
  } else if (navigator.onLine) { label = 'WiFi'; }

  el.textContent   = label;
  el.style.display = '';
}

function updateNetworkTypeBadgeWithLabel(label) {
  const el = document.getElementById('networkTypeIndicator');
  if (!el) return;
  el.textContent   = label;
  el.style.display = callActive ? '' : 'none';
}

if (navigator.connection) navigator.connection.addEventListener('change', updateNetworkTypeBadge);

// ═══════════════════════════════════════════════════════════════════════════
// 10. CONNECTIVITY PANEL
// ═══════════════════════════════════════════════════════════════════════════

const PROBE_URL        = 'https://www.google.com/generate_204';
const PROBE_TIMEOUT_MS = 5000;
const BACKOFF_BASE_MS  = 2000;
const BACKOFF_MAX_MS   = 60000;

let probeBackoffDelay = BACKOFF_BASE_MS;
let probeTimer        = null;

function connectivityTimestamp() {
  return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(new Date());
}

function updateConnectivityUI(online, message) {
  const statusEl    = document.getElementById('connectivityStatus');
  const timestampEl = document.getElementById('connectivityTimestamp');
  if (statusEl) { statusEl.textContent = online ? '🟢 Online' : '🔴 Offline'; statusEl.className = `connectivity-status ${online ? 'online' : 'offline'}`; }
  if (timestampEl) timestampEl.textContent = `Last checked: ${connectivityTimestamp()}${message ? ' — ' + message : ''}`;
}

async function probeConnectivity() {
  try {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    await fetch(PROBE_URL, { method: 'HEAD', mode: 'no-cors', signal: ctrl.signal });
    clearTimeout(tid);
    probeBackoffDelay = BACKOFF_BASE_MS;
    updateConnectivityUI(true, 'Probe OK');
  } catch (_) {
    updateConnectivityUI(false, 'Probe failed');
    probeBackoffDelay = Math.min(probeBackoffDelay * 2, BACKOFF_MAX_MS);
  } finally { scheduleNextProbe(); }
}

function scheduleNextProbe() { if (probeTimer) clearTimeout(probeTimer); probeTimer = setTimeout(probeConnectivity, probeBackoffDelay); }

window.addEventListener('online',  () => { updateConnectivityUI(true,  'Browser online event');  probeBackoffDelay = BACKOFF_BASE_MS; probeConnectivity(); });
window.addEventListener('offline', () => { updateConnectivityUI(false, 'Browser offline event'); scheduleNextProbe(); });

probeConnectivity();

function updateAvailableNetworks() {
  const listEl = document.getElementById('networkList');
  if (!listEl) return;
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) { listEl.innerHTML = '<li>Network information not available in this browser.</li>'; return; }
  const entries = [];
  if (conn.type)             entries.push(`Type: ${conn.type}`);
  if (conn.effectiveType)    entries.push(`Effective: ${conn.effectiveType.toUpperCase()}`);
  if (conn.downlink)         entries.push(`Downlink: ${conn.downlink} Mbps`);
  if (conn.rtt !== undefined) entries.push(`RTT: ${conn.rtt} ms`);
  const nativeDevice = getAndroidOutputDevice();
  if (nativeDevice) entries.push(`Audio output: ${nativeDevice}`);
  listEl.innerHTML = entries.length ? entries.map(e => `<li>${e}</li>`).join('') : '<li>No network info available.</li>';
}

if (navigator.connection) navigator.connection.addEventListener('change', updateAvailableNetworks);
updateAvailableNetworks();

// ═══════════════════════════════════════════════════════════════════════════
// 11. MOBILE NETWORK
// ═══════════════════════════════════════════════════════════════════════════

let preferMobileNetwork   = false;
const mobileNetworkToggle = document.getElementById('mobileNetworkToggle');
const mobileNetworkStatus = document.getElementById('mobileNetworkStatus');

function detectMobileNetwork() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return conn ? (conn.type === 'cellular' || ['4g','3g','2g','slow-2g'].includes(conn.effectiveType)) : false;
}

function updateMobileNetworkUI() {
  if (!mobileNetworkStatus) return;
  const available = detectMobileNetwork();
  const conn = navigator.connection || {};
  mobileNetworkStatus.textContent = available
    ? `Mobile network available (${(conn.effectiveType || conn.type || 'cellular').toUpperCase()}).`
    : 'No mobile network detected.';
}

if (mobileNetworkToggle) mobileNetworkToggle.addEventListener('change', e => { preferMobileNetwork = e.target.checked; updateMobileNetworkUI(); });
updateMobileNetworkUI();

// ═══════════════════════════════════════════════════════════════════════════
// 12. CALL VOLUME INDICATOR
// ═══════════════════════════════════════════════════════════════════════════

const volumeIndicator = document.getElementById('callVolumeIndicator');

function updateVolumeIndicator(volume) {
  if (!volumeIndicator || !callActive) return;
  volumeIndicator.textContent   = `🔊 ${Math.round(volume * 100)}%`;
  volumeIndicator.style.display = '';
}

document.addEventListener('keydown', e => {
  if (!callActive) return;
  if (e.key === 'VolumeUp'   || e.key === 'AudioVolumeUp')   { e.preventDefault(); if (callGainNode) { callGainNode.gain.value = Math.min(1.0, callGainNode.gain.value + 0.1); updateVolumeIndicator(callGainNode.gain.value); } }
  if (e.key === 'VolumeDown' || e.key === 'AudioVolumeDown') { e.preventDefault(); if (callGainNode) { callGainNode.gain.value = Math.max(0,   callGainNode.gain.value - 0.1); updateVolumeIndicator(callGainNode.gain.value); } }
});

// ═══════════════════════════════════════════════════════════════════════════
// 13. IN-CALL MICROPHONE MUTE
// ═══════════════════════════════════════════════════════════════════════════

const micMuteBtn = document.getElementById('micMuteBtn');

function toggleMicMute() {
  if (!localStream) return;
  micMuted = !micMuted;
  localStream.getAudioTracks().forEach(t => { t.enabled = !micMuted; });
  if (micMuteBtn) {
    micMuteBtn.textContent = micMuted ? '🎤 Unmute Mic' : '🎤 Mute Mic';
    micMuteBtn.classList.toggle('muted', micMuted);
    micMuteBtn.setAttribute('aria-pressed', String(micMuted));
  }
  showCallStatus(micMuted ? 'Mic muted.' : 'Mic active.');
}

if (micMuteBtn) micMuteBtn.addEventListener('click', toggleMicMute);

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════════════════

function isAndroid() { return /Android/i.test(navigator.userAgent); }
