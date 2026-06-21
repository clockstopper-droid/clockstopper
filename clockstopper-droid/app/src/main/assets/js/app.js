// ============================================================
// Global Time Clock — app.js
// Pure vanilla JS: clocks, theme, mute, connectivity,
// mobile network, dialer, caller ID name, call audio
// ============================================================

// ── State ────────────────────────────────────────────────────
let isMuted = false;
let isOnline = navigator.onLine;
let connectivityPanelOpen = false;
let preferredNetwork = 'wifi'; // 'wifi' | 'cellular'
let mobileNetworkAvailable = false;
let callActive = false;
let micStream = null;
let audioCtx = null;
let dialedNumber = '';
let callerIdName = '';

// ── Fixed time zones ─────────────────────────────────────────
const TIME_ZONES = [
  { label: 'Eastern Time',  iana: 'America/New_York'    },
  { label: 'Central Time',  iana: 'America/Chicago'     },
  { label: 'Western Time',  iana: 'America/Los_Angeles' },
];

// ── Clock rendering ──────────────────────────────────────────
function renderClocks() {
  const grid = document.getElementById('clocksGrid');
  if (!grid) return;
  grid.innerHTML = '';
  TIME_ZONES.forEach(tz => {
    const card = document.createElement('div');
    card.className = 'clock-card';
    card.dataset.iana = tz.iana;

    const label = document.createElement('div');
    label.className = 'clock-label';
    label.textContent = tz.label;

    const display = document.createElement('div');
    display.className = 'clock-display';
    display.id = 'clock-' + tz.iana.replace(/\//g, '-');

    card.appendChild(label);
    card.appendChild(display);
    grid.appendChild(card);
  });
}

function updateClocks() {
  const now = new Date();
  TIME_ZONES.forEach(tz => {
    const el = document.getElementById('clock-' + tz.iana.replace(/\//g, '-'));
    if (!el) return;
    el.textContent = new Intl.DateTimeFormat('en-US', {
      timeZone: tz.iana,
      hour:     '2-digit',
      minute:   '2-digit',
      second:   '2-digit',
      hour12:   true,
    }).format(now);
  });
}

// ── Theme ────────────────────────────────────────────────────
function toggleTheme() {
  document.body.classList.toggle('dark-theme');
}

// ── Mute ─────────────────────────────────────────────────────
function toggleMute() {
  isMuted = !isMuted;
  const btn = document.getElementById('muteBtn');
  if (btn) {
    btn.classList.toggle('muted', isMuted);
    btn.textContent = isMuted ? '🔇 Muted' : '🔔 Mute';
  }
}

// ── Connectivity panel ────────────────────────────────────────
function toggleConnectivityPanel() {
  connectivityPanelOpen = !connectivityPanelOpen;
  const panel = document.getElementById('connectivityPanel');
  if (panel) panel.classList.toggle('expanded', connectivityPanelOpen);
  if (connectivityPanelOpen) {
    updateNetworkInfo();
    scanNetworks();
    detectMobileNetwork();
  }
}

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
  const indicator = document.getElementById('wifiStatus');
  if (!indicator) return;
  if (isOnline) {
    indicator.className = 'wifi-status online';
    indicator.textContent = 'Online';
  } else {
    indicator.className = 'wifi-status offline';
    indicator.textContent = 'Offline';
  }
}

function probeConnectivity() {
  const status = document.getElementById('connectivityProbeStatus');
  if (!status) return;
  status.className = 'probe-status';
  status.textContent = 'Probing…';

  fetch('https://www.google.com/favicon.ico', { method: 'HEAD', mode: 'no-cors', cache: 'no-store' })
    .then(() => {
      status.className = 'probe-status verified';
      status.textContent = 'Internet verified';
    })
    .catch(() => {
      status.className = 'probe-status unverified';
      status.textContent = 'Probe failed';
    });
}

function updateNetworkInfo() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return;
  const typeIndicator = document.getElementById('networkTypeIndicator');
  if (typeIndicator && !callActive) {
    const t = conn.type || 'unknown';
    const et = conn.effectiveType || '';
    typeIndicator.textContent = t === 'cellular' ? `Mobile (${et.toUpperCase()})` : t.charAt(0).toUpperCase() + t.slice(1);
  }
}

function detectMobileNetwork() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const mobileOpt = document.getElementById('mobileNetworkOption');
  mobileNetworkAvailable = !!(conn && conn.type === 'cellular');

  if (mobileOpt) {
    mobileOpt.classList.remove('available', 'unavailable', 'selected');
    if (mobileNetworkAvailable) {
      mobileOpt.classList.add('available');
      if (preferredNetwork === 'cellular') mobileOpt.classList.add('selected');
    } else {
      mobileOpt.classList.add('unavailable');
    }
  }
}

