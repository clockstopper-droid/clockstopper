/* =============================================================
   Global Time Clock — app.js
   All application logic lives here (no modules, no frameworks).
   addTimezone(), removeTimezone(), and toggleTheme() are kept
   globally scoped so HTML onclick attributes can reach them.
   ============================================================= */

/* ---------------------------------------------------------
   State
   --------------------------------------------------------- */
const timezones = [
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Asia/Tokyo',
];

/* ---------------------------------------------------------
   Theme Management
   --------------------------------------------------------- */

/** Key used to persist the user's theme preference. */
const THEME_KEY = 'clockstopper_theme';

/** Emoji icons shown on the toggle button for each mode. */
const THEME_ICONS = { dark: '☀️', light: '🌙' };

/**
 * Apply a theme ('dark' or 'light') to the document and
 * update the toggle button icon accordingly.
 * @param {'dark'|'light'} theme
 */
function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }

  const btn = document.getElementById('themeToggle');
  if (btn) {
    // When dark mode is ON the button offers to switch to light (☀️)
    // When light mode is ON the button offers to switch to dark (🌙)
    btn.textContent = THEME_ICONS[theme];
    btn.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  }
}

/**
 * Toggle between dark and light themes, then persist the
 * choice to localStorage so it survives page refreshes.
 * Globally scoped — called by onclick in Index.html.
 */
function toggleTheme() {
  const isDark = document.body.classList.contains('dark');
  const next   = isDark ? 'light' : 'dark';
  applyTheme(next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (_) {
    // localStorage may be unavailable in some private-browsing modes
  }
}

/**
 * Read the persisted theme preference (if any) and apply it
 * before the first paint so there is no flash of wrong theme.
 */
function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch (_) { /* ignore */ }

  // Default to dark if no preference has been saved yet
  const theme = (saved === 'light' || saved === 'dark') ? saved : 'dark';
  applyTheme(theme);
}

/* ---------------------------------------------------------
   Clock Rendering
   --------------------------------------------------------- */

/**
 * Build and return a clock card DOM element for the given
 * IANA time zone string.
 * @param {string} tz  — e.g. "America/New_York"
 * @returns {HTMLElement}
 */
function createClockCard(tz) {
  // Derive a friendly city/region label from the IANA key
  const parts  = tz.split('/');
  const city   = parts[parts.length - 1].replace(/_/g, ' ');
  const region = parts.length > 1 ? parts[0] : '';

  const card = document.createElement('div');
  card.classList.add('clock-card');
  card.dataset.tz = tz;

  card.innerHTML = `
    <span class="tz-label">${region ? region + ' &middot; ' : ''}${tz === 'UTC' ? 'Universal' : ''}</span>
    <span class="tz-city">${city}</span>
    <div  class="clock-time" id="time-${sanitizeId(tz)}">--:--:--</div>
    <div  class="clock-date" id="date-${sanitizeId(tz)}">---</div>
    <button class="btn-remove" onclick="removeTimezone('${tz}')">Remove</button>
  `;

  return card;
}

/**
 * Convert an IANA time zone string into a valid DOM id fragment
 * by replacing non-alphanumeric characters with underscores.
 * @param {string} tz
 * @returns {string}
 */
function sanitizeId(tz) {
  return tz.replace(/[^a-zA-Z0-9]/g, '_');
}

/**
 * Render all time zone cards into #clocksGrid from scratch.
 * Called once on startup.
 */
function renderAllClocks() {
  const grid = document.getElementById('clocksGrid');
  grid.innerHTML = '';
  timezones.forEach(tz => grid.appendChild(createClockCard(tz)));
}

/* ---------------------------------------------------------
   Clock Update Loop
   --------------------------------------------------------- */

/**
 * Format the current time for a given IANA time zone and
 * update the matching DOM elements.
 * @param {string} tz
 */
function updateClock(tz) {
  const now = new Date();

  const timeStr = new Intl.DateTimeFormat('en-GB', {
    timeZone:    tz,
    hour:        '2-digit',
    minute:      '2-digit',
    second:      '2-digit',
    hour12:      false,
  }).format(now);

  const dateStr = new Intl.DateTimeFormat('en-GB', {
    timeZone:  tz,
    weekday:   'short',
    day:       'numeric',
    month:     'short',
    year:      'numeric',
  }).format(now);

  const safeId   = sanitizeId(tz);
  const timeEl   = document.getElementById(`time-${safeId}`);
  const dateEl   = document.getElementById(`date-${safeId}`);
  if (timeEl) timeEl.textContent = timeStr;
  if (dateEl) dateEl.textContent = dateStr;
}

/**
 * Update every active clock — called by setInterval every second.
 */
function updateClocks() {
  timezones.forEach(updateClock);
}

/* ---------------------------------------------------------
   Add / Remove Time Zones
   --------------------------------------------------------- */

/**
 * Validate an IANA time zone string by attempting to use it
 * with Intl.DateTimeFormat.
 * @param {string} tz
 * @returns {boolean}
 */
function isValidTimezone(tz) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Read the value from #tzInput, validate it, add it to the
 * timezones array, and inject a new card into the grid.
 * Globally scoped — called by onclick in Index.html.
 */
function addTimezone() {
  const input = document.getElementById('tzInput');
  const tz    = input.value.trim();

  if (!tz) {
    flashInput(input, 'Please enter a time zone (e.g. Europe/Paris).');
    return;
  }

  if (!isValidTimezone(tz)) {
    flashInput(input, `"${tz}" is not a recognised IANA time zone.`);
    return;
  }

  if (timezones.includes(tz)) {
    flashInput(input, `"${tz}" is already displayed.`);
    return;
  }

  timezones.push(tz);

  const grid = document.getElementById('clocksGrid');
  const card = createClockCard(tz);
  grid.appendChild(card);

  // Populate the new card immediately (no 1-second wait)
  updateClock(tz);

  input.value = '';
  input.focus();
}

/**
 * Remove a time zone card from the grid and from the state array.
 * Globally scoped — called by onclick attributes inside clock cards.
 * @param {string} tz
 */
function removeTimezone(tz) {
  const idx = timezones.indexOf(tz);
  if (idx !== -1) timezones.splice(idx, 1);

  const grid = document.getElementById('clocksGrid');
  const card = grid.querySelector(`.clock-card[data-tz="${tz}"]`);
  if (card) {
    // Animate out before removing
    card.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    card.style.opacity    = '0';
    card.style.transform  = 'scale(0.92)';
    setTimeout(() => card.remove(), 220);
  }
}

/* ---------------------------------------------------------
   UI Helpers
   --------------------------------------------------------- */

/**
 * Briefly highlight the input in orange and show an alert-style
 * message to give the user feedback on an invalid entry.
 * @param {HTMLInputElement} inputEl
 * @param {string}           message
 */
function flashInput(inputEl, message) {
  inputEl.style.borderColor = 'var(--accent)';
  inputEl.style.boxShadow   = '0 0 0 3px rgba(249,115,22,0.35)';
  alert(message);
  setTimeout(() => {
    inputEl.style.borderColor = '';
    inputEl.style.boxShadow   = '';
  }, 1200);
  inputEl.focus();
}

/* ---------------------------------------------------------
   Boot
   --------------------------------------------------------- */
(function init() {
  // Apply saved (or default dark) theme before rendering
  initTheme();

  // Render initial clock cards
  renderAllClocks();

  // Populate times right away so there is no blank first second
  updateClocks();

  // Tick every second
  setInterval(updateClocks, 1000);
})();
