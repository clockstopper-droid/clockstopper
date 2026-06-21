/* =============================================================
   Global Time Clock — app.js
   All application logic: clocks, theme, mute, connectivity,
   phone / outgoing-call audio with microphone permission.
   ============================================================= */

'use strict';

/* ─────────────────────────────────────────────
   1.  WORLD-CLOCK STATE
───────────────────────────────────────────── */
let timezones = ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];
let isMuted   = false;          // global app mute (ticking sounds / alerts)
let clockInterval = null;

/* ─────────────────────────────────────────────
   2.  CLOCK RENDERING
───────────────────────────────────────────── */
function renderClocks() {
  const grid = document.getElementById('clocksGrid');
  if (!grid) return;
  grid.innerHTML = '';
  timezones.forEach(tz => {
    const card = document.createElement('div');
    card.className  = 'clock-card';
    card.id         = 'clock-' + tz.replace(/\//g, '_');
    card.innerHTML  = `
      <div class="clock-tz">${tz}</div>
      <div class="clock-time" id="time-${tz.replace(/\//g, '_')}">--:--:--</div>
      <button class="remove-btn" onclick="removeTimezone('${tz}')">✕</button>`;
    grid.appendChild(card);
  });
}

function updateClocks() {
  const now = new Date();
  timezones.forEach(tz => {
    const el = document.getElementById('time-' + tz.replace(/\//g, '_'));
    if (!el) return;
    try {
      el.textContent = new Intl.DateTimeFormat('en-US', {
        timeZone   : tz,
        hour       : '2-digit',
        minute     : '2-digit',
        second     : '2-digit',
        hour12     : true
      }).format(now);
    } catch (_) {
      el.textContent = 'Invalid TZ';
    }
  });
}

function startClockInterval() {
  if (clockInterval) clearInterval(clockInterval);
  clockInterval = setInterval(updateClocks, 1000);
}

/* ─────────────────────────────────────────────
   3.  ADD / REMOVE TIMEZONE (global — onclick)
───────────────────────────────────────────── */
function addTimezone() {
  const input = document.getElementById('tzInput');
  const tz    = (input ? input.value.trim() : '') || 'UTC';

  // Validate via Intl
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
  } catch (_) {
    alert('Invalid IANA time zone: ' + tz);
    return;
  }

  if (timezones.includes(tz)) {
    alert('Clock for "' + tz + '" is already displayed.');
    return;
  }

  timezones.push(tz);
  renderClocks();
  updateClocks();
  if (input) input.value = '';
}

function removeTimezone(tz) {
  timezones = timezones.filter(t => t !== tz);
  renderClocks();
}

/* ─────────────────────────────────────────────
   4.  THEME TOGGLE (global — onclick)
───────────────────────────────────────────── */
function toggleTheme() {
  document.body.classList.toggle('dark-theme');
}

/* ─────────────────────────────────────────────
   5.  APP-LEVEL MUTE TOGGLE (global — onclick)
   (controls clock-tick / alert audio, NOT call audio)
───────────────────────────────────────────── */
function toggleMute() {
  isMuted = !isMuted;
  const btn = document.getElementById('muteBtn');
  if (!btn) return;
  if (isMuted) {
    btn.textContent = '🔕 Sound Off';
    btn.classList.add('muted');
  } else {
    btn.textContent = '🔔 Sound On';
    btn.classList.remove('muted');
  }
}

/* ─────────────────────────────────────────────
   6.  CONNECTIVITY PANEL (global — onclick)
───────────────────────────────────────────── */
let panelExpanded = false;

function toggleConnectivityPanel() {
  panelExpanded = !panelExpanded;
  const panel   = document.getElementById('connectivityPanel');
  const chevron = document.getElementById('panelChevron');
  if (panel)   panel.classList.toggle('expanded', panelExpanded);
  if (chevron) chevron.textContent = panelExpanded ? '▲' : '▼';
  if (panelExpanded) {
    updateNetworkInfo();
    scanNetworks();
  }
}

function updateConnectivityUI(isOnline) {
  const el = document.getElementById('wifiStatus');
  if (!el) return;
  el.textContent = isOnline ? '✅ Online' : '❌ Offline';
  el.classList.toggle('online',  isOnline);
  el.classList.toggle('offline', !isOnline);
  probeConnectivity();
}

function probeConnectivity() {
  const el = document.getElementById('connectivityProbeStatus');
  if (!el) return;
  el.textContent = 'Probe: checking…';
  el.className   = 'probe-status';

  fetch('https://www.gstatic.com/generate_204', { method: 'HEAD', cache: 'no-store', mode: 'no-cors' })
    .then(() => {
      el.textContent = 'Probe: ✅ Internet confirmed';
      el.classList.add('verified');
    })
    .catch(() => {
      el.textContent = 'Probe: ⚠️ No internet access';
      el.classList.add('unverified');
    });
}

function updateNetworkInfo() {
  const el  = document.getElementById('networkInfo');
  const nav = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!el) return;
  if (!nav) {
    el.textContent = 'Network API not available in this browser.';
    return;
  }
  el.innerHTML = `
    <strong>Type:</strong> ${nav.type          || 'unknown'}<br/>
    <strong>Effective:</strong> ${nav.effectiveType || 'unknown'}<br/>
    <strong>Downlink:</strong> ${nav.downlink != null ? nav.downlink + ' Mbps' : 'n/a'}<br/>
    <strong>RTT:</strong> ${nav.rtt      != null ? nav.rtt      + ' ms'   : 'n/a'}`;
}

function scanNetworks() {
  const list = document.getElementById('networkList');
  if (!list) return;
  list.innerHTML = '<li class="network-list-item">Network scanning is not supported by browser APIs.</li>';
}

function initConnectivity() {
  window.addEventListener('online',  () => updateConnectivityUI(true));
  window.addEventListener('offline', () => updateConnectivityUI(false));
  updateConnectivityUI(navigator.onLine);
}

/* ─────────────────────────────────────────────
   7.  PHONE / OUTGOING CALL SYSTEM
───────────────────────────────────────────── */

/* --- State --- */
const callState = {
  dialedNumber  : '',
  active        : false,
  micMuted      : false,
  speakerOn     : false,
  timerInterval : null,
  timerSeconds  : 0,
  micStream     : null,       // MediaStream from getUserMedia
  audioCtx      : null,       // AudioContext for generated tones
  ringNode      : null,       // OscillatorNode for ringback tone
  gainNode      : null,       // GainNode (master volume / speaker)
  dtmfNodes     : [],         // Short-lived DTMF tone nodes
};

/* --- DOM helpers --- */
const el = id => document.getElementById(id);

function setCallStatus(text) {
  const s = el('callStatus');
  if (s) s.textContent = text;
}
function setCallNumber(text) {
  const n = el('callNumber');
  if (n) n.textContent = text || '\u200B';
}
function setMicLabel(text) {
  const l = el('micLabel');
  if (l) l.textContent = text;
}
function setMicIcon(icon) {
  const i = el('micIcon');
  if (i) i.textContent = icon;
}

/* ── 7a. DTMF Key Press ──────────────────────────────────────── */
/**
 * Map DTMF digit → [freq1, freq2] (standard ITU-T Q.23 frequencies).
 */
const DTMF_FREQS = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
  '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
  '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
};