function scanNetworks() {
  const list = document.getElementById('networkList');
  if (!list) return;
  list.innerHTML = '<li class="network-list-item">Network scan not available in this browser.</li>';
}

// ── Mobile network selection ──────────────────────────────────
function selectMobileNetwork() {
  preferredNetwork = 'cellular';
  detectMobileNetwork();
  const typeIndicator = document.getElementById('networkTypeIndicator');
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const et = (conn && conn.effectiveType) ? conn.effectiveType.toUpperCase() : '';
  if (typeIndicator) {
    typeIndicator.className = 'network-type-indicator cellular' + (et === '4G' ? ' fourG' : et === '3G' ? ' threeG' : '');
    typeIndicator.textContent = `Mobile${et ? ' (' + et + ')' : ''}`;
  }
}

// ── Dialer ────────────────────────────────────────────────────
function dialDigit(digit) {
  if (dialedNumber.length >= 20) return;
  dialedNumber += String(digit);
  updateDialerDisplay();
}

function clearDialed(clearAll) {
  if (clearAll || dialedNumber.length <= 1) {
    dialedNumber = '';
  } else {
    dialedNumber = dialedNumber.slice(0, -1);
  }
  updateDialerDisplay();
}

function updateDialerDisplay() {
  const display  = document.getElementById('dialerDisplay');
  const readout  = document.getElementById('dialedNumberReadout');
  if (display) {
    display.textContent = dialedNumber || '';
    display.classList.toggle('has-number', dialedNumber.length > 0);
  }
  if (readout) {
    readout.textContent = dialedNumber.length > 0 ? `Dialing: ${dialedNumber}` : '';
    readout.classList.toggle('active', dialedNumber.length > 0);
  }
}

// ── Caller ID name ────────────────────────────────────────────
function setCallerIdName() {
  const input = document.getElementById('callerIdNameInput');
  const display = document.getElementById('callerIdNameDisplay');
  if (!input) return;
  const val = input.value.trim();
  callerIdName = val;
  if (display) {
    if (val) {
      display.textContent = `Caller ID: ${val}`;
      display.classList.add('active');
    } else {
      display.textContent = 'No caller ID name set';
      display.classList.remove('active');
    }
  }
  input.classList.toggle('has-value', val.length > 0);
}

// ── Call audio ────────────────────────────────────────────────
function requestMicPermission() {
  return navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      micStream = stream;
      const micStatus = document.getElementById('micPermissionStatus');
      if (micStatus) {
        micStatus.textContent = 'Microphone: Granted';
        micStatus.className = 'mic-permission-status granted';
      }
      return stream;
    })
    .catch(err => {
      const micStatus = document.getElementById('micPermissionStatus');
      if (micStatus) {
        micStatus.textContent = 'Microphone: Denied';
        micStatus.className = 'mic-permission-status denied';
      }
      throw err;
    });
}

function initiateCall() {
  if (callActive) return;
  if (!dialedNumber) {
    const status = document.getElementById('callStatus');
    if (status) status.textContent = 'Enter a number first.';
    return;
  }

  requestMicPermission()
    .then(() => {
      callActive = true;
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();

      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      const netType = preferredNetwork === 'cellular'
        ? (conn ? conn.type || 'cellular' : 'cellular')
        : 'wifi';
      const et = (conn && conn.effectiveType) ? conn.effectiveType.toUpperCase() : '';

      updateCallUI(true, netType, et);
    })
    .catch(() => {
      const status = document.getElementById('callStatus');
      if (status) status.textContent = 'Microphone permission required to place calls.';
    });
}

