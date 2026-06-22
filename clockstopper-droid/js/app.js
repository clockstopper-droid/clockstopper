/* ============================================================
   Global Time Clock — app.js  (clockstopper-droid root copy)
   All application logic — see asset copy for inline comments.
   ============================================================ */

'use strict';

function pad2(n) { return String(n).padStart(2, '0'); }

/* ── Theme ───────────────────────────────────────────────── */
const THEME_KEY = 'darkTheme';
function applyTheme(dark) {
  document.body.classList.toggle('dark', dark);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = dark ? '☀ Light Mode' : '🌙 Dark Mode';
}
function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === null ? true : saved === 'true');
}
function toggleTheme() {
  const next = !document.body.classList.contains('dark');
  localStorage.setItem(THEME_KEY, String(next));
  applyTheme(next);
}

/* ── World Clocks ────────────────────────────────────────── */
const CLOCKS = [
  { id: 'clockEastern', zone: 'America/New_York'    },
  { id: 'clockCentral', zone: 'America/Chicago'     },
  { id: 'clockWestern', zone: 'America/Los_Angeles' },
];
function updateClocks() {
  const now = new Date();
  CLOCKS.forEach(({ id, zone }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    }).format(now);
  });
}

/* ── Mute (audio alerts) — glass dial-pad key ───────────── */
let alertsMuted = false;
function applyMuteUI() {
  const btn = document.getElementById('muteBtn');
  if (!btn) return;
  if (alertsMuted) {
    btn.classList.add('muted-active');
    btn.setAttribute('aria-pressed', 'true');
    btn.textContent = '🔇 Unmute';
    btn.dataset.muted = 'true';
  } else {
    btn.classList.remove('muted-active');
    btn.setAttribute('aria-pressed', 'false');
    btn.textContent = '🔔 Mute';
    btn.dataset.muted = 'false';
  }
}
function toggleMute() { alertsMuted = !alertsMuted; applyMuteUI(); }

/* ── Connectivity probe ──────────────────────────────────── */
const PROBE_URL = 'https://www.gstatic.com/generate_204';
const BACKOFF_BASE_MS = 2000, BACKOFF_MAX_MS = 60000;
let probeBackoffMs = BACKOFF_BASE_MS, probeTimer = null, probeController = null;

function setConnectivityStatus(msg, ts) {
  const s = document.getElementById('connectivityStatus');
  const t = document.getElementById('connectivityTimestamp');
  if (s) s.textContent = msg;
  if (t) t.textContent = ts ? `(${ts})` : '';
}
function scheduleProbe(d) { clearTimeout(probeTimer); probeTimer = setTimeout(runProbe, d); }
async function runProbe() {
  if (probeController) probeController.abort();
  probeController = new AbortController();
  const ts = new Date().toLocaleTimeString();
  try {
    const res = await fetch(PROBE_URL, { method: 'HEAD', cache: 'no-store', signal: probeController.signal });
    if (res.ok || res.status === 204) {
      probeBackoffMs = BACKOFF_BASE_MS; setConnectivityStatus('Online ✔', ts); scheduleProbe(30000);
    } else throw new Error();
  } catch (err) {
    if (err.name === 'AbortError') return;
    const ft = new Date().toLocaleTimeString();
    setConnectivityStatus(`Probe failed — retrying in ${probeBackoffMs / 1000}s`, ft);
    scheduleProbe(probeBackoffMs);
    probeBackoffMs = Math.min(probeBackoffMs * 2, BACKOFF_MAX_MS);
  }
}
function onOnline()  { probeBackoffMs = BACKOFF_BASE_MS; setConnectivityStatus('Network online — probing…', new Date().toLocaleTimeString()); runProbe(); }
function onOffline() { clearTimeout(probeTimer); setConnectivityStatus('Offline ✖', new Date().toLocaleTimeString()); }

/* ── Network information ─────────────────────────────────── */
let preferMobileNetwork = false;
function getNetworkType() {
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return c ? (c.type || c.effectiveType || 'unknown') : 'unknown';
}
function updateNetworkInfo() {
  const type = getNetworkType();
  const el = document.getElementById('networkInfo');
  if (el) el.textContent = `Network: ${type}`;
  const m = document.getElementById('mobileNetworkOption');
  if (m) m.style.display = ['cellular','4g','3g','2g'].includes(type) ? 'block' : 'none';
}
function toggleMobileNetwork() {
  preferMobileNetwork = !preferMobileNetwork;
  const btn = document.getElementById('mobileNetworkBtn');
  if (btn) btn.textContent = preferMobileNetwork ? '📶 Mobile Network: ON' : '📶 Mobile Network: OFF';
}