function dialKey(digit) {
  if (callState.active) {
    // Send DTMF tone during call
    playDtmfTone(digit);
  }
  callState.dialedNumber += digit;
  setCallNumber(callState.dialedNumber);
}

function dialBackspace() {
  callState.dialedNumber = callState.dialedNumber.slice(0, -1);
  setCallNumber(callState.dialedNumber);
}

/**
 * Play a real DTMF dual-tone for ~120 ms using the WebAudio API.
 */
function playDtmfTone(digit) {
  if (isMuted) return;
  const ctx    = getOrCreateAudioContext();
  const freqs  = DTMF_FREQS[digit];
  if (!freqs) return;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.18, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
  gain.connect(ctx.destination);

  freqs.forEach(f => {
    const osc = ctx.createOscillator();
    osc.type      = 'sine';
    osc.frequency.value = f;
    osc.connect(gain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
    callState.dtmfNodes.push(osc);
  });
}

/* ── 7b. AudioContext lifecycle ──────────────────────────────── */
function getOrCreateAudioContext() {
  if (!callState.audioCtx || callState.audioCtx.state === 'closed') {
    callState.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy)
  if (callState.audioCtx.state === 'suspended') {
    callState.audioCtx.resume();
  }
  return callState.audioCtx;
}

/* ── 7c. Ringback Tone (US cadence: 2 s on / 4 s off) ───────── */
/**
 * Generates a US ringback tone (440 Hz + 480 Hz) with the standard
 * 2-second-on / 4-second-off cadence using the WebAudio API.
 * The cadence is implemented via GainNode scheduling.
 */
function startRingbackTone() {
  if (isMuted) return;
  const ctx  = getOrCreateAudioContext();
  const now  = ctx.currentTime;

  // Master gain (controls cadence)
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0, now);
  masterGain.connect(ctx.destination);
  callState.gainNode = masterGain;

  // Two oscillators: 440 Hz + 480 Hz
  [440, 480].forEach(freq => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.08;   // gentle volume
    osc.connect(oscGain);
    oscGain.connect(masterGain);
    osc.start(now);
    callState.ringNode = osc;    // keep reference (last one is fine for stop)
  });

  // Schedule cadence: 2 s on, 4 s off, repeat
  const cycleDuration = 6;   // 2 + 4
  const ringDuration  = 2;
  const maxRings      = 20;  // ~2 minutes of ringing max

  for (let i = 0; i < maxRings; i++) {
    const cycleStart = now + i * cycleDuration;
    masterGain.gain.setValueAtTime(1, cycleStart);                       // on
    masterGain.gain.setValueAtTime(0, cycleStart + ringDuration);        // off
  }
}

