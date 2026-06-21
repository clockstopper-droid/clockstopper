/* =============================================================
   Global Time Clock — app.js
   Mobile Android dialer edition.

   Features:
     • Three fixed world clocks (Eastern / Central / Western)
     • Full dial-pad with display box + live readout
     • Outgoing call audio (Web Audio API ringback + mic via MediaDevices)
     • Network mode selector (Auto / Wi-Fi / Mobile)
     • NetworkInformation API detection + connectivity probe
     • Dark theme (default) with orange accent keypad
     • Mute toggle for call audio
     • Bottom-nav tab switching (Clocks / Dialer / Network)
     • Keyboard support for dial pad
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
   APPLICATION STATE
   ───────────────────────────────────────────── */
let isMuted       = false;
let isCallActive  = false;
let activeStream  = null;       // MediaStream from getUserMedia
let audioCtx      = null;       // AudioContext for ringback tone
let ringbackNodes = null;       // { osc1, osc2, gainNode }
let dialedNumber  = '';         // raw digit string from dial pad
let activeTab     = 'clocks';   // currently visible tab id

/**
 * networkMode controls which network the call system prefers.
 *   'auto'   – use whatever is available (default)
 *   'mobile' – prefer mobile/cellular data
 *   'wifi'   – prefer Wi-Fi
 */
let networkMode = 'auto';

/**
 * Last-known NetworkInformation snapshot (null when API unavailable).
 * Updated by refreshMobileNetwork() / updateNetworkInfo().
 */
let lastNetInfo = null;

/* ═══════════════════════════════════════════════════════════════
   SECTION 1 — TAB NAVIGATION
   ════════════════════════════════════════════════════════════ */

/**
 * Switch the visible tab panel and highlight the matching nav button.
 * @param {'clocks'|'dialer'|'network'} tabId
 */
