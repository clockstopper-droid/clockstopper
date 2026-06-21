/* =============================================================
   Global Time Clock — app.js
   All application logic: clocks, theme, mute, connectivity,
   outgoing call audio, dial-pad number display.
   ============================================================= */

'use strict';

/* ─────────────────────────────────────────────
   FIXED TIME ZONES  (never changes at runtime)
   ───────────────────────────────────────────── */
const FIXED_ZONES = [
  { label: 'Eastern Time',  iana: 'America/New_York'    },
  { label: 'Central Time',  iana: 'America/Chicago'     },
  { label: 'Western Time',  iana: 'America/Los_Angeles' },
];

/* ─────────────────────────────────────────────
   STATE
   ───────────────────────────────────────────── */
let isMuted        = false;
let isCallActive   = false;
let activeStream   = null;   // MediaStream from getUserMedia
let audioCtx       = null;   // AudioContext for ringback
let ringbackNodes  = null;   // { oscillator, gainNode }
let dialedNumber   = '';     // digits entered in the dial pad

/* ─────────────────────────────────────────────
   CLOCK RENDERING
   ───────────────────────────────────────────── */
function renderClocks() {
  const grid = document.getElementById('clocksGrid');
  if (!grid) return;
  grid.innerHTML = '';

  FIXED_ZONES.forEach(zone => {
    const card = document.createElement('div');
    card.className  = 'clock-card';
    card.dataset.tz = zone.iana;

    card.innerHTML = `
      <div class="clock-label">${zone.label}</div>
      <div class="clock-time"  id="time-${zone.iana.replace(/\//g, '-')}">--:--:--</div>
      <div class="clock-date"  id="date-${zone.iana.replace(/\//g, '-')}">---</div>
    `;
    grid.appendChild(card);
  });
}

function updateClocks() {
  const now = new Date();

  FIXED_ZONES.forEach(zone => {
    const safeId = zone.iana.replace(/\//g, '-');
    const timeEl = document.getElementById('time-' + safeId);
    const dateEl = document.getElementById('date-' + safeId);
    if (!timeEl || !dateEl) return;

    const timeFmt = new Intl.DateTimeFormat('en-US', {
      timeZone:  zone.iana,
      hour:      '2-digit',
      minute:    '2-digit',
      second:    '2-digit',
      hour12:    true,
    });

    const dateFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: zone.iana,
      weekday:  'short',
      month:    'short',
      day:      'numeric',
      year:     'numeric',
    });

    timeEl.textContent = timeFmt.format(now);
    dateEl.textContent = dateFmt.format(now);
  });
}

/* ─────────────────────────────────────────────
   THEME TOGGLE
   ───────────────────────────────────────────── */
function toggleTheme() {
  document.body.classList.toggle('dark-theme');
}

/* ─────────────────────────────────────────────
   MUTE TOGGLE
   ───────────────────────────────────────────── */
function toggleMute() {
  isMuted = !isMuted;
  const btn = document.getElementById('muteBtn');
  if (!btn) return;

  if (isMuted) {
    btn.classList.add('muted');
    btn.innerHTML = '&#128263; Unmute';
  } else {
    btn.classList.remove('muted');
    btn.innerHTML = '&#128266; Mute';
  }

  // Apply mute state to any active ringback audio
  if (ringbackNodes && ringbackNodes.gainNode) {
    ringbackNodes.gainNode.gain.value = isMuted ? 0 : 0.18;
  }
}

/* ─────────────────────────────────────────────
   CONNECTIVITY PANEL
   ───────────────────────────────────────────── */
function toggleConnectivityPanel() {
  const panel = document.getElementById('connectivityPanel');
  if (!panel) return;

  const opening = !panel.classList.contains('expanded');
  panel.classList.toggle('expanded');

  if (opening) {
    updateNetworkInfo();
    scanNetworks();
  }
}

function initConnectivity() {
  updateConnectivityUI();
  probeConnectivity();

  window.addEventListener('online',  () => { updateConnectivityUI(); probeConnectivity(); });
  window.addEventListener('offline', () => { updateConnectivityUI(); probeConnectivity(); });

  if (navigator.connection) {
    navigator.connection.addEventListener('change', updateNetworkInfo);
  }
}

function updateConnectivityUI() {
  const statusEl   = document.getElementById('wifiStatus');
  const statusText = document.getElementById('wifiStatusText');
  if (!statusEl || !statusText) return;

  if (navigator.onLine) {
    statusEl.classList.add('online');
    statusEl.classList.remove('offline');
    statusText.textContent = 'Online';
  } else {
    statusEl.classList.add('offline');
    statusEl.classList.remove('online');
    statusText.textContent = 'Offline';
  }
}

