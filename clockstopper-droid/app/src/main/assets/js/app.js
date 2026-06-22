/**
 * app.js — Global Time Clock (clockstopper)
 * ──────────────────────────────────────────
 * All client-side application logic for the dialer, world clocks, theme,
 * connectivity panel, call audio, mic permission, caller ID name, keyboard
 * input, call duration timer, network type badge, backspace long-press,
 * call volume indicator, mic mute, audio device routing, and overlay
 * permission state management.
 *
 * Overlay permission
 * ──────────────────
 * The Android wrapper fires a `overlayPermissionChanged` CustomEvent on
 * `window` whenever the `SYSTEM_ALERT_WINDOW` permission state changes.
 * This file listens for that event and:
 *   • Shows the overlay-features section when permission is granted.
 *   • Hides / disables overlay-dependent UI when permission is denied,
 *     providing a graceful degradation path so the core app still works.
 *   • Shows an "Enable overlay" button when permission has been permanently
 *     denied, letting the user open system settings from within the app.
 *
 * The `Android` JS interface (injected by WebAppFragment) exposes:
 *   Android.onCallStarted()          — notify native of call start
 *   Android.onCallEnded()            — notify native of call end
 *   Android.requestOverlaySettings() — open system overlay settings page
 *   Android.isOverlayGranted()       — synchronous overlay state check
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Clock display — Eastern, Central, Pacific
// ─────────────────────────────────────────────────────────────────────────────

const CLOCKS = [
  { id: 'clock-eastern',  tz: 'America/New_York',    label: 'Eastern'  },
  { id: 'clock-central',  tz: 'America/Chicago',     label: 'Central'  },
  { id: 'clock-pacific',  tz: 'America/Los_Angeles',  label: 'Pacific'  },
];

function updateClocks() {
  const now = new Date();
  CLOCKS.forEach(({ id, tz }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = new Intl.DateTimeFormat('en-US', {
      timeZone:     tz,
      hour:         '2-digit',
      minute:       '2-digit',
      second:       '2-digit',
      hour12:       true,
    }).format(now);
  });
}

setInterval(updateClocks, 1000);
updateClocks();

// ─────────────────────────────────────────────────────────────────────────────
// 2. Theme — dark / light, persisted in localStorage
// ─────────────────────────────────────────────────────────────────────────────

const THEME_KEY = 'darkTheme';

function applyTheme(isDark) {
  document.body.classList.toggle('dark-theme', isDark);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === null ? true : saved === 'true');
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-theme');
  localStorage.setItem(THEME_KEY, String(isDark));
}

initTheme();

const themeToggleBtn = document.getElementById('themeToggle');
if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

// ─────────────────────────────────────────────────────────────────────────────
// 3. Mute button — silences audio; toggles dialpad neon under-glow
// ─────────────────────────────────────────────────────────────────────────────

let isMuted = false;

function setMuteState(muted) {
  isMuted = muted;
  const dialpad = document.getElementById('dialpad');
  const muteBtn = document.getElementById('muteBtn');
  if (dialpad) dialpad.classList.toggle('mute-active', muted);
  if (muteBtn) {
    muteBtn.textContent = muted ? 'Unmute' : 'Mute';
    muteBtn.setAttribute('aria-pressed', String(muted));
  }
}

const muteBtn = document.getElementById('muteBtn');
if (muteBtn) muteBtn.addEventListener('click', () => setMuteState(!isMuted));

// ─────────────────────────────────────────────────────────────────────────────
// 4. Dialer — digit entry, display, keyboard input
// ─────────────────────────────────────────────────────────────────────────────

let dialedNumber = '';

function updateDialDisplay() {
  const display = document.getElementById('dialDisplay');
  const liveReadout = document.getElementById('dialReadout');
  if (display)    display.textContent   = dialedNumber || '';
  if (liveReadout) liveReadout.textContent = dialedNumber
    ? `Dialing: ${dialedNumber}`
    : '';
}

function dialDigit(digit) {
  dialedNumber += digit;
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

// Keypad buttons
document.querySelectorAll('[data-digit]').forEach(btn => {
  btn.addEventListener('click', () => dialDigit(btn.dataset.digit));
});

// ── Backspace long-press ──────────────────────────────────────────────────────

const LONG_PRESS_MS = 600;
let backspaceLongPressTimer = null;

const backspaceBtn = document.getElementById('backspaceBtn');
if (backspaceBtn) {
  function startLongPress() {
    backspaceLongPressTimer = setTimeout(() => {
      clearDialed();
      backspaceLongPressTimer = null;
    }, LONG_PRESS_MS);
  }

  function cancelLongPress(doShortAction) {
    if (backspaceLongPressTimer !== null) {
      clearTimeout(backspaceLongPressTimer);
      backspaceLongPressTimer = null;
      if (doShortAction) clearLastDigit();
    }
  }

  backspaceBtn.addEventListener('pointerdown',   () => startLongPress());
  backspaceBtn.addEventListener('pointerup',     () => cancelLongPress(true));
  backspaceBtn.addEventListener('pointercancel', () => cancelLongPress(false));
}

// ── Physical / virtual keyboard input ────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.key >= '0' && e.key <= '9') { dialDigit(e.key);  return; }
  if (e.key === '*')       { dialDigit('*');    return; }
  if (e.key === '#')       { dialDigit('#');    return; }
  if (e.key === '+')       { dialDigit('+');    return; }
  if (e.key === 'Backspace') {
    e.preventDefault();
    clearLastDigit();
    return;
  }
  if (e.key === 'Escape')  { clearDialed();    return; }
  if (e.key === 'Enter')   { initiateCall();   return; }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Call state — initiate, connect, end, duration timer, network badge
// ─────────────────────────────────────────────────────────────────────────────

let callActive        = false;
let callStream        = null;  // MediaStream from getUserMedia
let callStartTime     = null;
let callTimerInterval = null;

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
  callStartTime = Date.now();
  callTimerInterval = setInterval(() => {
    const el = document.getElementById('callStatus');
    if (el) el.textContent = `Connected · ${formatElapsed(Date.now() - callStartTime)}`;
  }, 1000);
}

function stopCallTimer() {
  if (callTimerInterval) {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
  }
  callStartTime = null;
}

function updateNetworkBadge() {
  const badge = document.getElementById('networkTypeIndicator');
  if (!badge) return;
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) { badge.textContent = 'Network: Unknown'; return; }
  const type = conn.type === 'cellular'
    ? (conn.effectiveType || 'Cellular').toUpperCase()
    : (conn.type || 'Unknown');
  badge.textContent = `Network: ${type}`;
}

function initiateCall() {
  if (callActive) return;
  if (!dialedNumber) return;

  const statusEl = document.getElementById('callStatus');
  if (statusEl) statusEl.textContent = 'Connecting…';

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      callStream  = stream;
      callActive  = true;

      if (statusEl) statusEl.textContent = 'Connected · 00:00';
      startCallTimer();
      updateNetworkBadge();

      // Notify Android native layer
      if (window.Android && typeof window.Android.onCallStarted === 'function') {
        window.Android.onCallStarted();
      }

      // Restore mic mute state if muted before call
      if (callStream && isMicMuted) {
        callStream.getAudioTracks().forEach(t => { t.enabled = false; });
      }
    })
    .catch(err => {
      console.error('getUserMedia error:', err);
      if (statusEl) statusEl.textContent = `Mic error: ${err.message}`;
    });
}

function endCall() {
  if (!callActive) return;
  callActive = false;

  if (callStream) {
    callStream.getTracks().forEach(t => t.stop());
    callStream = null;
  }
  stopCallTimer();

  const statusEl = document.getElementById('callStatus');
  if (statusEl) statusEl.textContent = 'Call ended';

  const badge = document.getElementById('networkTypeIndicator');
  if (badge) badge.textContent = '';

  // Notify Android native layer
  if (window.Android && typeof window.Android.onCallEnded === 'function') {
    window.Android.onCallEnded();
  }

  isMicMuted = false;
  updateMicMuteButton();
}

const callBtn = document.getElementById('callBtn');
if (callBtn) callBtn.addEventListener('click', initiateCall);

const endCallBtn = document.getElementById('endCallBtn');
if (endCallBtn) endCallBtn.addEventListener('click', endCall);

// Network type badge updates dynamically if network changes mid-call
const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
if (conn) {
  conn.addEventListener('change', () => {
    if (callActive) updateNetworkBadge();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Mic permission pre-check
// ─────────────────────────────────────────────────────────────────────────────

function checkMicPermission() {
  const el = document.getElementById('micPermissionStatus');
  if (!el) return;

  if (!navigator.permissions) {
    el.textContent = 'Mic permission: unknown (Permissions API unavailable)';
    el.className   = 'mic-permission mic-unknown';
    return;
  }

  navigator.permissions.query({ name: 'microphone' })
    .then(result => {
      function update(state) {
        switch (state) {
          case 'granted':
            el.textContent = 'Mic: ready ✓';
            el.className   = 'mic-permission mic-granted';
            break;
          case 'denied':
            el.textContent = 'Mic: blocked — please allow microphone access in browser settings';
            el.className   = 'mic-permission mic-denied';
            break;
          default:
            el.textContent = 'Mic: permission will be requested when you dial';
            el.className   = 'mic-permission mic-prompt';
        }
      }
      update(result.state);
      result.addEventListener('change', () => update(result.state));
    })
    .catch(() => {
      // Fallback: probe getUserMedia directly
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(s => {
          s.getTracks().forEach(t => t.stop());
          el.textContent = 'Mic: ready ✓';
          el.className   = 'mic-permission mic-granted';
        })
        .catch(() => {
          el.textContent = 'Mic: access denied or unavailable';
          el.className   = 'mic-permission mic-denied';
        });
    });
}

checkMicPermission();

// ─────────────────────────────────────────────────────────────────────────────
// 7. Caller ID name
// ─────────────────────────────────────────────────────────────────────────────

let callerIdName = '';

const callerIdInput  = document.getElementById('callerIdInput');
const callerIdSaveBtn = document.getElementById('callerIdSave');

if (callerIdSaveBtn) {
  callerIdSaveBtn.addEventListener('click', () => {
    callerIdName = callerIdInput ? callerIdInput.value.trim() : '';
    const feedback = document.getElementById('callerIdFeedback');
    if (feedback) feedback.textContent = callerIdName
      ? `Caller ID set: "${callerIdName}"`
      : 'Caller ID cleared';
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Connectivity panel — online/offline, probe with exponential backoff
// ─────────────────────────────────────────────────────────────────────────────

const PROBE_URL         = 'https://www.google.com/generate_204';
const PROBE_TIMEOUT_MS  = 5000;
const BACKOFF_BASE_MS   = 2000;
const BACKOFF_MAX_MS    = 60000;

let probeBackoffDelay   = BACKOFF_BASE_MS;
let probeTimer          = null;

function setConnectivityStatus(online, timestamp, detail) {
  const el      = document.getElementById('connectivityStatus');
  const tsEl    = document.getElementById('connectivityTimestamp');
  if (el) {
    el.textContent = online ? `Online${detail ? ' · ' + detail : ''}` : 'Offline';
    el.className   = `connectivity-status ${online ? 'online' : 'offline'}`;
  }
  if (tsEl) tsEl.textContent = `Last checked: ${new Date(timestamp).toLocaleTimeString()}`;
}

async function probeConnectivity() {
  const ts = Date.now();
  try {
    const ctrl = new AbortController();
    const id   = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    const resp = await fetch(PROBE_URL, { method: 'HEAD', mode: 'no-cors', signal: ctrl.signal });
    clearTimeout(id);
    probeBackoffDelay = BACKOFF_BASE_MS;
    setConnectivityStatus(true, ts, 'Probe OK');
  } catch {
    const nextDelay = Math.min(probeBackoffDelay * 2, BACKOFF_MAX_MS);
    probeBackoffDelay = nextDelay;
    setConnectivityStatus(false, ts, 'Probe failed');
    scheduleNextProbe();
  }
}

function scheduleNextProbe() {
  if (probeTimer) clearTimeout(probeTimer);
  probeTimer = setTimeout(probeConnectivity, probeBackoffDelay);
}

window.addEventListener('online',  () => { probeBackoffDelay = BACKOFF_BASE_MS; probeConnectivity(); });
window.addEventListener('offline', () => setConnectivityStatus(false, Date.now()));

probeConnectivity();

// ─────────────────────────────────────────────────────────────────────────────
// 9. Mobile network detection
// ─────────────────────────────────────────────────────────────────────────────

function detectMobileNetwork() {
  const el = document.getElementById('mobileNetworkStatus');
  if (!el) return;
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!c) { el.textContent = 'Network info unavailable'; return; }
  const isCellular = c.type === 'cellular';
  const effType    = c.effectiveType || '';
  el.textContent   = isCellular
    ? `Mobile: ${effType.toUpperCase() || 'Cellular'}`
    : `WiFi / other: ${c.type || 'unknown'}`;
}

detectMobileNetwork();
if (conn) conn.addEventListener('change', detectMobileNetwork);

// ─────────────────────────────────────────────────────────────────────────────
// 10. Call volume indicator
// ─────────────────────────────────────────────────────────────────────────────

function updateVolumeIndicator(level) {
  const el = document.getElementById('callVolumeIndicator');
  if (!el) return;
  const pct = Math.round(Math.max(0, Math.min(1, level)) * 100);
  el.textContent = `Volume: ${pct}%`;
  el.style.setProperty('--vol-pct', `${pct}%`);
}

window.addEventListener('keydown', (e) => {
  if (!callActive) return;
  // Android WebView exposes hardware volume keys as these key values
  if (e.key === 'AudioVolumeUp' || e.key === 'VolumeUp') {
    e.preventDefault();
    const audioEl = document.querySelector('audio');
    if (audioEl) {
      audioEl.volume = Math.min(1, audioEl.volume + 0.1);
      updateVolumeIndicator(audioEl.volume);
    }
  } else if (e.key === 'AudioVolumeDown' || e.key === 'VolumeDown') {
    e.preventDefault();
    const audioEl = document.querySelector('audio');
    if (audioEl) {
      audioEl.volume = Math.max(0, audioEl.volume - 0.1);
      updateVolumeIndicator(audioEl.volume);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. Mic mute (mid-call toggle)
// ─────────────────────────────────────────────────────────────────────────────

let isMicMuted = false;

function updateMicMuteButton() {
  const btn = document.getElementById('micMuteBtn');
  if (!btn) return;
  btn.textContent = isMicMuted ? 'Unmute Mic' : 'Mute Mic';
  btn.classList.toggle('muted', isMicMuted);
  btn.setAttribute('aria-pressed', String(isMicMuted));
}

const micMuteBtn = document.getElementById('micMuteBtn');
if (micMuteBtn) {
  micMuteBtn.addEventListener('click', () => {
    if (!callActive || !callStream) return;
    isMicMuted = !isMicMuted;
    callStream.getAudioTracks().forEach(t => { t.enabled = !isMicMuted; });
    updateMicMuteButton();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. Audio output device selector
// ─────────────────────────────────────────────────────────────────────────────

const AUDIO_DEVICE_KEY = 'preferredAudioOutputDevice';
let preferredOutputDeviceId = localStorage.getItem(AUDIO_DEVICE_KEY) || '';

async function refreshAudioDeviceList() {
  const container = document.getElementById('audioDeviceList');
  if (!container) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    container.innerHTML = '<li>Audio device selection unavailable</li>';
    return;
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const outputs = devices.filter(d => d.kind === 'audiooutput');
    container.innerHTML = '';

    if (outputs.length === 0) {
      container.innerHTML = '<li>No audio output devices found</li>';
      return;
    }

    outputs.forEach(device => {
      const li  = document.createElement('li');
      const btn = document.createElement('button');
      btn.textContent = device.label || `Device ${device.deviceId.slice(0, 8)}`;
      btn.classList.toggle('selected', device.deviceId === preferredOutputDeviceId);
      btn.addEventListener('click', () => selectAudioOutputDevice(device.deviceId, btn));
      li.appendChild(btn);
      container.appendChild(li);
    });

    // If the saved device is no longer present, reset
    if (preferredOutputDeviceId &&
        !outputs.some(d => d.deviceId === preferredOutputDeviceId)) {
      preferredOutputDeviceId = '';
      localStorage.removeItem(AUDIO_DEVICE_KEY);
    }
  } catch (err) {
    console.error('enumerateDevices error:', err);
    container.innerHTML = '<li>Could not list audio devices</li>';
  }
}

async function selectAudioOutputDevice(deviceId, activeBtn) {
  preferredOutputDeviceId = deviceId;
  localStorage.setItem(AUDIO_DEVICE_KEY, deviceId);

  // Update button selected state
  document.querySelectorAll('#audioDeviceList button').forEach(b => {
    b.classList.toggle('selected', b === activeBtn);
  });

  // Route any live audio element to the chosen device
  const audioEl = document.querySelector('audio');
  if (audioEl && typeof audioEl.setSinkId === 'function') {
    try {
      await audioEl.setSinkId(deviceId);
    } catch (err) {
      console.error('setSinkId error:', err);
    }
  }
}

// Detect Bluetooth / wired device connect / disconnect
if (navigator.mediaDevices) {
  navigator.mediaDevices.addEventListener('devicechange', refreshAudioDeviceList);
}

refreshAudioDeviceList();

// Also refresh list on Android-native device events forwarded via CustomEvent
window.addEventListener('audioDeviceConnected',    refreshAudioDeviceList);
window.addEventListener('audioDeviceDisconnected', refreshAudioDeviceList);

// ─────────────────────────────────────────────────────────────────────────────
// 13. Overlay permission — graceful feature gating
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply overlay-permission state to the UI.
 *
 * When `granted` is true:
 *   • The overlay-features section is shown (if it exists in the HTML).
 *   • Any "Enable overlay" button is hidden.
 *
 * When `granted` is false:
 *   • The overlay-features section is hidden.
 *   • A user-facing notice is shown explaining the feature is unavailable.
 *   • If `permanent` is true (user has declined twice), an "Enable overlay"
 *     button is shown that opens the system settings page directly.
 *
 * The core dialer, clocks, and connectivity panel are unaffected — this
 * function only touches elements that are marked with the
 * `data-overlay-feature` attribute.
 */
