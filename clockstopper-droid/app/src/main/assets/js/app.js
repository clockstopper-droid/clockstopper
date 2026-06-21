/**
 * app.js — Global Time Clock / Dialer
 * ─────────────────────────────────────────────────────────────────────────
 * All application logic for the WebView-based Android dialer:
 *   • Three fixed world clocks (Eastern, Central, Western)
 *   • Connectivity panel with exponential-backoff probe & timestamps
 *   • Mobile network selection
 *   • Microphone permission pre-check
 *   • Caller ID name
 *   • Dialer UI with physical + virtual keyboard input
 *   • Call audio via Web Audio API / MediaDevices
 *   • Call duration timer
 *   • Network type badge
 *   • Backspace long-press to clear
 *   • Dark-theme persistence via localStorage
 *   • Call volume indicator — adjusts on hardware volume key press
 *     (volume keys are bridged from Android MainActivity via
 *      window.adjustCallVolume(delta))
 * ─────────────────────────────────────────────────────────────────────────
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   1. CONSTANTS & MODULE-LEVEL STATE
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Clocks ──────────────────────────────────────────────────────────────────
const CLOCKS = [
  { id: 'eastern', label: 'Eastern', tz: 'America/New_York'    },
  { id: 'central', label: 'Central', tz: 'America/Chicago'     },
  { id: 'western', label: 'Western', tz: 'America/Los_Angeles' },
];

// ── Connectivity probe ───────────────────────────────────────────────────────
const PROBE_URL             = 'https://www.google.com/generate_204';
const PROBE_INITIAL_DELAY   = 2000;   // ms — first retry after failure
const PROBE_MAX_DELAY       = 60000;  // ms — backoff ceiling
const PROBE_TIMEOUT         = 5000;   // ms — fetch timeout

// ── Backspace long-press ─────────────────────────────────────────────────────
const LONG_PRESS_THRESHOLD  = 600;    // ms

// ── Volume indicator ─────────────────────────────────────────────────────────
/** Number of volume steps between 0 and 1 (exclusive). */
const VOLUME_STEPS          = 16;
/** How long (ms) the volume indicator remains visible after the last key. */
const VOLUME_HIDE_DELAY     = 2500;

// ── App state ────────────────────────────────────────────────────────────────
let dialedNumber      = '';
let isMuted           = false;
let isInCall          = false;
let callStartTime     = null;
let callTimerInterval = null;
let audioContext      = null;
let callGainNode      = null;      // GainNode that controls call audio level
let callStream        = null;      // MediaStream from getUserMedia
let callerIdName      = '';

// Volume state — value in [0, 1] representing the current call volume.
let callVolume        = 0.8;       // default 80 %
let volumeHideTimer   = null;      // setTimeout handle for auto-hiding indicator

// Connectivity probe backoff state
let probeDelay        = PROBE_INITIAL_DELAY;
let probeRetryTimer   = null;

// Network preference selected by the user
let preferredNetwork  = 'auto';


/* ═══════════════════════════════════════════════════════════════════════════
   2. DOM REFERENCES
   ═══════════════════════════════════════════════════════════════════════════ */

const $ = id => document.getElementById(id);

const elDialNumber         = $('dialNumber');
const elDialReadout        = $('dialReadout');
const elCallStatus         = $('callStatus');
const elNetworkTypeInd     = $('networkTypeIndicator');
const elCallBtn            = $('callBtn');
const elEndCallBtn         = $('endCallBtn');
const elBackspaceBtn       = $('backspaceBtn');
const elMuteBtn            = $('muteBtn');
const elProbeBtn           = $('probeBtn');
const elThemeBtn           = $('themeToggleBtn');
const elConnStatus         = $('connectivityStatus');
const elConnBadge          = $('connectivityBadge');
const elConnType           = $('connectionType');
const elConnTimestamp      = $('connectivityTimestamp');
const elNetworkSelect      = $('networkSelect');
const elCallerIdInput      = $('callerIdInput');
const elCallerIdSaveBtn    = $('callerIdSaveBtn');
const elCallerIdSaved      = $('callerIdSaved');
const elMicPermStatus      = $('micPermissionStatus');

