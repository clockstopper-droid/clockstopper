/* ============================================================
   Global Time Clock — app.js  (Android assets)
   Pure vanilla JS; no neon/glow effects
   ============================================================ */

'use strict';

/* ---------- Fixed Time Zones ---------- */
const FIXED_ZONES = [
  { label: 'Eastern Time',  tz: 'America/New_York'    },
  { label: 'Central Time',  tz: 'America/Chicago'     },
  { label: 'Western Time',  tz: 'America/Los_Angeles' },
];

/* ---------- App State ---------- */
let isMuted          = false;
let isOnline         = navigator.onLine;
let preferredNetwork = 'wifi';   // 'wifi' | 'cellular'
let dialedNumber     = '';
let callerIdName     = '';       // Custom wording shown on recipient's caller ID
let callActive       = false;
let micStream        = null;
let audioContext     = null;

/* ============================================================
   Clock Rendering
   ============================================================ */

function renderClocks() {
  const grid = document.getElementById('clocksGrid');
  if (!grid) return;
  grid.innerHTML = '';

  FIXED_ZONES.forEach(({ label, tz }) => {
    const card = document.createElement('div');
    card.className = 'clock-card';
    card.dataset.tz = tz;

    const zoneLabel = document.createElement('div');
    zoneLabel.className = 'zone-label';
    zoneLabel.textContent = label;

    const timeDisplay = document.createElement('div');
    timeDisplay.className = 'time-display';

    const dateDisplay = document.createElement('div');
    dateDisplay.className = 'date-display';

    card.appendChild(zoneLabel);
    card.appendChild(timeDisplay);
    card.appendChild(dateDisplay);
    grid.appendChild(card);
  });
}

function updateClocks() {
  const now = new Date();
  document.querySelectorAll('.clock-card').forEach(card => {
    const tz = card.dataset.tz;

    const timeStr = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour:     '2-digit',
      minute:   '2-digit',
      second:   '2-digit',
      hour12:   true,
    }).format(now);

    const dateStr = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday:  'short',
      month:    'short',
      day:      'numeric',
    }).format(now);

    const timeEl = card.querySelector('.time-display');
    const dateEl = card.querySelector('.date-display');
    if (timeEl) timeEl.textContent = timeStr;
    if (dateEl) dateEl.textContent = dateStr;
  });
}

/* ============================================================
   Theme & Mute
   ============================================================ */

function toggleTheme() {
  document.body.classList.toggle('dark-theme');
}

function toggleMute() {
  isMuted = !isMuted;
  const btn = document.getElementById('muteBtn');
  if (!btn) return;
  btn.classList.toggle('muted', isMuted);
  btn.textContent = isMuted ? '🔇 Muted' : '🔊 Mute';

  if (audioContext && callActive) {
    updateCallAudioMute();
  }
}

/* ============================================================
   Caller ID Name
   ============================================================ */

/**
 * Reads the caller-ID input, updates the in-memory state,
 * and refreshes the preview badge beneath the field.
 */
function updateCallerIdPreview() {
  const input   = document.getElementById('callerIdInput');
  const preview = document.getElementById('callerIdPreview');

  callerIdName = input ? input.value.trim() : '';

  if (!preview) return;

  if (callerIdName.length > 0) {
    preview.textContent = `Caller ID will show: "${callerIdName}"`;
    preview.classList.add('active');
  } else {
    preview.textContent = 'Caller ID will show your number';
    preview.classList.remove('active');
  }
}

/**
 * Returns the effective caller-ID string:
 *   - custom wording if set, otherwise the dialed number itself.
 */
function getEffectiveCallerId() {
  return callerIdName.length > 0 ? callerIdName : dialedNumber;
}

/* ============================================================
   Dialer
   ============================================================ */

function initDialer() {
  dialedNumber = '';
  callerIdName = '';
  updateDialerDisplay();
  updateCallerIdPreview();
}