/* ── Mic permission pre-check ────────────────────────────── */
async function checkMicPermission() {
  const el = document.getElementById('micPermissionStatus');
  if (!el) return;
  if (navigator.permissions) {
    try {
      const r = await navigator.permissions.query({ name: 'microphone' });
      applyMicStatus(el, r.state); r.onchange = () => applyMicStatus(el, r.state); return;
    } catch (_) {}
  }
  try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); applyMicStatus(el, 'granted'); }
  catch (e) { applyMicStatus(el, e.name === 'NotAllowedError' ? 'denied' : 'prompt'); }
}
function applyMicStatus(el, state) {
  const map = { granted: { text: '🎤 Microphone: Granted', cls: 'mic-granted' }, denied: { text: '🎤 Microphone: Denied ✖', cls: 'mic-denied' }, prompt: { text: '🎤 Microphone: Not yet requested', cls: 'mic-prompt' } };
  const info = map[state] || { text: `🎤 Microphone: ${state}`, cls: '' };
  el.textContent = info.text; el.className = 'mic-status ' + info.cls;
}

/* ── Caller ID ───────────────────────────────────────────── */
let callerIdName = '';
function saveCallerIdName() {
  const i = document.getElementById('callerIdInput'); if (!i) return;
  callerIdName = i.value.trim();
  const d = document.getElementById('callerIdDisplay');
  if (d) d.textContent = callerIdName ? `Caller ID: ${callerIdName}` : 'Caller ID: (not set)';
}

/* ── Dialer ──────────────────────────────────────────────── */
let dialedNumber = '';
function updateDialDisplay() {
  const b = document.getElementById('dialDisplay'), r = document.getElementById('dialReadout');
  if (b) b.textContent = dialedNumber || ' ';
  if (r) r.textContent = dialedNumber ? `Dialing: ${dialedNumber}` : 'Enter a number';
}
function dialDigit(d)    { dialedNumber += d; updateDialDisplay(); }
function clearLastDigit(){ dialedNumber = dialedNumber.slice(0,-1); updateDialDisplay(); }
function clearDialed()   { dialedNumber = ''; updateDialDisplay(); }

/* ── Backspace long-press ────────────────────────────────── */
const LONG_PRESS_MS = 600; let longPressTimer = null;
function attachBackspaceLongPress() {
  const btn = document.getElementById('backspaceBtn'); if (!btn) return;
  const sLP = () => { longPressTimer = setTimeout(() => { clearDialed(); longPressTimer = null; }, LONG_PRESS_MS); };
  const cLP = (s) => { if (longPressTimer !== null) { clearTimeout(longPressTimer); longPressTimer = null; if (s) clearLastDigit(); } };
  btn.addEventListener('pointerdown',   () => sLP());
  btn.addEventListener('pointerup',     () => cLP(true));
  btn.addEventListener('pointercancel', () => cLP(false));
}