function endCall() {
  if (!callActive) return;
  callActive = false;

  if (micStream) {
    micStream.getTracks().forEach(t => t.stop());
    micStream = null;
  }
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }

  updateCallUI(false, '', '');
}

function updateCallUI(active, netType, effectiveType) {
  const panel    = document.getElementById('callPanel');
  const status   = document.getElementById('callStatus');
  const typeInd  = document.getElementById('networkTypeIndicator');
  const cidDisp  = document.getElementById('callerIdNameDisplay');

  if (panel) panel.classList.toggle('active', active);

  if (status) {
    if (active) {
      const cid = callerIdName ? ` as "${callerIdName}"` : '';
      status.textContent = `Calling ${dialedNumber}${cid}…`;
    } else {
      status.textContent = 'Call ended.';
    }
  }

  if (typeInd) {
    if (active) {
      let cls = 'network-type-indicator';
      let label = '';
      if (netType === 'cellular' || preferredNetwork === 'cellular') {
        cls += ' cellular';
        if (effectiveType === '4G') { cls += ' fourG'; label = `4G LTE`; }
        else if (effectiveType === '3G') { cls += ' threeG'; label = `3G`; }
        else { label = effectiveType ? `Mobile (${effectiveType})` : 'Cellular'; }
      } else {
        cls += ' wifi';
        label = 'WiFi';
      }
      typeInd.className = cls;
      typeInd.textContent = label;
    } else {
      typeInd.className = 'network-type-indicator';
      typeInd.textContent = '';
    }
  }

  if (cidDisp && active && callerIdName) {
    cidDisp.textContent = `Caller ID: ${callerIdName}`;
    cidDisp.classList.add('active');
  }
}

// ── Keyboard input for dialer ─────────────────────────────────
/**
 * Map a KeyboardEvent.key value to the corresponding dialer digit string.
 * Returns null if the key is not a dialer key.
 */
function keyToDialerDigit(key) {
  if (/^[0-9]$/.test(key)) return key;
  if (key === '*' || key === '#') return key;
  return null;
}

/**
 * Find the on-screen keypad button element that corresponds to a given digit.
 */
function findKeypadButton(digit) {
  // Keypad buttons call dialDigit('X') inline — find a button whose
  // text content matches the digit character.
  const buttons = document.querySelectorAll('.keypad-btn');
  for (const btn of buttons) {
    if (btn.textContent.trim() === String(digit)) return btn;
  }
  return null;
}

/**
 * Briefly add the `.key-flash` class to a keypad button to give visual feedback.
 */
function flashKeypadButton(digit) {
  const btn = findKeypadButton(digit);
  if (!btn) return;
  btn.classList.add('key-flash');
  // Remove the class after the animation completes (200 ms matches CSS duration)
  setTimeout(() => btn.classList.remove('key-flash'), 200);
}

function initKeyboardDialer() {
  document.addEventListener('keydown', function handleDialerKey(e) {
    // Do not intercept keys when the user is typing in a text input or textarea
    const tag = document.activeElement && document.activeElement.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    const digit = keyToDialerDigit(e.key);

    if (digit !== null) {
      e.preventDefault();
      dialDigit(digit);
      flashKeypadButton(digit);
      return;
    }

    if (e.key === 'Backspace') {
      e.preventDefault();
      clearDialed(false);
      // Flash a clear/backspace button if one exists
      const clearBtn = document.querySelector('.keypad-clear-btn, .keypad-backspace-btn');
      if (clearBtn) {
        clearBtn.classList.add('key-flash');
        setTimeout(() => clearBtn.classList.remove('key-flash'), 200);
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      initiateCall();
      return;
    }
  });
}

// ── Bootstrap ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderClocks();
  updateClocks();
  setInterval(updateClocks, 1000);
  initConnectivity();
  initKeyboardDialer();
  updateDialerDisplay();
});