function probeConnectivity() {
  const probeEl   = document.getElementById('connectivityProbeStatus');
  const probeText = document.getElementById('probeStatusText');
  if (!probeEl || !probeText) return;

  probeEl.classList.remove('verified', 'unverified');
  probeText.textContent = 'Probe: checking…';

  fetch('https://www.gstatic.com/generate_204', {
    method: 'HEAD',
    mode:   'no-cors',
    cache:  'no-store',
  })
    .then(() => {
      probeEl.classList.add('verified');
      probeText.textContent = 'Probe: ✔ Internet reachable';
    })
    .catch(() => {
      probeEl.classList.add('unverified');
      probeText.textContent = 'Probe: ✘ Internet unreachable';
    });
}

function updateNetworkInfo() {
  const infoEl = document.getElementById('networkInfo');
  if (!infoEl) return;

  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) {
    infoEl.innerHTML = '<span class="net-detail">Network Info API not available in this browser.</span>';
    return;
  }

  infoEl.innerHTML = `
    <span class="net-detail">Type: <strong>${conn.type           || 'n/a'}</strong></span>
    <span class="net-detail">Effective: <strong>${conn.effectiveType || 'n/a'}</strong></span>
    <span class="net-detail">Downlink: <strong>${conn.downlink != null ? conn.downlink + ' Mbps' : 'n/a'}</strong></span>
    <span class="net-detail">RTT: <strong>${conn.rtt      != null ? conn.rtt + ' ms'   : 'n/a'}</strong></span>
  `;
}

function scanNetworks() {
  const list = document.getElementById('networkList');
  if (!list) return;

  list.innerHTML = '';

  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn && conn.effectiveType) {
    const li = document.createElement('li');
    li.className = 'network-list-item selected';
    li.textContent = `Connected — ${conn.effectiveType.toUpperCase()} (${conn.type || 'unknown'})`;
    list.appendChild(li);
  }

  const note = document.createElement('li');
  note.className = 'network-list-item placeholder';
  note.textContent = 'Full Wi-Fi scanning requires native app permissions.';
  list.appendChild(note);
}

/* ─────────────────────────────────────────────
   DIAL PAD — number display helpers
   ───────────────────────────────────────────── */

/** Render the current dialedNumber string into the display box */
function renderDialerDisplay() {
  const numEl = document.getElementById('dialerNumber');
  if (!numEl) return;

  if (dialedNumber.length === 0) {
    numEl.textContent = '\u2015';          // ―  em-dash placeholder
    numEl.classList.add('placeholder');
  } else {
    numEl.textContent = formatDialedNumber(dialedNumber);
    numEl.classList.remove('placeholder');
  }
}

/**
 * Light formatting helper — groups digits for readability.
 */
function formatDialedNumber(raw) {
  const digits = raw.replace(/\D/g, '');

  if (digits.length >= 11 && raw.startsWith('+1')) {
    const d = digits.slice(1);
    return `+1 (${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6,10)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6,10)}`;
  }
  if (digits.length === 7) {
    return `${digits.slice(0,3)}-${digits.slice(3,7)}`;
  }

  return raw;
}

/** Called by each dial-pad key button */
function dialPadPress(char) {
  if (isCallActive) return;
  if (dialedNumber.length >= 20) return;

  dialedNumber += char;
  renderDialerDisplay();
  flashDisplay();
}

/** Backspace — remove last character */
function dialPadBackspace() {
  if (isCallActive) return;
  if (dialedNumber.length === 0) return;
  dialedNumber = dialedNumber.slice(0, -1);
  renderDialerDisplay();
}

/** Clear the entire number */
function dialPadClear() {
  if (isCallActive) return;
  dialedNumber = '';
  renderDialerDisplay();
}

/** Brief CSS flash on the display box to confirm input */
function flashDisplay() {
  const display = document.getElementById('dialerDisplay');
  if (!display) return;
  display.classList.remove('flash');
  void display.offsetWidth;   // force reflow so animation re-triggers
  display.classList.add('flash');
}

/* ─────────────────────────────────────────────
   CALL SYSTEM
   ───────────────────────────────────────────── */

function requestMicPermission() {
  updateMicStatus('pending', 'Mic: requesting permission…');

  return navigator.mediaDevices
    .getUserMedia({ audio: true, video: false })
    .then(stream => {
      activeStream = stream;
      updateMicStatus('granted', 'Mic: ✔ Permission granted');
      return stream;
    })
    .catch(err => {
      updateMicStatus('denied', 'Mic: ✘ Permission denied');
      console.warn('[call] Mic permission denied:', err.message);
      throw err;
    });
}