function applyOverlayPermissionState(granted, permanent) {
  const statusEl      = document.getElementById('overlayPermissionStatus');
  const enableBtn     = document.getElementById('enableOverlayBtn');
  const featureEls    = document.querySelectorAll('[data-overlay-feature]');

  // Show / hide overlay-dependent feature elements
  featureEls.forEach(el => {
    el.hidden = !granted;
  });

  // Update status text
  if (statusEl) {
    if (granted) {
      statusEl.textContent = 'Call overlay: enabled ✓';
      statusEl.className   = 'overlay-status overlay-granted';
    } else if (permanent) {
      statusEl.textContent =
        'Call overlay: disabled — tap "Enable overlay" to turn on in system settings.';
      statusEl.className   = 'overlay-status overlay-denied-permanent';
    } else {
      statusEl.textContent =
        'Call overlay: not enabled — you can allow it when prompted.';
      statusEl.className   = 'overlay-status overlay-denied';
    }
  }

  // Show / hide the "Enable overlay" button
  if (enableBtn) {
    enableBtn.hidden = granted || !permanent;
  }
}

/**
 * Wire up the "Enable overlay" button so it opens the system settings page
 * via the Android JS interface.
 */
const enableOverlayBtn = document.getElementById('enableOverlayBtn');
if (enableOverlayBtn) {
  enableOverlayBtn.addEventListener('click', () => {
    if (window.Android && typeof window.Android.requestOverlaySettings === 'function') {
      window.Android.requestOverlaySettings();
    }
  });
}

