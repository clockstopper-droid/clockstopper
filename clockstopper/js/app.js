/* =============================================================
   Global Time Clock — app.js
   Three fixed US time zone clocks (Eastern, Central, Pacific).
   No add/remove, no audio, no mute — digital display only.
   ============================================================= */

'use strict';

/* ─────────────────────────────────────────────
   1.  FIXED TIME ZONES
───────────────────────────────────────────── */
const CLOCKS = [
  { tz: 'America/New_York',    label: 'Eastern Time'  },
  { tz: 'America/Chicago',     label: 'Central Time'  },
  { tz: 'America/Los_Angeles', label: 'Pacific Time'  },
];

/* ─────────────────────────────────────────────
   2.  CLOCK RENDERING
───────────────────────────────────────────── */
function renderClocks() {
  const grid = document.getElementById('clocksGrid');
  if (!grid) return;
  grid.innerHTML = '';

  CLOCKS.forEach(({ tz, label }) => {
    const safeId = tz.replace(/\//g, '_');

    const card = document.createElement('div');
    card.className = 'clock-card';
    card.id        = 'clock-' + safeId;

    card.innerHTML = `
      <div class="clock-label">${label}</div>
      <div class="clock-tz">${tz}</div>
      <div class="clock-time" id="time-${safeId}">--:--:--</div>
      <div class="clock-date" id="date-${safeId}"></div>`;

    grid.appendChild(card);
  });
}

function updateClocks() {
  const now = new Date();

  CLOCKS.forEach(({ tz }) => {
    const safeId = tz.replace(/\//g, '_');
    const timeEl = document.getElementById('time-' + safeId);
    const dateEl = document.getElementById('date-' + safeId);
    if (!timeEl) return;

    try {
      timeEl.textContent = new Intl.DateTimeFormat('en-US', {
        timeZone : tz,
        hour     : '2-digit',
        minute   : '2-digit',
        second   : '2-digit',
        hour12   : true,
      }).format(now);

      if (dateEl) {
        dateEl.textContent = new Intl.DateTimeFormat('en-US', {
          timeZone : tz,
          weekday  : 'short',
          month    : 'short',
          day      : 'numeric',
          year     : 'numeric',
        }).format(now);
      }
    } catch (_) {
      timeEl.textContent = 'Invalid TZ';
    }
  });
}

/* ─────────────────────────────────────────────
   3.  THEME TOGGLE (global — onclick)
───────────────────────────────────────────── */
function toggleTheme() {
  document.body.classList.toggle('dark-theme');

  const btn = document.getElementById('themeBtn');
  if (btn) {
    const isDark = document.body.classList.contains('dark-theme');
    btn.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
  }
}

/* ─────────────────────────────────────────────
   4.  CONNECTIVITY PANEL (global — onclick)
───────────────────────────────────────────── */
const PROBE_URL        = 'https://www.gstatic.com/generate_204';
const PROBE_TIMEOUT_MS = 5000;
let   probeTimer       = null;
let   lastOnlineState  = null;
let   panelExpanded    = false;

function toggleConnectivityPanel() {
  panelExpanded = !panelExpanded;
  const panel   = document.getElementById('connectivityPanel');
  const chevron = document.getElementById('panelChevron');
  if (panel)   panel.classList.toggle('expanded', panelExpanded);
  if (chevron) chevron.textContent = panelExpanded ? '▲' : '▼';
  if (panelExpanded) refreshConnectivityPanel();
}

async function probeInternet() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    await fetch(
      PROBE_URL + '?_=' + Date.now(),
      { method: 'HEAD', mode: 'no-cors', signal: controller.signal }
    );
    clearTimeout(timer);
    return true;
  } catch (_) {
    return false;
  }
}

function readNetworkInfo() {
  const conn = navigator.connection ||
               navigator.mozConnection ||
               navigator.webkitConnection ||
               null;
  if (!conn) {
    return { type: null, effectiveType: null, downlink: null, rtt: null, saveData: null };
  }
  return {
    type          : conn.type          ?? null,
    effectiveType : conn.effectiveType ?? null,
    downlink      : conn.downlink      ?? null,
    rtt           : conn.rtt           ?? null,
    saveData      : conn.saveData      ?? null,
  };
}

