/* =============================================================
   Global Time Clock — app.js
   All application logic: clocks, theme, mute, connectivity,
   mobile network selection, outgoing call audio, dial-pad.
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
let activeStream   = null;      // MediaStream from getUserMedia
let audioCtx       = null;      // AudioContext for ringback tone
let ringbackNodes  = null;      // { osc1, osc2, gainNode }
let dialedNumber   = '';        // digits entered in the dial pad

/**
 * networkMode controls which network the call system prefers.
 *   'auto'   – use whatever is available (default)
 *   'mobile' – prefer mobile/cellular data
 *   'wifi'   – prefer WiFi
 */
let networkMode    = 'auto';

/**
 * Last-known NetworkInformation snapshot (may be null when API unavailable).
 * Updated by updateNetworkInfo() / refreshMobileNetwork().
 */
let lastNetInfo    = null;

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
      <div class="clock-time" id="time-${zone.iana.replace(/\//g, '-')}">--:--:--</div>
      <div class="clock-date" id="date-${zone.iana.replace(/\//g, '-')}">---</div>
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
      timeZone: zone.iana,
      hour:     '2-digit',
      minute:   '2-digit',
      second:   '2-digit',
      hour12:   true,
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
  const btn = document.getElementById('themeBtn');
  if (!btn) return;
  const dark = document.body.classList.contains('dark-theme');
  btn.innerHTML = dark ? '&#9728; Light Mode' : '&#127763; Dark Mode';
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

  // Immediately apply to active ringback gain
  if (ringbackNodes && ringbackNodes.gainNode && audioCtx) {
    ringbackNodes.gainNode.gain.setTargetAtTime(
      isMuted ? 0 : 0.18,
      audioCtx.currentTime,
      0.02
    );
  }
}

/* ─────────────────────────────────────────────
   CONNECTIVITY PANEL
   ───────────────────────────────────────────── */
function toggleConnectivityPanel() {
  const panel   = document.getElementById('connectivityPanel');
  const chevron = document.getElementById('connectivityChevron');
  if (!panel) return;

  const opening = !panel.classList.contains('expanded');
  panel.classList.toggle('expanded');

  if (chevron) chevron.innerHTML = opening ? '&#9650;' : '&#9660;';

  if (opening) {
    updateNetworkInfo();
    scanNetworks();
    refreshMobileNetwork();
  }
}

function initConnectivity() {
  updateConnectivityUI();
  probeConnectivity();

  window.addEventListener('online',  () => {
    updateConnectivityUI();
    probeConnectivity();
    refreshMobileNetwork();
  });
  window.addEventListener('offline', () => {
    updateConnectivityUI();
    probeConnectivity();
    refreshMobileNetwork();
  });

  const conn = _getConn();
  if (conn) {
    conn.addEventListener('change', () => {
      updateNetworkInfo();
      refreshMobileNetwork();
    });
  }
}

/** Convenience: returns the best NetworkInformation object available */
function _getConn() {
  return navigator.connection
      || navigator.mozConnection
      || navigator.webkitConnection
      || null;
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

  const conn = _getConn();
  if (!conn) {
    infoEl.innerHTML =
      '<span class="net-detail">Network Info API not available in this browser.</span>';
    return;
  }

  infoEl.innerHTML = `
    <span class="net-detail">Type: <strong>${conn.type            || 'n/a'}</strong></span>
    <span class="net-detail">Effective: <strong>${conn.effectiveType  || 'n/a'}</strong></span>
    <span class="net-detail">Downlink: <strong>${
      conn.downlink != null ? conn.downlink + ' Mbps' : 'n/a'}</strong></span>
    <span class="net-detail">RTT: <strong>${
      conn.rtt      != null ? conn.rtt      + ' ms'   : 'n/a'}</strong></span>
  `;
}

function scanNetworks() {
  const list = document.getElementById('networkList');
  if (!list) return;
  list.innerHTML = '';

  const conn = _getConn();
  if (conn && conn.effectiveType) {
    const li = document.createElement('li');
    li.className   = 'network-list-item selected';
    li.textContent =
      `Connected — ${conn.effectiveType.toUpperCase()} (${conn.type || 'unknown'})`;
    list.appendChild(li);
  }

  const note = document.createElement('li');
  note.className   = 'network-list-item placeholder';
  note.textContent = 'Full Wi-Fi scanning requires native app permissions.';
  list.appendChild(note);
}