function stopRingbackTone() {
  try {
    if (callState.ringNode) {
      callState.ringNode.stop();
      callState.ringNode = null;
    }
    if (callState.gainNode) {
      callState.gainNode.disconnect();
      callState.gainNode = null;
    }
  } catch (_) { /* already stopped */ }
}

/* ── 7d. Microphone Permission & Stream ──────────────────────── */
/**
 * Requests microphone access via getUserMedia.
 * Updates the #micStatus indicator based on the outcome.
 * Returns a Promise that resolves to the MediaStream (or null on denial).
 */
async function requestMicrophonePermission() {
  setMicIcon('⏳');
  setMicLabel('Microphone: requesting permission…');

  const micStatusEl = el('micStatus');
  if (micStatusEl) {
    micStatusEl.classList.remove('granted', 'denied', 'unavailable');
    micStatusEl.classList.add('pending');
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setMicIcon('🚫');
    setMicLabel('Microphone: not supported in this browser');
    if (micStatusEl) {
      micStatusEl.classList.remove('pending');
      micStatusEl.classList.add('unavailable');
    }
    return null;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    setMicIcon('🎙️');
    setMicLabel('Microphone: permission granted ✅');
    if (micStatusEl) {
      micStatusEl.classList.remove('pending');
      micStatusEl.classList.add('granted');
    }
    return stream;
  } catch (err) {
    const denied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
    setMicIcon('🚫');
    setMicLabel(denied
      ? 'Microphone: permission denied ❌'
      : 'Microphone: error — ' + err.message);
    if (micStatusEl) {
      micStatusEl.classList.remove('pending');
      micStatusEl.classList.add('denied');
    }
    return null;
  }
}

/**
 * Release all microphone tracks.
 */
function releaseMicStream() {
  if (callState.micStream) {
    callState.micStream.getTracks().forEach(t => t.stop());
    callState.micStream = null;
    setMicIcon('🎙️');
    setMicLabel('Microphone: released');
    const micStatusEl = el('micStatus');
    if (micStatusEl) micStatusEl.classList.remove('granted', 'denied', 'pending', 'unavailable');
  }
}

/* ── 7e. Call Timer ──────────────────────────────────────────── */
function startCallTimer() {
  callState.timerSeconds = 0;
  const timerEl = el('callTimer');
  if (timerEl) timerEl.style.display = 'block';
  updateCallTimer();
  callState.timerInterval = setInterval(updateCallTimer, 1000);
}

function updateCallTimer() {
  callState.timerSeconds++;
  const m   = String(Math.floor(callState.timerSeconds / 60)).padStart(2, '0');
  const s   = String(callState.timerSeconds % 60).padStart(2, '0');
  const tel = el('callTimer');
  if (tel) tel.textContent = `${m}:${s}`;
}