function dialDigit(digit) {
  dialedNumber += String(digit);
  updateDialerDisplay();
}

function clearDialed() {
  if (dialedNumber.length === 0) return;
  dialedNumber = dialedNumber.slice(0, -1);
  updateDialerDisplay();
}

function clearAll() {
  dialedNumber = '';
  updateDialerDisplay();
}

function updateDialerDisplay() {
  const display   = document.getElementById('dialerDisplay');
  const readout   = document.getElementById('dialedNumberReadout');
  const hasDigits = dialedNumber.length > 0;

  if (display) {
    display.textContent = hasDigits ? dialedNumber : '';
    display.classList.toggle('has-number', hasDigits);
  }
  if (readout) {
    readout.textContent = hasDigits ? dialedNumber : 'Enter a number';
    readout.classList.toggle('active', hasDigits);
  }
}

/* ============================================================
   Connectivity
   ============================================================ */

function initConnectivity() {
  window.addEventListener('online',  () => { isOnline = true;  updateConnectivityUI(); });
  window.addEventListener('offline', () => { isOnline = false; updateConnectivityUI(); });

  updateConnectivityUI();
  probeConnectivity();
  updateNetworkInfo();
  detectMobileNetwork();

  if (navigator.connection) {
    navigator.connection.addEventListener('change', () => {
      updateNetworkInfo();
      detectMobileNetwork();
    });
  }
}

function updateConnectivityUI() {
  const statusEl = document.getElementById('wifiStatus');
  if (!statusEl) return;

  statusEl.classList.toggle('online',  isOnline);
  statusEl.classList.toggle('offline', !isOnline);
  statusEl.textContent = isOnline ? '✔ Connected' : '✘ Offline';
}

function probeConnectivity() {
  const probeEl = document.getElementById('connectivityProbeStatus');
  if (!probeEl) return;

  probeEl.textContent = 'Probing…';
  probeEl.className   = 'probe-status';

  fetch('https://www.gstatic.com/generate_204', { method: 'HEAD', cache: 'no-store', mode: 'no-cors' })
    .then(() => {
      probeEl.textContent = '✔ Internet reachable';
      probeEl.className   = 'probe-status verified';
    })
    .catch(() => {
      probeEl.textContent = '✘ Internet unreachable';
      probeEl.className   = 'probe-status unverified';
    });
}

function updateNetworkInfo() {
  const conn = navigator.connection;
  if (!conn) return;

  const detailEl = document.getElementById('networkDetail');
  if (!detailEl) return;

  const parts = [];
  if (conn.effectiveType) parts.push(conn.effectiveType.toUpperCase());
  if (conn.downlink)      parts.push(`${conn.downlink} Mbps`);
  if (conn.rtt)           parts.push(`RTT ${conn.rtt}ms`);

  detailEl.textContent = parts.length ? parts.join(' · ') : 'Network info unavailable';
}

function detectMobileNetwork() {
  const mobileOption = document.getElementById('mobileNetworkOption');
  if (!mobileOption) return;

  const conn       = navigator.connection;
  const isCellular = conn && conn.type === 'cellular';

  mobileOption.classList.toggle('available',   isCellular);
  mobileOption.classList.toggle('unavailable', !isCellular);

  if (!isCellular && preferredNetwork === 'cellular') {
    preferredNetwork = 'wifi';
  }
}

function scanNetworks() {
  updateNetworkInfo();
  detectMobileNetwork();
}

function selectMobileNetwork() {
  const conn = navigator.connection;
  if (!conn || conn.type !== 'cellular') return;

  preferredNetwork = 'cellular';

  const mobileOption = document.getElementById('mobileNetworkOption');
  if (mobileOption) mobileOption.classList.add('selected');

  updateNetworkTypeIndicator();
}

function toggleConnectivityPanel() {
  const panel = document.getElementById('connectivityPanel');
  if (panel) panel.classList.toggle('expanded');
}

