// ─── State ───────────────────────────────────────────────────────────────────
let timezones = ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];
let isMuted   = false;
let isDark    = false;

// ─── Connectivity state ───────────────────────────────────────────────────────
const PROBE_URL        = 'https://www.gstatic.com/generate_204'; // 204 No Content – tiny, cacheless
const PROBE_TIMEOUT_MS = 5000;
let   probeTimer       = null;    // debounce handle for probe retries
let   lastOnlineState  = null;    // avoid redundant UI refreshes

// ─── Clock rendering ──────────────────────────────────────────────────────────
function renderClocks() {
  const grid = document.getElementById('clocksGrid');
  grid.innerHTML = '';
  timezones.forEach(tz => {
    const card = document.createElement('div');
    card.className   = 'clock-card';
    card.id          = 'clock-' + tz.replace(/\//g, '-');

    const label = document.createElement('div');
    label.className  = 'clock-label';
    label.textContent = tz;

    const time = document.createElement('div');
    time.className   = 'clock-time';
    time.id          = 'time-' + tz.replace(/\//g, '-');

    const removeBtn = document.createElement('button');
    removeBtn.className   = 'remove-btn';
    removeBtn.textContent = '✕';
    removeBtn.onclick     = () => removeTimezone(tz);

    card.appendChild(label);
    card.appendChild(time);
    card.appendChild(removeBtn);
    grid.appendChild(card);
  });
  updateClocks();
}

function updateClocks() {
  timezones.forEach(tz => {
    const el = document.getElementById('time-' + tz.replace(/\//g, '-'));
    if (!el) return;
    try {
      const now = new Intl.DateTimeFormat('en-US', {
        timeZone : tz,
        hour     : '2-digit',
        minute   : '2-digit',
        second   : '2-digit',
        hour12   : true,
      }).format(new Date());
      el.textContent = now;
    } catch (e) {
      el.textContent = 'Error';
    }
  });
}

setInterval(updateClocks, 1000);

// ─── Add / Remove ─────────────────────────────────────────────────────────────
function addTimezone() {
  const input = document.getElementById('tzInput');
  const tz    = (input.value || '').trim();
  if (!tz) return;

  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
  } catch (e) {
    alert('Invalid IANA time zone: ' + tz);
    return;
  }

  if (timezones.includes(tz)) {
    alert(tz + ' is already displayed.');
    return;
  }

  timezones.push(tz);
  input.value = '';
  renderClocks();
}

function removeTimezone(tz) {
  timezones = timezones.filter(t => t !== tz);
  renderClocks();
}

// ─── Theme ────────────────────────────────────────────────────────────────────
function toggleTheme() {
  isDark = !isDark;
  document.body.classList.toggle('dark-theme', isDark);

  const btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';

  // re-render connectivity panel so dark-theme colours apply immediately
  refreshConnectivityPanel();
}

// ─── Mute ─────────────────────────────────────────────────────────────────────
function toggleMute() {
  isMuted = !isMuted;
  const btn = document.getElementById('muteBtn');
  if (!btn) return;
  btn.classList.toggle('muted', isMuted);
  btn.textContent = isMuted ? '🔇 Unmute' : '🔔 Mute';
}

// ═════════════════════════════════════════════════════════════════════════════
//  CONNECTIVITY DETECTION
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Probe a tiny, cache-busted URL to verify real internet reachability.
 * navigator.onLine can be true even when the device has no WAN access
 * (e.g. connected to a router with no upstream).  A fetch probe catches that.
 *
 * @returns {Promise<boolean>}  Resolves to true if internet is reachable.
 */
async function probeInternet() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    const res = await fetch(
      PROBE_URL + '?_=' + Date.now(),   // cache-bust
      { method: 'HEAD', mode: 'no-cors', signal: controller.signal }
    );
    clearTimeout(timer);
    // no-cors opaque responses always have status 0 but don't throw → reachable
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the Network Information API (where available) and return a plain object
 * describing the current connection.
 *
 * Supported in Chrome/Edge/Android (not Safari/Firefox).
 * We degrade gracefully: if the API is absent, all fields are null.
 *
 * @returns {{ type: string|null, effectiveType: string|null,
 *             downlink: number|null, rtt: number|null,
 *             saveData: boolean|null }}
 */
function readNetworkInfo() {
  const conn = navigator.connection ||
               navigator.mozConnection ||
               navigator.webkitConnection ||
               null;

  if (!conn) {
    return { type: null, effectiveType: null, downlink: null, rtt: null, saveData: null };
  }

  return {
    type          : conn.type          ?? null,   // 'wifi' | 'cellular' | 'ethernet' | 'none' | …
    effectiveType : conn.effectiveType ?? null,   // '4g' | '3g' | '2g' | 'slow-2g'
    downlink      : conn.downlink      ?? null,   // Mbps (estimate)
    rtt           : conn.rtt           ?? null,   // ms   (estimate)
    saveData      : conn.saveData      ?? null,   // Data Saver mode
  };
}

/**
 * Map a Network Information `type` value to a human-readable label and icon.
 */
function describeConnectionType(type) {
  switch (type) {
    case 'wifi'     : return { label: 'Wi-Fi',    icon: '📶' };
    case 'cellular' : return { label: 'Cellular', icon: '📡' };
    case 'ethernet' : return { label: 'Ethernet', icon: '🔌' };
    case 'bluetooth': return { label: 'Bluetooth',icon: '🔵' };
    case 'wimax'    : return { label: 'WiMAX',    icon: '📡' };
    case 'other'    : return { label: 'Other',    icon: '🌐' };
    case 'none'     : return { label: 'No signal',icon: '❌' };
    default         : return { label: 'Unknown',  icon: '❓' };
  }
}

/**
 * Map an effectiveType to a quality badge text and CSS modifier class.
 */
function describeEffectiveType(effectiveType) {
  switch (effectiveType) {
    case '4g'     : return { text: '4G / LTE',    mod: 'quality-good'   };
    case '3g'     : return { text: '3G',           mod: 'quality-fair'   };
    case '2g'     : return { text: '2G',           mod: 'quality-poor'   };
    case 'slow-2g': return { text: 'Slow (2G)',    mod: 'quality-poor'   };
    default       : return { text: effectiveType || '—', mod: 'quality-unknown' };
  }
}

// ─── Main connectivity UI refresh ─────────────────────────────────────────────

/**
 * Run a probe, read network info, then update the entire connectivity panel.
 */
async function refreshConnectivityPanel() {
  const isOnline   = navigator.onLine;
  const netInfo    = readNetworkInfo();

  // Kick off the fetch probe in parallel; we'll use its result for the
  // "Internet reachable" row but don't block the initial paint on it.
  const probePromise = isOnline ? probeInternet() : Promise.resolve(false);

  // Paint immediately with what we know so the UI isn't stale.
  renderConnectivityPanel(isOnline, false /* probeResult pending */, netInfo, true /* probing */);

  const probeResult = await probePromise;
  const changed = (probeResult !== lastOnlineState);
  lastOnlineState = probeResult;

  renderConnectivityPanel(isOnline, probeResult, netInfo, false /* done probing */);
}

/**
 * Build / rebuild the entire content of #wifiStatus.
 *
 * @param {boolean}      isOnline     navigator.onLine value
 * @param {boolean}      probeResult  actual internet reachability from fetch probe
 * @param {object}       netInfo      result of readNetworkInfo()
 * @param {boolean}      probing      true while the fetch probe is still in-flight
 */
function renderConnectivityPanel(isOnline, probeResult, netInfo, probing) {
  const panel = document.getElementById('wifiStatus');
  if (!panel) return;

  // ── Determine overall status class ──────────────────────────────────────
  panel.classList.remove('online', 'offline', 'degraded');

  if (!isOnline) {
    panel.classList.add('offline');
  } else if (probing) {
    // While the probe is in-flight we don't know yet — keep last class or neutral
    if (lastOnlineState === true)        panel.classList.add('online');
    else if (lastOnlineState === false)  panel.classList.add('degraded');
    // else: no prior state → no class (neutral styling)
  } else {
    panel.classList.add(probeResult ? 'online' : 'degraded');
  }

  // ── Build inner HTML ─────────────────────────────────────────────────────
  const statusIcon  = !isOnline ? '🔴' : probing ? '🟡' : probeResult ? '🟢' : '🟠';
  const statusText  = !isOnline
    ? 'Offline'
    : probing
      ? 'Checking…'
      : probeResult
        ? 'Online'
        : 'Limited connectivity';

  // Connection type row (Network Information API)
  let connTypeHTML = '';
  if (netInfo.type) {
    const { label, icon } = describeConnectionType(netInfo.type);
    connTypeHTML = `
      <div class="conn-row">
        <span class="conn-row-label">Connection</span>
        <span class="conn-row-value">${icon} ${label}</span>
      </div>`;
  }

  // Effective type / speed row
  let effectiveTypeHTML = '';
  if (netInfo.effectiveType) {
    const { text, mod } = describeEffectiveType(netInfo.effectiveType);
    effectiveTypeHTML = `
      <div class="conn-row">
        <span class="conn-row-label">Speed class</span>
        <span class="conn-row-value conn-quality ${mod}">${text}</span>
      </div>`;
  }

  // Downlink / RTT row
  let perfHTML = '';
  if (netInfo.downlink !== null || netInfo.rtt !== null) {
    const dl  = netInfo.downlink !== null ? netInfo.downlink + ' Mbps' : '—';
    const rtt = netInfo.rtt      !== null ? netInfo.rtt + ' ms'       : '—';
    perfHTML = `
      <div class="conn-row">
        <span class="conn-row-label">Est. speed</span>
        <span class="conn-row-value">${dl}</span>
      </div>
      <div class="conn-row">
        <span class="conn-row-label">Est. latency</span>
        <span class="conn-row-value">${rtt}</span>
      </div>`;
  }

  // Data Saver row
  let dataSaverHTML = '';
  if (netInfo.saveData !== null) {
    dataSaverHTML = `
      <div class="conn-row">
        <span class="conn-row-label">Data Saver</span>
        <span class="conn-row-value">${netInfo.saveData ? '✅ On' : '⬜ Off'}</span>
      </div>`;
  }

  // Internet probe row
  const probeHTML = `
    <div class="conn-row">
      <span class="conn-row-label">Internet</span>
      <span class="conn-row-value">${probing ? '⏳ Checking…' : probeResult ? '✅ Reachable' : isOnline ? '⚠️ Unreachable' : '❌ Offline'}</span>
    </div>`;

  // Network Information API availability note
  const apiNoteHTML = netInfo.type === null
    ? `<div class="conn-api-note">ℹ️ Network Info API not supported in this browser — connection type details unavailable.</div>`
    : '';

  // Re-check button
  const recheckHTML = `
    <button class="conn-recheck-btn" onclick="manualRecheck()" title="Re-check connectivity now">
      🔄 Re-check
    </button>`;

  panel.innerHTML = `
    <div class="conn-header">
      <span class="conn-status-icon">${statusIcon}</span>
      <span class="conn-status-text">${statusText}</span>
      ${recheckHTML}
    </div>
    <div class="conn-details">
      ${connTypeHTML}
      ${effectiveTypeHTML}
      ${perfHTML}
      ${dataSaverHTML}
      ${probeHTML}
      ${apiNoteHTML}
    </div>`;
}

// ─── Manual re-check (button handler — must be global) ───────────────────────
function manualRecheck() {
  clearTimeout(probeTimer);
  refreshConnectivityPanel();
}

// ─── Initialise connectivity listeners ───────────────────────────────────────

/**
 * Set up event listeners for browser online/offline events and the
 * Network Information API change event, then perform the initial panel render.
 */
function initConnectivity() {
  // navigator.onLine / browser online-offline events
  window.addEventListener('online',  () => {
    clearTimeout(probeTimer);
    probeTimer = setTimeout(refreshConnectivityPanel, 300); // brief debounce
  });
  window.addEventListener('offline', () => {
    clearTimeout(probeTimer);
    refreshConnectivityPanel();
  });

  // Network Information API change event (fires when connection type changes)
  const conn = navigator.connection ||
               navigator.mozConnection ||
               navigator.webkitConnection ||
               null;
  if (conn) {
    conn.addEventListener('change', () => {
      clearTimeout(probeTimer);
      probeTimer = setTimeout(refreshConnectivityPanel, 300);
    });
  }

  // Initial render
  refreshConnectivityPanel();
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderClocks();
  initConnectivity();

  // Sync theme button label
  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.textContent = '🌙 Dark Mode';

  // Sync mute button label
  const muteBtn = document.getElementById('muteBtn');
  if (muteBtn) muteBtn.textContent = '🔔 Mute';
});