// Volume indicator elements
const elVolumeIndicator    = $('volumeIndicator');
const elVolumeBarFill      = $('volumeBarFill');
const elVolumePercent      = $('volumePercent');
const elVolumeBarTrack     = elVolumeIndicator
                               ? elVolumeIndicator.querySelector('.volume-bar-track')
                               : null;


/* ═══════════════════════════════════════════════════════════════════════════
   3. CLOCK DISPLAY
   ═══════════════════════════════════════════════════════════════════════════ */

function updateClocks() {
  const now = new Date();
  CLOCKS.forEach(({ id, tz }) => {
    const timeStr = new Intl.DateTimeFormat('en-US', {
      timeZone   : tz,
      hour       : '2-digit',
      minute     : '2-digit',
      second     : '2-digit',
      hour12     : false,
    }).format(now);

    const dateStr = new Intl.DateTimeFormat('en-US', {
      timeZone : tz,
      weekday  : 'short',
      month    : 'short',
      day      : 'numeric',
    }).format(now);

    const timeEl = $(`time-${id}`);
    const dateEl = $(`date-${id}`);
    if (timeEl) timeEl.textContent = timeStr;
    if (dateEl) dateEl.textContent = dateStr;
  });
}

setInterval(updateClocks, 1000);
updateClocks();


/* ═══════════════════════════════════════════════════════════════════════════
   4. CONNECTIVITY — probe with exponential backoff & timestamps
   ═══════════════════════════════════════════════════════════════════════════ */

function fmtTimestamp(date) {
  if (!date) return '—';
  return date.toLocaleTimeString('en-US', { hour12: false });
}

function setConnTimestamp() {
  if (elConnTimestamp) elConnTimestamp.textContent = fmtTimestamp(new Date());
}

function setConnUI(online, label) {
  if (elConnStatus) elConnStatus.textContent = label;
  if (elConnBadge) {
    elConnBadge.textContent = online ? 'Online' : 'Offline';
    elConnBadge.className   = `badge badge--${online ? 'online' : 'offline'}`;
  }
  setConnTimestamp();
  updateConnectionType();
}

function updateConnectionType() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!elConnType) return;
  if (conn) {
    const type    = conn.type          || '—';
    const effType = conn.effectiveType || '';
    elConnType.textContent = effType ? `${type} (${effType})` : type;
  } else {
    elConnType.textContent = navigator.onLine ? 'Online' : 'Offline';
  }
}

async function runConnectivityProbe() {
  try {
    const ctrl     = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT);
    const resp     = await fetch(PROBE_URL, {
      method : 'HEAD',
      cache  : 'no-store',
      signal : ctrl.signal,
    });
    clearTimeout(timeoutId);

    if (resp.ok || resp.status === 204) {
      probeDelay = PROBE_INITIAL_DELAY; // reset backoff on success
      setConnUI(true, 'Connected');
    } else {
      scheduleProbeRetry();
      setConnUI(false, `Probe failed (${resp.status})`);
    }
  } catch {
    scheduleProbeRetry();
    setConnUI(false, 'Probe failed');
  }
}

function scheduleProbeRetry() {
  clearTimeout(probeRetryTimer);
  probeRetryTimer = setTimeout(() => {
    runConnectivityProbe();
    probeDelay = Math.min(probeDelay * 2, PROBE_MAX_DELAY);
  }, probeDelay);
}

window.addEventListener('online', () => {
  clearTimeout(probeRetryTimer);
  probeDelay = PROBE_INITIAL_DELAY;
  setConnUI(true, 'Online');
  runConnectivityProbe();
});

window.addEventListener('offline', () => {
  clearTimeout(probeRetryTimer);
  setConnUI(false, 'Offline');
});

if (elProbeBtn) {
  elProbeBtn.addEventListener('click', () => {
    clearTimeout(probeRetryTimer);
    probeDelay = PROBE_INITIAL_DELAY;
    setConnUI(navigator.onLine, 'Checking…');
    runConnectivityProbe();
  });
}

const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
if (conn) {
  conn.addEventListener('change', () => {
    updateConnectionType();
    if (isInCall) updateNetworkTypeBadge();
  });
}

// Initial probe on load
runConnectivityProbe();


/* ═══════════════════════════════════════════════════════════════════════════
   5. NETWORK PREFERENCE
   ═══════════════════════════════════════════════════════════════════════════ */