/**
 * Listen for overlay permission state changes dispatched by the Android
 * native layer (via MainActivity.notifyJsOverlayState).
 */
window.addEventListener('overlayPermissionChanged', (e) => {
  const { granted, permanent } = e.detail || {};
  applyOverlayPermissionState(!!granted, !!permanent);
});

/**
 * On page load: perform a synchronous check via the Android interface if
 * available, so the UI is in the correct state immediately without waiting
 * for the async CustomEvent.
 */
(function initOverlayState() {
  if (window.Android && typeof window.Android.isOverlayGranted === 'function') {
    const granted = window.Android.isOverlayGranted();
    applyOverlayPermissionState(granted, false);
  } else {
    // Running in a plain browser (not wrapped) — overlay features degrade
    // gracefully since the Android JS interface is unavailable.
    applyOverlayPermissionState(false, false);
  }
})();

// ─────────────────────────────────────────────────────────────────────────────
// 14. Android native event listeners (audio focus, BT SCO, media buttons)
// ─────────────────────────────────────────────────────────────────────────────

window.addEventListener('audioFocusLost', () => {
  // Pause / mute call audio when another app takes audio focus
  if (callStream) callStream.getAudioTracks().forEach(t => { t.enabled = false; });
});

window.addEventListener('audioFocusGained', () => {
  // Restore mic when audio focus returns (unless user has muted)
  if (callStream && !isMicMuted) {
    callStream.getAudioTracks().forEach(t => { t.enabled = true; });
  }
});

window.addEventListener('bluetoothScoConnected', () => {
  const badge = document.getElementById('networkTypeIndicator');
  if (badge && callActive) badge.textContent += ' · BT HFP';
});

window.addEventListener('mediaButtonStop', () => {
  if (callActive) endCall();
});

window.addEventListener('audioOutputRouted', (e) => {
  const { device } = e.detail || {};
  const el = document.getElementById('audioOutputRouteStatus');
  if (el && device) el.textContent = `Audio out: ${device}`;
});
