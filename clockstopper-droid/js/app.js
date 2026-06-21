// ============================================================
// Global Time Clock — app.js
// All application logic: clocks, theme, mute, connectivity,
// mobile network, call audio, dialer, caller ID name,
// keyboard input, call duration timer.
// ============================================================

// ------------------------------------------------------------
// State
// ------------------------------------------------------------
let isMuted = false;
let isDarkTheme = true;
let isConnected = navigator.onLine;
let preferredNetwork = 'wifi'; // 'wifi' | 'cellular'
let isMobileNetworkAvailable = false;

let dialedNumber = '';
let callerIdName = '';
let isCallActive = false;
let micStream = null;
let callAudioContext = null;

// Call duration timer state
let callStartTimestamp = null;   // Date.now() snapshot when call goes active
let callDurationInterval = null; // setInterval ID for the live MM:SS ticker

// ------------------------------------------------------------
// Utility: format elapsed seconds as MM:SS
// ------------------------------------------------------------
function formatDuration(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ------------------------------------------------------------
// Clock rendering — three fixed time zones
// ------------------------------------------------------------
const TIME_ZONES = [
  { label: 'Eastern Time',  tz: 'America/New_York'    },
  { label: 'Central Time',  tz: 'America/Chicago'     },
  { label: 'Western Time',  tz: 'America/Los_Angeles' },
];

function renderClocks() {
  const grid = document.getElementById('clocksGrid');
  if (!grid) return;
  grid.innerHTML = '';
  TIME_ZONES.forEach(({ label, tz }) => {
    const card = document.createElement('div');
    card.className = 'clock-card';
    card.dataset.tz = tz;

    const title = document.createElement('div');
    title.className = 'clock-label';
    title.textContent = label;

    const display = document.createElement('div');
    display.className = 'clock-time';
    display.id = `clock-${tz.replace(/\//g, '-')}`;

    card.appendChild(title);
    card.appendChild(display);
    grid.appendChild(card);
  });
}

function updateClocks() {
  TIME_ZONES.forEach(({ tz }) => {
    const el = document.getElementById(`clock-${tz.replace(/\//g, '-')}`);
    if (!el) return;
    const now = new Date();
    const timeStr = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour:   '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(now);
    el.textContent = timeStr;
  });
}

// ------------------------------------------------------------
// Theme toggle
// ------------------------------------------------------------
function toggleTheme() {
  isDarkTheme = !isDarkTheme;
  document.body.classList.toggle('dark-theme', isDarkTheme);
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = isDarkTheme ? '☀️ Light Mode' : '🌙 Dark Mode';
}

// ------------------------------------------------------------
// Mute toggle
// ------------------------------------------------------------
function toggleMute() {
  isMuted = !isMuted;
  const btn = document.getElementById('muteBtn');
  if (btn) {
    btn.textContent = isMuted ? '🔇 Unmute' : '🔊 Mute';
    btn.classList.toggle('muted', isMuted);
  }
}

// ------------------------------------------------------------
// Connectivity panel
// ------------------------------------------------------------
function toggleConnectivityPanel() {
  const panel = document.getElementById('connectivityPanel');
  if (!panel) return;
  panel.classList.toggle('expanded');
}

function updateConnectivityUI() {
  const statusEl = document.getElementById('wifiStatus');
  if (statusEl) {
    statusEl.textContent = isConnected ? '✅ Online' : '❌ Offline';
    statusEl.className = isConnected ? 'status-online' : 'status-offline';
  }
  detectMobileNetwork();
}

function probeConnectivity() {
  const probeEl = document.getElementById('connectivityProbeStatus');
  if (!probeEl) return;
  probeEl.textContent = 'Probing…';
  fetch('https://www.gstatic.com/generate_204', { method: 'HEAD', mode: 'no-cors', cache: 'no-store' })
    .then(() => { probeEl.textContent = '✅ Internet reachable'; })
    .catch(() => { probeEl.textContent = '❌ Internet unreachable'; });
}

function updateNetworkInfo() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const infoEl = document.getElementById('networkInfoDetail');
  if (!conn) {
    if (infoEl) infoEl.textContent = 'Network info unavailable';
    return;
  }
  const type = conn.type || 'unknown';
  const effective = conn.effectiveType || '';
  const downlink = conn.downlink != null ? `${conn.downlink} Mbps` : '';
  if (infoEl) {
    infoEl.textContent = [type, effective, downlink].filter(Boolean).join(' · ');
  }
}