/** Build a telephone ringback tone using the Web Audio API */
function startRingbackTone() {
  if (isMuted) return;

  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.18;
    gainNode.connect(audioCtx.destination);

    function createOscillator(freq) {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gainNode);
      osc.start();
      return osc;
    }

    const osc1 = createOscillator(440);
    const osc2 = createOscillator(480);

    ringbackNodes = { osc1, osc2, gainNode };

    // Cadence: 2 s on / 4 s off
    let ringing = true;
    function cadence() {
      if (!isCallActive || !ringbackNodes) return;
      if (ringing) {
        ringbackNodes.gainNode.gain.setTargetAtTime(isMuted ? 0 : 0.18, audioCtx.currentTime, 0.02);
        setTimeout(cadence, 2000);
      } else {
        ringbackNodes.gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.02);
        setTimeout(cadence, 4000);
      }
      ringing = !ringing;
    }
    cadence();

  } catch (e) {
    console.warn('[call] AudioContext unavailable:', e.message);
  }
}

function stopRingbackTone() {
  if (!ringbackNodes) return;
  try {
    ringbackNodes.gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.01);
    setTimeout(() => {
      try {
        ringbackNodes.osc1.stop();
        ringbackNodes.osc2.stop();
        audioCtx.close();
      } catch (_) {}
      ringbackNodes = null;
      audioCtx      = null;
    }, 150);
  } catch (e) {
    ringbackNodes = null;
    audioCtx      = null;
  }
}

function initiateCall() {
  if (isCallActive) return;

  if (dialedNumber.trim().length === 0) {
    updateCallStatus('idle', '⚠ Enter a number first');
    flashDisplay();
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    updateCallStatus('ended', '✘ MediaDevices API not available');
    return;
  }

  isCallActive = true;
  updateCallStatus('calling', `Calling ${formatDialedNumber(dialedNumber)}…`);
  updateCallPanelActive(true);
  lockDialPad(true);

  requestMicPermission()
    .then(() => {
      startRingbackTone();
      updateCallStatus('calling', `Ringing — ${formatDialedNumber(dialedNumber)}…`);
      setCallButtons(false, true);
    })
    .catch(() => {
      isCallActive = false;
      updateCallPanelActive(false);
      lockDialPad(false);
      updateCallStatus('ended', '✘ Call aborted — mic denied');
      setCallButtons(true, false);
    });
}

function endCall() {
  if (!isCallActive) return;

  stopRingbackTone();

  if (activeStream) {
    activeStream.getTracks().forEach(t => t.stop());
    activeStream = null;
  }

  isCallActive = false;
  updateCallStatus('ended', `Call ended — ${formatDialedNumber(dialedNumber)}`);
  updateMicStatus('', 'Mic: released');
  updateCallPanelActive(false);
  lockDialPad(false);
  setCallButtons(true, false);
}

/* ── Call UI helpers ── */

function updateCallStatus(stateClass, text) {
  const el   = document.getElementById('callStatus');
  const span = document.getElementById('callStatusText');
  if (!el || !span) return;
  el.classList.remove('calling', 'connected', 'ended', 'idle');
  if (stateClass) el.classList.add(stateClass);
  span.textContent = text;
}

function updateMicStatus(stateClass, text) {
  const el   = document.getElementById('micPermissionStatus');
  const span = document.getElementById('micStatusText');
  if (!el || !span) return;
  el.classList.remove('granted', 'denied', 'pending');
  if (stateClass) el.classList.add(stateClass);
  span.textContent = text;
}

function updateCallPanelActive(active) {
  const panel = document.getElementById('callPanel');
  if (!panel) return;
  panel.classList.toggle('active', active);
}

function lockDialPad(locked) {
  const pad = document.getElementById('dialPad');
  if (!pad) return;
  pad.classList.toggle('locked', locked);
  pad.querySelectorAll('.pad-key').forEach(btn => { btn.disabled = locked; });
}

function setCallButtons(callEnabled, endEnabled) {
  const callBtn = document.getElementById('callStartBtn');
  const endBtn  = document.getElementById('callEndBtn');
  if (callBtn) callBtn.disabled = !callEnabled;
  if (endBtn)  endBtn.disabled  = !endEnabled;
}

/* ─────────────────────────────────────────────
   KEYBOARD SUPPORT for the dial pad
   ───────────────────────────────────────────── */
function initKeyboardDialer() {
  document.addEventListener('keydown', e => {
    if (isCallActive) return;
    const tag = (e.target || {}).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (/^[0-9*#]$/.test(e.key)) {
      dialPadPress(e.key);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      dialPadBackspace();
    } else if (e.key === 'Escape') {
      dialPadClear();
    } else if (e.key === 'Enter') {
      initiateCall();
    }
  });
}

/* ─────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  renderClocks();
  updateClocks();
  setInterval(updateClocks, 1000);

  initConnectivity();
  renderDialerDisplay();
  initKeyboardDialer();
  setCallButtons(true, false);
});