/* ============================================================
   Call Audio
   ============================================================ */

function requestMicPermission() {
  const micEl = document.getElementById('micPermissionStatus');
  if (micEl) {
    micEl.textContent = 'Requesting microphone…';
    micEl.className   = 'mic-permission-status pending';
  }

  return navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    .then(stream => {
      micStream = stream;
      if (micEl) {
        micEl.textContent = '✔ Microphone granted';
        micEl.className   = 'mic-permission-status granted';
      }
      return stream;
    })
    .catch(err => {
      if (micEl) {
        micEl.textContent = '✘ Microphone denied';
        micEl.className   = 'mic-permission-status denied';
      }
      throw err;
    });
}

function initiateCall() {
  if (dialedNumber.length === 0) return;
  if (callActive) return;

  // Snapshot the effective caller ID at call-initiation time
  const effectiveId = getEffectiveCallerId();

  requestMicPermission()
    .then(() => {
      callActive   = true;
      audioContext = new (window.AudioContext || window.webkitAudioContext)();

      updateCallUI();
      updateNetworkTypeIndicator();

      const callStatusEl = document.getElementById('callStatus');
      if (callStatusEl) {
        // Show both the dialed number and the outbound caller ID name (if set)
        const idLabel = callerIdName.length > 0
          ? ` · ID: "${effectiveId}"`
          : '';
        callStatusEl.textContent = `Calling ${dialedNumber}${idLabel}…`;
        callStatusEl.className   = 'call-status calling';
      }

      setTimeout(() => {
        if (!callActive) return;
        if (callStatusEl) {
          callStatusEl.textContent = `Connected · ${dialedNumber}`;
          callStatusEl.className   = 'call-status connected';
        }
      }, 2000);
    })
    .catch(() => {
      const callStatusEl = document.getElementById('callStatus');
      if (callStatusEl) {
        callStatusEl.textContent = 'Microphone required to place a call.';
        callStatusEl.className   = 'call-status ended';
      }
    });
}

function endCall() {
  if (!callActive) return;
  callActive = false;

  if (micStream) {
    micStream.getTracks().forEach(t => t.stop());
    micStream = null;
  }
  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }

  updateCallUI();

  const callStatusEl = document.getElementById('callStatus');
  if (callStatusEl) {
    callStatusEl.textContent = 'Call ended.';
    callStatusEl.className   = 'call-status ended';
  }

  const indicatorEl = document.getElementById('networkTypeIndicator');
  if (indicatorEl) {
    indicatorEl.textContent = '';
    indicatorEl.className   = 'network-type-indicator';
  }
}

function updateCallAudioMute() {
  // Placeholder — wire to gain node when AudioContext graph is extended
}

function updateCallUI() {
  const panel = document.getElementById('callPanel');
  if (panel) panel.classList.toggle('active', callActive);
}

function updateNetworkTypeIndicator() {
  const indicatorEl = document.getElementById('networkTypeIndicator');
  if (!indicatorEl) return;

  indicatorEl.className   = 'network-type-indicator';
  indicatorEl.textContent = '';

  if (!callActive) return;

  const conn = navigator.connection;

  if (preferredNetwork === 'cellular' && conn && conn.type === 'cellular') {
    const eff = conn.effectiveType || '';
    if (eff === '4g') {
      indicatorEl.classList.add('cellular', 'fourG');
      indicatorEl.textContent = '4G';
    } else if (eff === '3g') {
      indicatorEl.classList.add('cellular', 'threeG');
      indicatorEl.textContent = '3G';
    } else {
      indicatorEl.classList.add('cellular');
      indicatorEl.textContent = 'Cellular';
    }
  } else {
    indicatorEl.classList.add('wifi');
    indicatorEl.textContent = 'WiFi';
  }
}

/* ============================================================
   Initialisation
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  renderClocks();
  initDialer();
  initConnectivity();
  updateClocks();
  setInterval(updateClocks, 1000);
});