function detectMobileNetwork() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const mobileOption = document.getElementById('mobileNetworkOption');
  const indicator = document.getElementById('networkTypeIndicator');
  if (!conn) {
    isMobileNetworkAvailable = false;
    if (mobileOption) mobileOption.classList.add('hidden');
    return;
  }
  const type = conn.type || '';
  const effective = conn.effectiveType || '';
  isMobileNetworkAvailable = type === 'cellular' || ['4g','3g','2g'].includes(effective);
  if (mobileOption) mobileOption.classList.toggle('hidden', !isMobileNetworkAvailable);
  if (!isCallActive && indicator) {
    indicator.textContent = isMobileNetworkAvailable ? `📶 Mobile (${effective || type})` : '';
  }
}

function selectMobileNetwork() {
  preferredNetwork = 'cellular';
  const btn = document.getElementById('mobileNetworkOption');
  if (btn) btn.classList.add('selected');
  const wifiBtn = document.getElementById('wifiNetworkOption');
  if (wifiBtn) wifiBtn.classList.remove('selected');
  updateNetworkInfo();
}

function scanNetworks() {
  const listEl = document.getElementById('networkList');
  if (!listEl) return;
  listEl.innerHTML = '<li>Scanning…</li>';
  setTimeout(() => {
    updateNetworkInfo();
    listEl.innerHTML = '<li>Network scan requires native OS APIs — showing current connection info above.</li>';
  }, 800);
}

function initConnectivity() {
  window.addEventListener('online',  () => { isConnected = true;  updateConnectivityUI(); probeConnectivity(); });
  window.addEventListener('offline', () => { isConnected = false; updateConnectivityUI(); });
  updateConnectivityUI();
  probeConnectivity();
  updateNetworkInfo();

  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) conn.addEventListener('change', () => { updateNetworkInfo(); detectMobileNetwork(); });
}

// ------------------------------------------------------------
// Caller ID name
// ------------------------------------------------------------
function setCallerIdName() {
  const input = document.getElementById('callerIdNameInput');
  if (!input) return;
  callerIdName = input.value.trim();
  const display = document.getElementById('callerIdNameDisplay');
  if (display) {
    display.textContent = callerIdName ? `Caller ID: "${callerIdName}"` : 'No caller ID name set';
  }
}

// ------------------------------------------------------------
// Dialer
// ------------------------------------------------------------
function dialDigit(digit) {
  dialedNumber += digit;
  updateDialerDisplay();
}

function clearDialed() {
  if (dialedNumber.length > 0) {
    dialedNumber = dialedNumber.slice(0, -1);
  }
  updateDialerDisplay();
}

function updateDialerDisplay() {
  const display  = document.getElementById('dialerDisplay');
  const readout  = document.getElementById('dialedNumberReadout');
  if (display) display.textContent  = dialedNumber || '';
  if (readout) readout.textContent  = dialedNumber ? `Dialing: ${dialedNumber}` : '';
}

// ------------------------------------------------------------
// Microphone permission
// ------------------------------------------------------------
async function requestMicPermission() {
  const statusEl = document.getElementById('micPermissionStatus');
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    if (statusEl) statusEl.textContent = '🎤 Microphone granted';
    return true;
  } catch (err) {
    if (statusEl) statusEl.textContent = `🚫 Microphone denied: ${err.message}`;
    return false;
  }
}

// ------------------------------------------------------------
// Call duration timer helpers
// ------------------------------------------------------------
function startCallDurationTimer() {
  callStartTimestamp = Date.now();

  // Tick immediately so the display shows 00:00 right away
  tickCallDuration();

  callDurationInterval = setInterval(tickCallDuration, 1000);
}

function tickCallDuration() {
  const statusEl = document.getElementById('callStatus');
  if (!statusEl) return;
  const elapsed = Math.floor((Date.now() - callStartTimestamp) / 1000);
  statusEl.textContent = `Call in progress — ${formatDuration(elapsed)}`;
}

function stopCallDurationTimer() {
  if (callDurationInterval !== null) {
    clearInterval(callDurationInterval);
    callDurationInterval = null;
  }

  // Show the final duration in #callStatus
  const statusEl = document.getElementById('callStatus');
  if (statusEl && callStartTimestamp !== null) {
    const elapsed = Math.floor((Date.now() - callStartTimestamp) / 1000);
    statusEl.textContent = `Call ended — ${formatDuration(elapsed)}`;
  }

  callStartTimestamp = null;
}