if (elNetworkSelect) {
  elNetworkSelect.addEventListener('change', e => {
    preferredNetwork = e.target.value;
  });
}


/* ═══════════════════════════════════════════════════════════════════════════
   6. MICROPHONE PERMISSION PRE-CHECK
   ═══════════════════════════════════════════════════════════════════════════ */

async function checkMicPermission() {
  if (!elMicPermStatus) return;

  if (navigator.permissions) {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' });
      applyMicPermUI(result.state);
      result.onchange = () => applyMicPermUI(result.state);
      return;
    } catch { /* fall through to getUserMedia probe */ }
  }

  // Fallback: probe getUserMedia
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    applyMicPermUI('granted');
  } catch (err) {
    applyMicPermUI(err.name === 'NotAllowedError' ? 'denied' : 'prompt');
  }
}

function applyMicPermUI(state) {
  if (!elMicPermStatus) return;
  elMicPermStatus.className = `mic-permission-status ${state}`;
  const messages = {
    granted : '🎙 Microphone access granted.',
    prompt  : '🎙 Microphone permission not yet granted — you will be asked when dialing.',
    denied  : '🎙 Microphone access denied. Please enable it in Android Settings → App Permissions.',
  };
  elMicPermStatus.textContent = messages[state] || '';
}

checkMicPermission();


/* ═══════════════════════════════════════════════════════════════════════════
   7. CALLER ID NAME
   ═══════════════════════════════════════════════════════════════════════════ */

if (elCallerIdSaveBtn) {
  elCallerIdSaveBtn.addEventListener('click', saveCallerIdName);
}

if (elCallerIdInput) {
  elCallerIdInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveCallerIdName();
  });
}

function saveCallerIdName() {
  const val = elCallerIdInput ? elCallerIdInput.value.trim() : '';
  callerIdName = val;
  if (elCallerIdSaved) {
    elCallerIdSaved.textContent = val ? `Saved: "${val}"` : 'Cleared.';
    setTimeout(() => { if (elCallerIdSaved) elCallerIdSaved.textContent = ''; }, 3000);
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
   8. DIALER — digit entry, display, keyboard
   ═══════════════════════════════════════════════════════════════════════════ */

function dialDigit(digit) {
  if (!isInCall && dialedNumber.length < 20) {
    dialedNumber += digit;
    updateDialDisplay();
  }
}

function clearLastDigit() {
  if (dialedNumber.length > 0) {
    dialedNumber = dialedNumber.slice(0, -1);
    updateDialDisplay();
  }
}

function clearDialed() {
  dialedNumber = '';
  updateDialDisplay();
}

function updateDialDisplay() {
  if (elDialNumber) {
    elDialNumber.textContent = dialedNumber || '\u00a0';
  }
  if (elDialReadout) {
    elDialReadout.textContent = dialedNumber ? `Dialing: ${dialedNumber}` : '';
  }
}

// Keypad button clicks
document.querySelectorAll('.key-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const digit = btn.dataset.digit;
    if (digit) dialDigit(digit);
  });
});

// Physical / software keyboard input
document.addEventListener('keydown', e => {
  if (e.target === elCallerIdInput) return; // don't intercept when typing name

  if (/^[0-9*#+]$/.test(e.key)) {
    dialDigit(e.key);
  } else if (e.key === 'Backspace') {
    e.preventDefault();
    clearLastDigit();
  } else if (e.key === 'Delete') {
    clearDialed();
  } else if (e.key === 'Enter') {
    if (isInCall) endCall(); else initiateCall();
  } else if (e.key === 'Escape') {
    if (isInCall) endCall(); else clearDialed();
  }
});


/* ═══════════════════════════════════════════════════════════════════════════
   9. BACKSPACE — short tap vs long-press
   ═══════════════════════════════════════════════════════════════════════════ */

let longPressTimer = null;
let longPressFired = false;

function startLongPress() {
  longPressFired = false;
  longPressTimer = setTimeout(() => {
    longPressFired = true;
    clearDialed();
  }, LONG_PRESS_THRESHOLD);
}

function endLongPress() {
  clearTimeout(longPressTimer);
  if (!longPressFired) clearLastDigit();
}

if (elBackspaceBtn) {
  elBackspaceBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    startLongPress();
  });
  elBackspaceBtn.addEventListener('pointerup',     endLongPress);
  elBackspaceBtn.addEventListener('pointercancel', () => clearTimeout(longPressTimer));
  // Prevent context menu on long-press (Android)
  elBackspaceBtn.addEventListener('contextmenu', e => e.preventDefault());
}