function switchTab(tabId) {
  if (tabId === activeTab) return;
  activeTab = tabId;

  // Deactivate all panels
  document.querySelectorAll('.tab-panel').forEach(el => el.classList.remove('active'));
  // Activate target panel
  const panel = document.getElementById('tab-' + tabId);
  if (panel) panel.classList.add('active');

  // Update nav buttons
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  // On switching to network tab, refresh live data
  if (tabId === 'network') {
    updateNetworkInfo();
    scanNetworks();
    refreshMobileNetwork();
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 2 — CLOCK RENDERING & TICK
   ════════════════════════════════════════════════════════════ */

function renderClocks() {
  const grid = document.getElementById('clocksGrid');
  if (!grid) return;
  grid.innerHTML = '';

  FIXED_ZONES.forEach(zone => {
    const card = document.createElement('div');
    card.className  = 'clock-card';
    card.dataset.tz = zone.iana;

    const safeId = zone.iana.replace(/\//g, '-');
    card.innerHTML = `
      <div class="clock-label">${zone.label}</div>
      <div class="clock-time" id="time-${safeId}">--:--:--</div>
      <div class="clock-date" id="date-${safeId}">---</div>
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

    timeEl.textContent = new Intl.DateTimeFormat('en-US', {
      timeZone: zone.iana,
      hour:     '2-digit',
      minute:   '2-digit',
      second:   '2-digit',
      hour12:   true,
    }).format(now);

    dateEl.textContent = new Intl.DateTimeFormat('en-US', {
      timeZone: zone.iana,
      weekday:  'short',
      month:    'short',
      day:      'numeric',
      year:     'numeric',
    }).format(now);
  });
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 3 — THEME & MUTE TOGGLES
   ════════════════════════════════════════════════════════════ */

function toggleTheme() {
  document.body.classList.toggle('dark-theme');
  const btn  = document.getElementById('themeBtn');
  const dark = document.body.classList.contains('dark-theme');
  if (btn) btn.innerHTML = dark ? '&#9728;' : '&#127763;';
}

function toggleMute() {
  isMuted = !isMuted;
  const btn = document.getElementById('muteBtn');
  if (btn) {
    btn.classList.toggle('muted', isMuted);
    btn.innerHTML = isMuted ? '&#128263;' : '&#128266;';
    btn.title     = isMuted ? 'Unmute' : 'Mute';
  }

  // Immediately apply to any live ringback gain
  if (ringbackNodes && ringbackNodes.gainNode && audioCtx) {
    ringbackNodes.gainNode.gain.setTargetAtTime(
      isMuted ? 0 : 0.18,
      audioCtx.currentTime,
      0.02
    );
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 4 — CONNECTIVITY  (online/offline + probe)
   ════════════════════════════════════════════════════════════ */

/** Returns the best available NetworkInformation object or null. */
function _getConn() {
  return navigator.connection
      || navigator.mozConnection
      || navigator.webkitConnection
      || null;
}

function initConnectivity() {
  updateConnectivityUI();
  probeConnectivity();

  window.addEventListener('online', () => {
    updateConnectivityUI();
    probeConnectivity();
    refreshMobileNetwork();
    updateCallNetworkBadge();
  });
  window.addEventListener('offline', () => {
    updateConnectivityUI();
    probeConnectivity();
    refreshMobileNetwork();
    updateCallNetworkBadge();
  });

  const conn = _getConn();
  if (conn) {
    conn.addEventListener('change', () => {
      updateNetworkInfo();
      refreshMobileNetwork();
      updateCallNetworkBadge();
    });
  }
}

function updateConnectivityUI() {
  const card     = document.getElementById('wifiStatus');
  const textEl   = document.getElementById('wifiStatusText');
  if (!card || !textEl) return;

  const online = navigator.onLine;
  card.classList.toggle('online',  online);
  card.classList.toggle('offline', !online);
  textEl.textContent = online ? 'Online' : 'Offline';
}

function probeConnectivity() {
  const chip    = document.getElementById('connectivityProbeStatus');
  const textEl  = document.getElementById('probeStatusText');
  if (!chip || !textEl) return;

  chip.classList.remove('verified', 'unverified');
  textEl.textContent = 'Probe: checking…';

  fetch('https://www.gstatic.com/generate_204', {
    method: 'HEAD',
    mode:   'no-cors',
    cache:  'no-store',
  })
    .then(() => {
      chip.classList.add('verified');
      textEl.textContent = '✔ Reachable';
    })
    .catch(() => {
      chip.classList.add('unverified');
      textEl.textContent = '✘ Unreachable';
    });
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 5 — NETWORK INFORMATION & MOBILE NETWORK
   ════════════════════════════════════════════════════════════ */

/** Populate the Connection Details card on the Network tab. */
function updateNetworkInfo() {
  const infoEl = document.getElementById('networkInfo');
  if (!infoEl) return;

  const conn = _getConn();
  if (!conn) {
    infoEl.innerHTML = '<span class="net-detail">Network Info API not available in this browser.</span>';
    return;
  }

  infoEl.innerHTML = `
    <span class="net-detail">Type: <strong>${conn.type            || 'n/a'}</strong></span>
    <span class="net-detail">Effective: <strong>${conn.effectiveType  || 'n/a'}</strong></span>
    <span class="net-detail">Downlink: <strong>${
      conn.downlink != null ? conn.downlink + '&nbsp;Mbps' : 'n/a'}</strong></span>
    <span class="net-detail">RTT: <strong>${
      conn.rtt      != null ? conn.rtt      + '&nbsp;ms'   : 'n/a'}</strong></span>
    <span class="net-detail">Save&nbsp;Data: <strong>${
      conn.saveData ? 'ON' : 'OFF'}</strong></span>
  `;
}

/** Enumerate available networks into the list card. */
function scanNetworks() {
  const list = document.getElementById('networkList');
  if (!list) return;
  list.innerHTML = '';

  const conn = _getConn();
  if (conn && conn.effectiveType) {
    const isCellular = conn.type === 'cellular';
    const li = document.createElement('li');
    li.className = 'network-list-item selected' + (isCellular ? ' mobile' : '');
    li.textContent =
      `${isCellular ? '📶' : '📡'} Connected — ${conn.effectiveType.toUpperCase()} (${conn.type || 'unknown'})`;
    list.appendChild(li);
  }

  const note = document.createElement('li');
  note.className   = 'network-list-item placeholder';
  note.textContent = 'Full Wi-Fi scanning requires native app permissions.';
  list.appendChild(note);
}

/**
 * Called when a network-mode radio button changes.
 * @param {'auto'|'mobile'|'wifi'} mode
 */
function setNetworkMode(mode) {
  networkMode = mode;
  refreshMobileNetwork();
  updateCallNetworkBadge();
}

/**
 * Read the NetworkInformation API, update lastNetInfo,
 * and populate all Mobile Network UI elements.
 */
function refreshMobileNetwork() {
  const badge    = document.getElementById('mobileNetBadge');
  const typeText = document.getElementById('mobileNetTypeText');
  const effText  = document.getElementById('mobileNetEffText');
  const dlText   = document.getElementById('mobileNetDlText');
  const rttText  = document.getElementById('mobileNetRttText');

  const conn = _getConn();

  if (!conn) {
    lastNetInfo = null;
    if (badge)    badge.textContent    = 'API unavailable';
    if (typeText) typeText.textContent = 'Type: n/a';
    if (effText)  effText.textContent  = 'Effective: n/a';
    if (dlText)   dlText.textContent   = 'Downlink: n/a';
    if (rttText)  rttText.textContent  = 'RTT: n/a';
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

  const isCellular = lastNetInfo.type === 'cellular';
  const isWifi     = lastNetInfo.type === 'wifi';
  const typeLabel  = lastNetInfo.type ? lastNetInfo.type.toUpperCase() : 'UNKNOWN';

  /* Badge text */
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
    badgeText = `${isCellular ? '📶' : isWifi ? '📡' : '🌐'} ${typeLabel} — ${lastNetInfo.effectiveType || '?'}`;
  }

  if (badge) badge.textContent = badgeText;

  /* Detail chips */
  if (typeText) typeText.textContent = `Type: ${lastNetInfo.type || 'n/a'}`;
  if (effText)  effText.textContent  = `Effective: ${lastNetInfo.effectiveType || 'n/a'}`;
  if (dlText)   dlText.textContent   = `Downlink: ${lastNetInfo.downlink != null ? lastNetInfo.downlink + ' Mbps' : 'n/a'}`;
  if (rttText)  rttText.textContent  = `RTT: ${lastNetInfo.rtt != null ? lastNetInfo.rtt + ' ms' : 'n/a'}`;

  /* Highlight the mode card */
  const panel = document.getElementById('mobileNetworkPanel');
  if (panel) {
    panel.classList.toggle('cellular-active', isCellular);
    panel.classList.toggle('wifi-active',     isWifi);
  }

  updateCallNetworkBadge();
}

/** Update the network badge shown inside the call overlay. */
function updateCallNetworkBadge() {
  const badge = document.getElementById('callNetworkBadge');
  if (!badge) return;

  if (!navigator.onLine) {
    badge.textContent = '⚠ Offline';
    badge.className   = 'call-network-badge offline';
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

/* ═══════════════════════════════════════════════════════════════
   SECTION 6 — DIAL PAD
   ════════════════════════════════════════════════════════════ */

/**
 * Format the raw digit string for display.
 * Handles US 7-, 10-, and +1-prefixed 11-digit numbers.
 */
function formatDialedNumber(raw) {
  const digits = raw.replace(/\D/g, '');

  if (raw.startsWith('+1') && digits.length >= 11) {
    const d = digits.slice(1);
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  }
  if (digits.length === 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}`;
  }
  return raw;
}

/** Sync the dialer display box and live readout with current dialedNumber. */
function renderDialerDisplay() {
  const numEl     = document.getElementById('dialerNumber');
  const readoutEl = document.getElementById('readoutText');
  const readout   = document.getElementById('dialedNumberReadout');

  if (!numEl) return;

  if (dialedNumber.length === 0) {
    numEl.textContent = '\u2015';   // ― placeholder
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

/** Flash the display box to confirm key press. */
function flashDisplay() {
  const display = document.getElementById('dialerDisplay');
  if (!display) return;
  display.classList.remove('flash');
  void display.offsetWidth;   // force reflow to re-trigger animation
  display.classList.add('flash');
}

/** Append a character from a pad key press. */
function dialPadPress(char) {
  if (isCallActive) return;
  if (dialedNumber.length >= 20) return;

  dialedNumber += char;
  renderDialerDisplay();
  flashDisplay();
}

/** Remove the last character (backspace). */
function dialPadBackspace() {
  if (isCallActive) return;
  if (dialedNumber.length === 0) return;
  dialedNumber = dialedNumber.slice(0, -1);
  renderDialerDisplay();
}

/** Clear all entered digits. */
function dialPadClear() {
  if (isCallActive) return;
  dialedNumber = '';
  renderDialerDisplay();
}

/** Lock / unlock all pad keys (while call is active). */
function lockDialPad(locked) {
  const pad = document.getElementById('dialPad');
  if (!pad) return;
  pad.classList.toggle('locked', locked);
  pad.querySelectorAll('.pad-key').forEach(btn => { btn.disabled = locked; });
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 7 — CALL SYSTEM
   ════════════════════════════════════════════════════════════ */

/** Request microphone access via MediaDevices API. */
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

/**
 * Build a US telephone ringback tone using the Web Audio API.
 * 440 Hz + 480 Hz sine waves, cadence 2 s on / 4 s off.
 */
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
    (function cadence() {
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
    }());
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
 * Pre-flight check: verify the selected network mode is satisfied.
 * Returns { ok: boolean, warning: string|null }
 */
function checkNetworkForCall() {
  if (!navigator.onLine) {
    return { ok: false, warning: '✘ No network connection' };
  }

  const conn = lastNetInfo;
  if (!conn) {
    // NetworkInformation API unavailable — allow call, no specific routing
    return { ok: true, warning: null };
  }

  if (networkMode === 'mobile' && conn.type !== 'cellular') {
    return {
      ok:      true,
      warning: `⚠ Mobile preferred — currently on ${conn.type || 'unknown'}`,
    };
  }

  if (networkMode === 'wifi' && conn.type !== 'wifi') {
    return {
      ok:      true,
      warning: `⚠ WiFi preferred — currently on ${conn.type || 'unknown'}`,
    };
  }

  return { ok: true, warning: null };
}

/** Short emoji label representing the active or preferred network. */
function _buildNetLabel() {
  if (networkMode === 'mobile') return '📶';
  if (networkMode === 'wifi')   return '📡';
  if (lastNetInfo) {
    if (lastNetInfo.type === 'cellular') return '📶';
    if (lastNetInfo.type === 'wifi')     return '📡';
  }
  return '🌐';
}

/** Begin an outgoing call. */
function initiateCall() {
  if (isCallActive) return;

  if (dialedNumber.trim().length === 0) {
    updateCallStatus('idle', '⚠ Enter a number first');
    flashDisplay();
    // Switch to dialer tab if needed
    if (activeTab !== 'dialer') switchTab('dialer');
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    updateCallStatus('ended', '✘ MediaDevices API not available');
    return;
  }

  /* Network pre-flight */
  const { ok, warning } = checkNetworkForCall();
  if (!ok) {
    updateCallStatus('ended', warning);
    return;
  }

  isCallActive = true;
  updateCallPanelActive(true);
  lockDialPad(true);
  setCallButtons(false, true);

  const netLabel = _buildNetLabel();

  if (warning) {
    updateCallStatus('calling', warning);
  } else {
    updateCallStatus('calling', `${netLabel} Calling ${formatDialedNumber(dialedNumber)}…`);
  }

  /* Show call overlay */
  showCallOverlay(formatDialedNumber(dialedNumber), `${netLabel} Calling…`);

  requestMicPermission()
    .then(() => {
      startRingbackTone();
      const msg = `${netLabel} Ringing — ${formatDialedNumber(dialedNumber)}…`;
      updateCallStatus('calling', msg);
      updateOverlayStatus(msg);
    })
    .catch(() => {
      isCallActive = false;
      updateCallPanelActive(false);
      lockDialPad(false);
      setCallButtons(true, false);
      updateCallStatus('ended', '✘ Call aborted — mic denied');
      hideCallOverlay();
    });
}

/** End the active call and release all resources. */
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
  hideCallOverlay();
}

/* ─────────────────────────────────────────────
   CALL OVERLAY helpers
   ───────────────────────────────────────────── */
function showCallOverlay(number, status) {
  const overlay = document.getElementById('callOverlay');
  const numEl   = document.getElementById('overlayNumber');
  const statEl  = document.getElementById('overlayStatus');
  if (!overlay) return;
  if (numEl)  numEl.textContent  = number;
  if (statEl) statEl.textContent = status;
  overlay.classList.add('visible');
  updateCallNetworkBadge();
}

function updateOverlayStatus(text) {
  const statEl = document.getElementById('overlayStatus');
  if (statEl) statEl.textContent = text;
}

function hideCallOverlay() {
  const overlay = document.getElementById('callOverlay');
  if (overlay) overlay.classList.remove('visible');
}

/* ─────────────────────────────────────────────
   CALL / MIC UI helpers
   ───────────────────────────────────────────── */
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
  const panel = document.getElementById('tab-dialer');
  if (panel) panel.classList.toggle('call-active', active);
}

function setCallButtons(callEnabled, endEnabled) {
  const callBtn = document.getElementById('callStartBtn');
  const endBtn  = document.getElementById('callEndBtn');
  if (callBtn) callBtn.disabled = !callEnabled;
  if (endBtn)  endBtn.disabled  = !endEnabled;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 8 — KEYBOARD SUPPORT
   ════════════════════════════════════════════════════════════ */

function initKeyboardDialer() {
  document.addEventListener('keydown', e => {
    if (isCallActive) return;
    const tag = (e.target || {}).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (/^[0-9*#]$/.test(e.key)) {
      dialPadPress(e.key);
      if (activeTab !== 'dialer') switchTab('dialer');
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

/* ═══════════════════════════════════════════════════════════════
   SECTION 9 — INITIALISATION
   ════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  /* Clocks */
  renderClocks();
  updateClocks();
  setInterval(updateClocks, 1000);

  /* Connectivity */
  initConnectivity();
  refreshMobileNetwork();
  updateCallNetworkBadge();

  /* Dialer */
  renderDialerDisplay();
  initKeyboardDialer();
  setCallButtons(true, false);

  /* Ensure the correct tab is visible on load */
  switchTab('clocks');
});