function stopCallTimer() {
  if (callState.timerInterval) {
    clearInterval(callState.timerInterval);
    callState.timerInterval = null;
  }
  const timerEl = el('callTimer');
  if (timerEl) timerEl.style.display = 'none';
}

/* ── 7f. Start Call (global — onclick) ───────────────────────── */
/**
 * Initiates an outgoing call:
 *  1. Requests microphone permission (getUserMedia).
 *  2. Starts the WebAudio ringback tone.
 *  3. Simulates call connection after a short delay (demo mode).
 *  4. Starts the call timer once "connected".
 */
async function startCall() {
  if (callState.active) return;
  if (!callState.dialedNumber) {
    setCallStatus('Enter a number first');
    return;
  }

  // Flip UI to "calling" state immediately
  setCallStatus('Calling ' + callState.dialedNumber + '…');
  el('btnCall').style.display   = 'none';
  el('btnHangup').style.display = 'inline-flex';
  el('keypad').classList.add('calling');

  // Step 1 — Request microphone permission
  const stream = await requestMicrophonePermission();
  callState.micStream = stream;   // may be null if denied; call still proceeds (demo)

  // Step 2 — Start ringback tone
  startRingbackTone();
  setCallStatus('Ringing…');

  // Step 3 — Simulate connection after 3–5 seconds (demo)
  const connectDelay = 3000 + Math.random() * 2000;
  callState.connectTimeout = setTimeout(() => {
    // Call "answered"
    stopRingbackTone();
    callState.active = true;
    setCallStatus('Connected ✅');
    el('inCallControls').style.display = 'flex';
    startCallTimer();
  }, connectDelay);
}

/* ── 7g. End Call (global — onclick) ─────────────────────────── */
function endCall() {
  // Cancel pending connect simulation
  if (callState.connectTimeout) {
    clearTimeout(callState.connectTimeout);
    callState.connectTimeout = null;
  }

  stopRingbackTone();
  stopCallTimer();
  releaseMicStream();

  callState.active    = false;
  callState.micMuted  = false;
  callState.speakerOn = false;

  // Reset UI
  setCallStatus('Call ended');
  setTimeout(() => setCallStatus('Ready'), 2000);

  el('btnCall').style.display       = 'inline-flex';
  el('btnHangup').style.display     = 'none';
  el('inCallControls').style.display = 'none';

  const keypad = el('keypad');
  if (keypad) keypad.classList.remove('calling');

  // Reset mute / speaker button labels
  const muteCallBtn = el('btnMuteCall');
  const speakerBtn  = el('btnSpeaker');
  if (muteCallBtn) muteCallBtn.textContent = '🎙️ Mute';
  if (speakerBtn)  speakerBtn.textContent  = '🔊 Speaker';
}

/* ── 7h. In-Call Mute Toggle (global — onclick) ──────────────── */
function toggleMuteCall() {
  if (!callState.active) return;
  callState.micMuted = !callState.micMuted;

  // Mute/unmute all audio tracks on the mic stream
  if (callState.micStream) {
    callState.micStream.getAudioTracks().forEach(t => {
      t.enabled = !callState.micMuted;
    });
  }

  const btn = el('btnMuteCall');
  if (btn) {
    btn.textContent = callState.micMuted ? '🔇 Unmute' : '🎙️ Mute';
    btn.classList.toggle('active', callState.micMuted);
  }
}

/* ── 7i. Speaker Toggle (global — onclick) ───────────────────── */
function toggleSpeaker() {
  callState.speakerOn = !callState.speakerOn;

  // Adjust gain on the AudioContext master gain if ringback is still active
  if (callState.gainNode) {
    callState.gainNode.gain.setTargetAtTime(
      callState.speakerOn ? 2.5 : 1,
      callState.audioCtx.currentTime,
      0.05
    );
  }

  const btn = el('btnSpeaker');
  if (btn) {
    btn.textContent = callState.speakerOn ? '🔇 Speaker Off' : '🔊 Speaker';
    btn.classList.toggle('active', callState.speakerOn);
  }
}

/* ─────────────────────────────────────────────
   8.  BOOT — runs once DOM is ready
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  renderClocks();
  updateClocks();
  startClockInterval();
  initConnectivity();
});