/* ─────────────────────────────────────────────
   MOBILE NETWORK PANEL
   ───────────────────────────────────────────── */

/**
 * Called when a network-mode radio button changes.
 * @param {'auto'|'mobile'|'wifi'} mode
 */
function setNetworkMode(mode) {
  networkMode = mode;
  console.info('[network] Mode set to:', mode);
  refreshMobileNetwork();
  updateCallNetworkBadge();
}

/**
 * Read the NetworkInformation API and populate the mobile network details.
 * Also updates the badge in the connectivity panel and call panel.
 */
function refreshMobileNetwork() {
  const badge      = document.getElementById('mobileNetBadge');
  const typeText   = document.getElementById('mobileNetTypeText');
  const effText    = document.getElementById('mobileNetEffText');
  const dlText     = document.getElementById('mobileNetDlText');
  const rttText    = document.getElementById('mobileNetRttText');

  const conn = _getConn();

  if (!conn) {
    if (badge)    badge.textContent    = 'API unavailable';
    if (typeText) typeText.textContent = 'Type: n/a';
    if (effText)  effText.textContent  = 'Effective: n/a';
    if (dlText)   dlText.textContent   = 'Downlink: n/a';
    if (rttText)  rttText.textContent  = 'RTT: n/a';
    lastNetInfo = null;
    updateCallNetworkBadge();
    return;
  }

  lastNetInfo = {
    type:          conn.type          || null,
    effectiveType: conn.effectiveType || null,
    downlink:      conn.downlink      != null ? conn.downlink : null,
    rtt:           conn.rtt           != null ? conn.rtt      : null,
    saveData:      conn.saveData      || false,
  };

  /* ── Determine if we're on cellular/mobile ── */
  const isCellular = lastNetInfo.type === 'cellular';
  const isWifi     = lastNetInfo.type === 'wifi';
  const typeLabel  = lastNetInfo.type ? lastNetInfo.type.toUpperCase() : 'UNKNOWN';

  /* ── Badge text ── */
  let badgeText;
  if (!navigator.onLine) {
    badgeText = 'Offline';
  } else if (networkMode === 'mobile') {
    badgeText = isCellular
      ? `📶 Mobile (${lastNetInfo.effectiveType || '?'})`
      : `📶 Mobile preferred — on ${typeLabel}`;
  } else if (networkMode === 'wifi') {
    badgeText = isWifi
      ? `📡 WiFi (${lastNetInfo.effectiveType || '?'})`
      : `📡 WiFi preferred — on ${typeLabel}`;
  } else {
    // auto
    badgeText = `${typeLabel} — ${lastNetInfo.effectiveType || '?'}`;
  }

  if (badge) badge.textContent = badgeText;

  /* ── Detail fields ── */
  if (typeText) typeText.textContent =
    `Type: ${lastNetInfo.type || 'n/a'}`;
  if (effText)  effText.textContent  =
    `Effective: ${lastNetInfo.effectiveType || 'n/a'}`;
  if (dlText)   dlText.textContent   =
    `Downlink: ${lastNetInfo.downlink != null ? lastNetInfo.downlink + ' Mbps' : 'n/a'}`;
  if (rttText)  rttText.textContent  =
    `RTT: ${lastNetInfo.rtt != null ? lastNetInfo.rtt + ' ms' : 'n/a'}`;

  /* ── Highlight the mobile-net panel when cellular is active ── */
  const panel = document.getElementById('mobileNetworkPanel');
  if (panel) {
    panel.classList.toggle('cellular-active', isCellular);
    panel.classList.toggle('wifi-active',     isWifi);
  }

  updateCallNetworkBadge();
}

/**
 * Update the small badge inside the call panel header that shows
 * which network will be used for the call.
 */