function describeConnectionType(type) {
  const map = {
    wifi      : { label: 'Wi-Fi',     icon: '📶' },
    cellular  : { label: 'Cellular',  icon: '📡' },
    ethernet  : { label: 'Ethernet',  icon: '🔌' },
    bluetooth : { label: 'Bluetooth', icon: '🔵' },
    wimax     : { label: 'WiMAX',     icon: '📡' },
    other     : { label: 'Other',     icon: '🌐' },
    none      : { label: 'No signal', icon: '❌' },
  };
  return map[type] || { label: 'Unknown', icon: '❓' };
}

function describeEffectiveType(effectiveType) {
  const map = {
    '4g'      : { text: '4G / LTE',  mod: 'quality-good'    },
    '3g'      : { text: '3G',        mod: 'quality-fair'    },
    '2g'      : { text: '2G',        mod: 'quality-poor'    },
    'slow-2g' : { text: 'Slow (2G)', mod: 'quality-poor'    },
  };
  return map[effectiveType] || { text: effectiveType || '—', mod: 'quality-unknown' };
}

async function refreshConnectivityPanel() {
  const isOnline   = navigator.onLine;
  const netInfo    = readNetworkInfo();
  const probePromise = isOnline ? probeInternet() : Promise.resolve(false);

  renderConnectivityPanel(isOnline, false, netInfo, true);

  const probeResult = await probePromise;
  lastOnlineState = probeResult;
  renderConnectivityPanel(isOnline, probeResult, netInfo, false);
}

function renderConnectivityPanel(isOnline, probeResult, netInfo, probing) {
  const panel = document.getElementById('wifiStatus');
  if (!panel) return;

  panel.classList.remove('online', 'offline', 'degraded');
  if (!isOnline) {
    panel.classList.add('offline');
  } else if (probing) {
    if      (lastOnlineState === true)  panel.classList.add('online');
    else if (lastOnlineState === false) panel.classList.add('degraded');
  } else {
    panel.classList.add(probeResult ? 'online' : 'degraded');
  }

  const statusIcon = !isOnline ? '🔴' : probing ? '🟡' : probeResult ? '🟢' : '🟠';
  const statusText = !isOnline
    ? 'Offline'
    : probing
      ? 'Checking…'
      : probeResult ? 'Online' : 'Limited connectivity';

  let connTypeHTML = '';
  if (netInfo.type) {
    const { label, icon } = describeConnectionType(netInfo.type);
    connTypeHTML = `
      <div class="conn-row">
        <span class="conn-row-label">Connection</span>
        <span class="conn-row-value">${icon} ${label}</span>
      </div>`;
  }

  let effectiveTypeHTML = '';
  if (netInfo.effectiveType) {
    const { text, mod } = describeEffectiveType(netInfo.effectiveType);
    effectiveTypeHTML = `
      <div class="conn-row">
        <span class="conn-row-label">Speed class</span>
        <span class="conn-row-value conn-quality ${mod}">${text}</span>
      </div>`;
  }

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

  let dataSaverHTML = '';
  if (netInfo.saveData !== null) {
    dataSaverHTML = `
      <div class="conn-row">
        <span class="conn-row-label">Data Saver</span>
        <span class="conn-row-value">${netInfo.saveData ? '✅ On' : '⬜ Off'}</span>
      </div>`;
  }

  const probeHTML = `
    <div class="conn-row">
      <span class="conn-row-label">Internet</span>
      <span class="conn-row-value">${
        probing     ? '⏳ Checking…'     :
        probeResult ? '✅ Reachable'     :
        isOnline    ? '⚠️ Unreachable'  :
                      '❌ Offline'
      }</span>
    </div>`;

  const apiNoteHTML = netInfo.type === null
    ? `<div class="conn-api-note">ℹ️ Network Info API not supported in this browser.</div>`
    : '';

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

function manualRecheck() {
  clearTimeout(probeTimer);
  refreshConnectivityPanel();
}

function initConnectivity() {
  window.addEventListener('online',  () => {
    clearTimeout(probeTimer);
    probeTimer = setTimeout(refreshConnectivityPanel, 300);
  });
  window.addEventListener('offline', () => {
    clearTimeout(probeTimer);
    refreshConnectivityPanel();
  });

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

  refreshConnectivityPanel();
}

/* ─────────────────────────────────────────────
   5.  BOOT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  renderClocks();
  updateClocks();
  setInterval(updateClocks, 1000);
  initConnectivity();

  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.textContent = '🌙 Dark Mode';
});