// ------------------------------------------------------------
// Call management
// ------------------------------------------------------------
async function initiateCall() {
  if (isCallActive) return;
  if (!dialedNumber) {
    const statusEl = document.getElementById('callStatus');
    if (statusEl) statusEl.textContent = 'Enter a number to dial.';
    return;
  }

  const micGranted = await requestMicPermission();
  if (!micGranted) return;

  isCallActive = true;

  // Set up audio context
  try {
    callAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (micStream) {
      const source = callAudioContext.createMediaStreamSource(micStream);
      source.connect(callAudioContext.destination);
    }
  } catch (e) {
    console.warn('AudioContext setup failed:', e);
  }

  // Network type indicator
  const indicator = document.getElementById('networkTypeIndicator');
  if (indicator) {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const netLabel = preferredNetwork === 'cellular'
      ? `📶 ${(conn && (conn.effectiveType || conn.type)) || 'Mobile'}`
      : '📡 WiFi';
    indicator.textContent = netLabel;
  }

  // Update call panel UI
  updateCallUI();

  // Start the live duration timer — this will write the initial
  // "Call in progress — 00:00" into #callStatus and keep it updated
  startCallDurationTimer();

  console.info(`Outgoing call initiated — number: ${dialedNumber}, callerIdName: "${callerIdName}", network: ${preferredNetwork}`);
}

function endCall() {
  if (!isCallActive && !dialedNumber) return;

  // Stop the duration timer and display the final duration string
  if (isCallActive) {
    stopCallDurationTimer();
  }

  isCallActive = false;

  // Release mic
  if (micStream) {
    micStream.getTracks().forEach(t => t.stop());
    micStream = null;
  }

  // Close audio context
  if (callAudioContext) {
    callAudioContext.close().catch(() => {});
    callAudioContext = null;
  }

  const indicator = document.getElementById('networkTypeIndicator');
  if (indicator) indicator.textContent = '';

  updateCallUI();

  // If there was no active call just clear the dialer
  if (!callStartTimestamp && !callDurationInterval) {
    dialedNumber = '';
    updateDialerDisplay();
    const statusEl = document.getElementById('callStatus');
    if (statusEl) statusEl.textContent = '';
  }
}

function updateCallUI() {
  const panel = document.getElementById('callPanel');
  if (panel) panel.classList.toggle('call-active', isCallActive);

  const displayEl = document.getElementById('dialerDisplay');
  if (displayEl) displayEl.classList.toggle('call-active', isCallActive);

  const callerIdDisplay = document.getElementById('callerIdNameDisplay');
  if (callerIdDisplay && isCallActive && callerIdName) {
    callerIdDisplay.textContent = `Caller ID: "${callerIdName}"`;
  }
}

// ------------------------------------------------------------
// Keyboard input
// ------------------------------------------------------------
function initKeyboardInput() {
  document.addEventListener('keydown', (e) => {
    // Do not intercept events when focus is inside a text input / textarea
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    const key = e.key;

    if (/^[0-9]$/.test(key) || key === '*' || key === '#' || key === '+') {
      e.preventDefault();
      dialDigit(key);
    } else if (key === 'Backspace') {
      e.preventDefault();
      clearDialed();
    } else if (key === 'Enter') {
      e.preventDefault();
      initiateCall();
    } else if (key === 'Escape') {
      e.preventDefault();
      endCall();
    }
  });
}

// ------------------------------------------------------------
// Initialisation
// ------------------------------------------------------------
function init() {
  // Apply default dark theme
  document.body.classList.add('dark-theme');

  // Render and start clocks
  renderClocks();
  updateClocks();
  setInterval(updateClocks, 1000);

  // Connectivity
  initConnectivity();

  // Keyboard input for dialer
  initKeyboardInput();

  // Seed caller ID display
  const callerIdDisplay = document.getElementById('callerIdNameDisplay');
  if (callerIdDisplay) callerIdDisplay.textContent = 'No caller ID name set';

  // Seed call status
  const callStatus = document.getElementById('callStatus');
  if (callStatus) callStatus.textContent = '';
}

document.addEventListener('DOMContentLoaded', init);