function updateCallNetworkBadge() {
  const badge = document.getElementById('callNetworkBadge');
  if (!badge) return;

  if (!navigator.onLine) {
    badge.textContent  = '⚠ Offline';
    badge.className    = 'call-network-badge offline';
    return;
  }

  const conn = lastNetInfo;

  if (networkMode === 'mobile') {
    const label = conn ? (conn.effectiveType || conn.type || 'mobile').toUpperCase() : 'MOBILE';
    badge.textContent = `📶 ${label}`;
    badge.className   = 'call-network-badge mobile';
  } else if (networkMode === 'wifi') {
    const label = conn ? (conn.effectiveType || conn.type || 'wifi').toUpperCase() : 'WIFI';
    badge.textContent = `📡 ${label}`;
    badge.className   = 'call-network-badge wifi';
  } else {
    // auto
    if (conn && conn.type) {
      const icon  = conn.type === 'cellular' ? '📶' : conn.type === 'wifi' ? '📡' : '🌐';
      const label = (conn.effectiveType || conn.type).toUpperCase();
      badge.textContent = `${icon} ${label}`;
      badge.className   = 'call-network-badge auto';
    } else {
      badge.textContent = '🌐 Auto';
      badge.className   = 'call-network-badge auto';
    }
  }
}

/* ─────────────────────────────────────────────
   DIAL PAD — number display helpers
   ───────────────────────────────────────────── */

function renderDialerDisplay() {
  const numEl     = document.getElementById('dialerNumber');
  const readoutEl = document.getElementById('readoutText');
  const readout   = document.getElementById('dialedNumberReadout');

  if (!numEl) return;

  if (dialedNumber.length === 0) {
    numEl.textContent = '\u2015';   // ― em-dash placeholder
    numEl.classList.add('placeholder');
    if (readoutEl) readoutEl.textContent = '';
    if (readout)   readout.classList.remove('active');
  } else {
    const formatted = formatDialedNumber(dialedNumber);
    numEl.textContent = formatted;
    numEl.classList.remove('placeholder');
    if (readoutEl) readoutEl.textContent = formatted;
    if (readout)   readout.classList.add('active');
  }
}

/**
 * Format the raw digit string for display.
 * Handles US numbers (7-, 10-, 11-digit with +1 prefix) and leaves
 * other strings (short sequences, non-US) essentially unchanged.
 */