/* ── Keyboard input ──────────────────────────────────────── */
function handleKeydown(e) {
  const k = e.key;
  if (callActive) { if (k==='m'||k==='M') { toggleMicMute(); return; } if (k==='Escape') { endCall(); return; } return; }
  if (/^[0-9*#+]$/.test(k)) { dialDigit(k); return; }
  if (k==='Backspace') { clearLastDigit(); return; }
  if (k==='Enter')     { initiateCall();   return; }
  if (k==='Escape')    { clearDialed();    return; }
}

/* ── Call duration timer ─────────────────────────────────── */
let callStartTime = null, callTimerInterval = null;
function startCallTimer() { callStartTime = Date.now(); callTimerInterval = setInterval(updateCallTimer, 1000); updateCallTimer(); }
function stopCallTimer()  { clearInterval(callTimerInterval); callTimerInterval = null; callStartTime = null; }
function updateCallTimer() {
  const el = document.getElementById('callStatus'); if (!el || !callStartTime) return;
  const e = Math.floor((Date.now()-callStartTime)/1000), h=Math.floor(e/3600), m=Math.floor((e%3600)/60), s=e%60;
  el.textContent = `In call: ${h>0?pad2(h)+':':''}${pad2(m)}:${pad2(s)}`;
}

/* ── Network type badge ──────────────────────────────────── */
function updateNetworkTypeBadge() {
  const el = document.getElementById('networkTypeIndicator'); if (!el) return;
  const labels = { wifi:'WiFi',cellular:'Cellular','4g':'4G','3g':'3G','2g':'2G',ethernet:'Ethernet' };
  el.textContent = labels[getNetworkType()]||'Unknown'; el.style.display = callActive?'inline-block':'none';
}

/* ── Call volume indicator ───────────────────────────────── */
let callAudioEl = null;
function updateVolumeIndicator() {
  const el = document.getElementById('callVolumeIndicator'); if (!el) return;
  el.textContent = `🔊 ${Math.round((callAudioEl?callAudioEl.volume:1)*100)}%`;
  el.style.display = callActive?'inline-block':'none';
}
function handleVolumeKey(e) {
  if (!callActive||!callAudioEl) return;
  if (e.key==='VolumeUp')   { callAudioEl.volume=Math.min(1,callAudioEl.volume+0.1); updateVolumeIndicator(); e.preventDefault(); }
  if (e.key==='VolumeDown') { callAudioEl.volume=Math.max(0,callAudioEl.volume-0.1); updateVolumeIndicator(); e.preventDefault(); }
}

/* ── Mic mute during call ────────────────────────────────── */
let callStream = null, micMuted = false;
function toggleMicMute() {
  if (!callStream) return;
  micMuted = !micMuted;
  callStream.getAudioTracks().forEach(t => { t.enabled = !micMuted; });
  _applyMicMuteUI();
}
function _applyMicMuteUI() {
  const btn=document.getElementById('micMuteBtn'), st=document.getElementById('micMuteStatus');
  if (btn) { btn.textContent=micMuted?'🎙️ Unmute Mic':'🎙️ Mute Mic'; btn.dataset.micMuted=String(micMuted); btn.setAttribute('aria-pressed',String(micMuted)); btn.classList.toggle('active',micMuted); }
  if (st)  { st.textContent=micMuted?'Mic muted 🔇':'Mic live 🔴'; st.className=micMuted?'mic-mute-status muted':'mic-mute-status live'; }
}
function showMicMuteControls() { const w=document.getElementById('micMuteControls'); if(w) w.style.display='flex'; }
function hideMicMuteControls() {
  if (callStream) callStream.getAudioTracks().forEach(t=>{t.enabled=true;});
  micMuted=false; _applyMicMuteUI();
  const w=document.getElementById('micMuteControls'); if(w) w.style.display='none';
}

/* ── Call state ──────────────────────────────────────────── */
let callActive = false;
async function initiateCall() {
  if (callActive||!dialedNumber) return;
  const s=document.getElementById('callStatus'); if(s) s.textContent='Requesting microphone…';
  let stream;
  try { stream=await navigator.mediaDevices.getUserMedia({audio:true}); }
  catch(err) { if(s) s.textContent=`Mic error: ${err.message}`; return; }
  callStream=stream; micMuted=false;
  callAudioEl=new Audio(); callAudioEl.srcObject=stream; callAudioEl.muted=true; callAudioEl.play().catch(()=>{});
  callActive=true; if(s) s.textContent='Connecting…';
  setTimeout(()=>{
    if(!callActive) return;
    if(s) s.textContent='In call: 00:00';
    startCallTimer(); updateNetworkTypeBadge(); updateVolumeIndicator(); showMicMuteControls();
    const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    if(c) c.addEventListener('change',onNetworkChangeDuringCall);
  },1000);
}
function endCall() {
  if (!callActive) return; callActive=false;
  if(callStream){callStream.getTracks().forEach(t=>t.stop()); callStream=null;}
  if(callAudioEl){callAudioEl.pause(); callAudioEl.srcObject=null; callAudioEl=null;}
  stopCallTimer(); hideMicMuteControls();
  const s=document.getElementById('callStatus'); if(s) s.textContent='Call ended';
  updateNetworkTypeBadge(); updateVolumeIndicator();
  const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
  if(c) c.removeEventListener('change',onNetworkChangeDuringCall);
}
function onNetworkChangeDuringCall() { updateNetworkTypeBadge(); updateVolumeIndicator(); }

/* ── Init ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  const tBtn=document.getElementById('themeToggle'); if(tBtn) tBtn.addEventListener('click',toggleTheme);

  const mBtn=document.getElementById('muteBtn'); if(mBtn){mBtn.addEventListener('click',toggleMute); applyMuteUI();}

  updateClocks(); setInterval(updateClocks,1000);

  window.addEventListener('online',onOnline); window.addEventListener('offline',onOffline);
  const ts=new Date().toLocaleTimeString();
  if(navigator.onLine){setConnectivityStatus('Online ✔',ts); scheduleProbe(2000);}
  else setConnectivityStatus('Offline ✖',ts);

  updateNetworkInfo();
  const conn=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
  if(conn) conn.addEventListener('change',updateNetworkInfo);

  const mobBtn=document.getElementById('mobileNetworkBtn'); if(mobBtn) mobBtn.addEventListener('click',toggleMobileNetwork);

  checkMicPermission();
  const sBtn=document.getElementById('saveCallerIdBtn'); if(sBtn) sBtn.addEventListener('click',saveCallerIdName);

  document.querySelectorAll('.dial-key[data-digit]').forEach(b=>b.addEventListener('click',()=>dialDigit(b.dataset.digit)));
  updateDialDisplay(); attachBackspaceLongPress();

  const callBtn=document.getElementById('callBtn'), endBtn=document.getElementById('endCallBtn');
  if(callBtn) callBtn.addEventListener('click',initiateCall);
  if(endBtn)  endBtn.addEventListener('click',endCall);

  const mmBtn=document.getElementById('micMuteBtn'); if(mmBtn) mmBtn.addEventListener('click',toggleMicMute);
  hideMicMuteControls();

  document.addEventListener('keydown',handleKeydown);
  document.addEventListener('keydown',handleVolumeKey);
  updateNetworkTypeBadge(); updateVolumeIndicator();
});