/* ═══════════════════════════════════════════════════════════════════════════
   10. CALL AUDIO — AudioContext + GainNode
   ═══════════════════════════════════════════════════════════════════════════ */

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

function createCallGain() {
  const ctx = ensureAudioContext();
  callGainNode = ctx.createGain();
  callGainNode.gain.value = callVolume;
  callGainNode.connect(ctx.destination);
  return callGainNode;
}

function destroyCallGain() {
  if (callGainNode) {
    try { callGainNode.disconnect(); } catch {}
    callGainNode = null;
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
   11. NETWORK TYPE BADGE
   ═══════════════════════════════════════════════════════════════════════════ */

function updateNetworkTypeBadge() {
  if (!elNetworkTypeInd) return;
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  let label = 'Unknown';

  if (c) {
    if (c.type === 'wifi')     label = 'WiFi';
    else if (c.type === 'cellular') {
      label = c.effectiveType ? c.effectiveType.toUpperCase() : 'Cellular';
    } else if (c.type) {
      label = c.type;
    } else if (c.effectiveType) {
      label = c.effectiveType.toUpperCase();
    }
  } else if (navigator.onLine) {
    label = 'Online';
  }

  elNetworkTypeInd.textContent = label;
}


/* ═══════════════════════════════════════════════════════════════════════════
   12. CALL DURATION TIMER
   ═══════════════════════════════════════════════════════════════════════════ */

function startCallTimer() {
  callStartTime     = Date.now();
  callTimerInterval = setInterval(updateCallTimer, 500);
  updateCallTimer();
}

function stopCallTimer() {
  clearInterval(callTimerInterval);
  callTimerInterval = null;
}

function updateCallTimer() {
  if (!callStartTime || !elCallStatus) return;
  const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const pad = n => String(n).padStart(2, '0');
  elCallStatus.textContent = h > 0
    ? `${pad(h)}:${pad(m)}:${pad(s)}`
    : `${pad(m)}:${pad(s)}`;
}


/* ═══════════════════════════════════════════════════════════════════════════
   13. VOLUME INDICATOR
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Render the volume indicator with the current callVolume value.
 * Shows the indicator, updates the bar fill width, percentage text, and
 * ARIA attributes.  Schedules auto-hide after VOLUME_HIDE_DELAY ms.
 */
function showVolumeIndicator() {
  if (!elVolumeIndicator) return;

  const pct = Math.round(callVolume * 100);

  // Update fill width
  if (elVolumeBarFill) {
    elVolumeBarFill.style.width = `${pct}%`;
    // Color cues
    elVolumeBarFill.classList.toggle('volume--low', pct <= 15);
    elVolumeBarFill.classList.toggle('volume--max', pct >= 100);
  }

  // Update percentage label
  if (elVolumePercent) {
    elVolumePercent.textContent = `${pct}%`;
  }

  // Update ARIA
  if (elVolumeBarTrack) {
    elVolumeBarTrack.setAttribute('aria-valuenow', pct);
  }

  // Show the element
  elVolumeIndicator.classList.remove('fading-out');
  elVolumeIndicator.removeAttribute('hidden');

  // Schedule auto-hide
  clearTimeout(volumeHideTimer);
  volumeHideTimer = setTimeout(hideVolumeIndicator, VOLUME_HIDE_DELAY);
}

/**
 * Fade-out and then hide the volume indicator.
 */
function hideVolumeIndicator() {
  if (!elVolumeIndicator) return;
  elVolumeIndicator.classList.add('fading-out');
  // After the CSS transition completes (~300 ms) apply hidden
  setTimeout(() => {
    if (elVolumeIndicator) {
      elVolumeIndicator.setAttribute('hidden', '');
      elVolumeIndicator.classList.remove('fading-out');
    }
  }, 350);
}

/**
 * Immediately hide the volume indicator without transition (used on call end).
 */
function forceHideVolumeIndicator() {
  clearTimeout(volumeHideTimer);
  if (elVolumeIndicator) {
    elVolumeIndicator.classList.remove('fading-out');
    elVolumeIndicator.setAttribute('hidden', '');
  }
}

/**
 * Apply callVolume to the Web Audio GainNode if one exists.
 */
function applyVolumeToGain() {
  if (callGainNode) {
    callGainNode.gain.value = isMuted ? 0 : callVolume;
  }
}

/**
 * Adjust call volume by `delta` steps (each step = 1/VOLUME_STEPS).
 * Clamps to [0, 1].  Updates the gain node and shows the indicator.
 *
 * This is the entry-point called by the Android ↔ JS volume key bridge.
 * It is also exposed on `window` so WebAppFragment.kt can invoke it via
 * evaluateJavascript.
 *
 * @param {number} delta  +1 for volume-up, -1 for volume-down.
 */
function adjustCallVolume(delta) {
  if (!isInCall) return;

  const step = 1 / VOLUME_STEPS;
  callVolume = Math.min(1, Math.max(0, callVolume + delta * step));

  applyVolumeToGain();
  showVolumeIndicator();
}

// Expose on window so the Android bridge can call it via evaluateJavascript
window.adjustCallVolume = adjustCallVolume;


/* ═══════════════════════════════════════════════════════════════════════════
   14. CALL LIFECYCLE — initiate / end
   ═══════════════════════════════════════════════════════════════════════════ */

async function initiateCall() {
  if (isInCall || !dialedNumber) return;

  try {
    callStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    applyMicPermUI('granted');
  } catch (err) {
    const state = err.name === 'NotAllowedError' ? 'denied' : 'prompt';
    applyMicPermUI(state);
    if (elCallStatus) elCallStatus.textContent = 'Microphone unavailable.';
    return;
  }

  isInCall = true;
  // Expose call-active flag for the Android volume key bridge
  window.clockstopperCallActive = true;

  createCallGain();
  applyVolumeToGain();

  // Wire microphone stream into the audio graph
  const ctx  = ensureAudioContext();
  const src  = ctx.createMediaStreamSource(callStream);
  src.connect(callGainNode);

  if (elCallBtn)    elCallBtn.setAttribute('hidden', '');
  if (elEndCallBtn) elEndCallBtn.removeAttribute('hidden');

  if (elNetworkTypeInd) {
    updateNetworkTypeBadge();
    elNetworkTypeInd.removeAttribute('hidden');
  }

  startCallTimer();

  // Show the volume indicator briefly at call start
  showVolumeIndicator();
}

function endCall() {
  if (!isInCall) return;

  isInCall = false;
  window.clockstopperCallActive = false;

  // Stop mic tracks
  if (callStream) {
    callStream.getTracks().forEach(t => t.stop());
    callStream = null;
  }

  destroyCallGain();
  stopCallTimer();

  if (elCallBtn)    elCallBtn.removeAttribute('hidden');
  if (elEndCallBtn) elEndCallBtn.setAttribute('hidden', '');

  if (elNetworkTypeInd) elNetworkTypeInd.setAttribute('hidden', '');
  if (elCallStatus)     elCallStatus.textContent = '';

  forceHideVolumeIndicator();
}

if (elCallBtn)    elCallBtn.addEventListener('click',    initiateCall);
if (elEndCallBtn) elEndCallBtn.addEventListener('click', endCall);

if (elMuteBtn) {
  elMuteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    elMuteBtn.setAttribute('aria-pressed', String(isMuted));
    applyVolumeToGain();
  });
}


/* ═══════════════════════════════════════════════════════════════════════════
   15. DARK THEME — toggle & localStorage persistence
   ═══════════════════════════════════════════════════════════════════════════ */

const THEME_KEY = 'darkTheme';

function applyTheme(dark) {
  document.body.classList.toggle('light', !dark);
  if (elThemeBtn) {
    elThemeBtn.textContent = dark ? '🌙 Dark' : '☀️ Light';
  }
}

// Restore on load
(function restoreTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  // Default to dark if no preference stored
  const dark = stored === null ? true : stored === 'true';
  applyTheme(dark);
})();

if (elThemeBtn) {
  elThemeBtn.addEventListener('click', () => {
    const isDark = !document.body.classList.contains('light');
    const newDark = !isDark;
    applyTheme(newDark);
    localStorage.setItem(THEME_KEY, String(newDark));
  });
}