function formatDialedNumber(raw) {
  const digits = raw.replace(/\D/g, '');

  // +1 XXXXXXXXXX → +1 (NXX) NXX-XXXX
  if (raw.startsWith('+1') && digits.length >= 11) {
    const d = digits.slice(1);
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
  }
  // 10-digit → (NXX) NXX-XXXX
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  }
  // 7-digit → NXX-XXXX
  if (digits.length === 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}`;
  }

  return raw;
}

/** Called by each dial-pad key button (onclick) */
function dialPadPress(char) {
  if (isCallActive) return;
  if (dialedNumber.length >= 20) return;

  dialedNumber += char;
  renderDialerDisplay();
  flashDisplay();
}

/** Remove last character */
function dialPadBackspace() {
  if (isCallActive) return;
  if (dialedNumber.length === 0) return;
  dialedNumber = dialedNumber.slice(0, -1);
  renderDialerDisplay();
}

/** Clear all digits */
function dialPadClear() {
  if (isCallActive) return;
  dialedNumber = '';
  renderDialerDisplay();
}

/** Brief CSS flash on the display box to confirm key press */
function flashDisplay() {
  const display = document.getElementById('dialerDisplay');
  if (!display) return;
  display.classList.remove('flash');
  void display.offsetWidth;       // force reflow so animation re-triggers
  display.classList.add('flash');
}

/* ─────────────────────────────────────────────
   CALL SYSTEM
   ───────────────────────────────────────────── */

/** Request microphone access */
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

/** Build a US telephone ringback tone (440 Hz + 480 Hz, 2 s on / 4 s off) */
function startRingbackTone() {
  if (isMuted) return;

  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.18;
    gainNode.connect(audioCtx.destination);

    function makeOsc(freq) {
      const osc = audioCtx.createOscillator();
      osc.type            = 'sine';
      osc.frequency.value = freq;
      osc.connect(gainNode);
      osc.start();
      return osc;
    }

    const osc1 = makeOsc(440);
    const osc2 = makeOsc(480);
    ringbackNodes = { osc1, osc2, gainNode };

    let ringing = true;
    function cadence() {
      if (!isCallActive || !ringbackNodes) return;
      if (ringing) {
        ringbackNodes.gainNode.gain.setTargetAtTime(
          isMuted ? 0 : 0.18, audioCtx.currentTime, 0.02);
        setTimeout(cadence, 2000);
      } else {
        ringbackNodes.gainNode.gain.setTargetAtTime(
          0, audioCtx.currentTime, 0.02);
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
    ringbackNodes.gainNode.gain.setTargetAtTime(
      0, audioCtx.currentTime, 0.01);
    setTimeout(() => {
      try {
        ringbackNodes.osc1.stop();
        ringbackNodes.osc2.stop();
        audioCtx.close();
      } catch (_) { /* already stopped */ }
      ringbackNodes = null;
      audioCtx      = null;
    }, 150);
  } catch (_) {
    ringbackNodes = null;
    audioCtx      = null;
  }
}

/**
 * Check whether the selected network mode is satisfied.
 * Returns { ok: boolean, warning: string|null }
 */
function checkNetworkForCall() {
  if (!navigator.onLine) {
    return { ok: false, warning: '✘ No network connection' };
  }

  const conn = lastNetInfo;
  if (!conn) {
    // API unavailable — allow call with no specific routing
    return { ok: true, warning: null };
  }

  if (networkMode === 'mobile' && conn.type !== 'cellular') {
    // Not on cellular but user prefers it — warn and continue
    return {
      ok:      true,
      warning: `⚠ Preferred Mobile not active — using ${conn.type || 'unknown'}`,
    };
  }

  if (networkMode === 'wifi' && conn.type !== 'wifi') {
    return {
      ok:      true,
      warning: `⚠ Preferred WiFi not active — using ${conn.type || 'unknown'}`,
    };
  }

  return { ok: true, warning: null };
}

/** Begin an outgoing call */
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

  /* ── Network pre-flight check ── */
  const { ok, warning } = checkNetworkForCall();
  if (!ok) {
    updateCallStatus('ended', warning);
    return;
  }

  // Show network warning if any (non-blocking)
  if (warning) {
    updateCallStatus('calling', warning);
  }

  isCallActive = true;
  updateCallPanelActive(true);
  lockDialPad(true);
  setCallButtons(false, true);

  /* ── Network label for status messages ── */
  const netLabel = _buildNetLabel();

  updateCallStatus('calling',
    `${netLabel} Calling ${formatDialedNumber(dialedNumber)}…`);

  requestMicPermission()
    .then(() => {
      startRingbackTone();
      updateCallStatus('calling',
        `${netLabel} Ringing — ${formatDialedNumber(dialedNumber)}…`);
    })
    .catch(() => {
      isCallActive = false;
      updateCallPanelActive(false);
      lockDialPad(false);
      setCallButtons(true, false);
      updateCallStatus('ended', '✘ Call aborted — mic denied');
    });
}

/** End the active call and release all resources */
function endCall() {
  if (!isCallActive) return;

  stopRingbackTone();

  if (activeStream) {
    activeStream.getTracks().forEach(t => t.stop());
    activeStream = null;
  }

  isCallActive = false;
  updateCallStatus('ended',
    `Call ended — ${formatDialedNumber(dialedNumber)}`);
  updateMicStatus('', 'Mic: released');
  updateCallPanelActive(false);
  lockDialPad(false);
  setCallButtons(true, false);
}

/** Build a short network label string for status messages */
function _buildNetLabel() {
  if (networkMode === 'mobile') return '📶';
  if (networkMode === 'wifi')   return '📡';
  if (lastNetInfo) {
    if (lastNetInfo.type === 'cellular') return '📶';
    if (lastNetInfo.type === 'wifi')     return '📡';
  }
  return '🌐';
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
  refreshMobileNetwork();     // prime the mobile network panel on load
  updateCallNetworkBadge();

  renderDialerDisplay();
  initKeyboardDialer();
  setCallButtons(true, false);
});
