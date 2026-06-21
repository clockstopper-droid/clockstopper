// ---------------------------------------------------------
// Global Time Clock — app.js
// All functions are globally scoped for use in HTML onclick
// ---------------------------------------------------------

// Array of active timezone objects: { tz: string, muted: boolean }
let timezones = [
  { tz: 'UTC', muted: false },
  { tz: 'America/New_York', muted: false },
  { tz: 'America/Los_Angeles', muted: false },
  { tz: 'Europe/London', muted: false },
  { tz: 'Asia/Tokyo', muted: false },
];

// ---------------------------------------------------------
// Rendering
// ---------------------------------------------------------

/**
 * Render all clock cards from scratch into #clocksGrid.
 */
function renderClocks() {
  const grid = document.getElementById('clocksGrid');
  grid.innerHTML = '';

  timezones.forEach(function (entry) {
    const card = document.createElement('div');
    card.className = 'clock-card' + (entry.muted ? ' muted' : '');
    card.id = 'card-' + entry.tz.replace(/\//g, '_');

    // Zone label
    const label = document.createElement('div');
    label.className = 'clock-label';
    label.textContent = entry.tz;

    // Time display
    const timeEl = document.createElement('div');
    timeEl.className = 'clock-time';
    timeEl.id = 'time-' + entry.tz.replace(/\//g, '_');

    // Muted indicator
    const mutedBadge = document.createElement('div');
    mutedBadge.className = 'muted-badge';
    mutedBadge.textContent = '⏸ Paused';

    // Button row
    const btnRow = document.createElement('div');
    btnRow.className = 'clock-btn-row';

    const muteBtn = document.createElement('button');
    muteBtn.className = 'btn-mute' + (entry.muted ? ' active' : '');
    muteBtn.textContent = entry.muted ? '▶ Resume' : '⏸ Mute';
    muteBtn.title = entry.muted ? 'Resume this clock' : 'Pause this clock';
    muteBtn.setAttribute('aria-pressed', String(entry.muted));
    muteBtn.onclick = function () { toggleMute(entry.tz); };

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove';
    removeBtn.textContent = '✕ Remove';
    removeBtn.title = 'Remove this clock';
    removeBtn.onclick = function () { removeTimezone(entry.tz); };

    btnRow.appendChild(muteBtn);
    btnRow.appendChild(removeBtn);

    card.appendChild(label);
    card.appendChild(timeEl);
    card.appendChild(mutedBadge);
    card.appendChild(btnRow);
    grid.appendChild(card);
  });

  // Populate all times immediately after render
  updateClocks();
}

// ---------------------------------------------------------
// Clock update loop
// ---------------------------------------------------------

/**
 * Update every non-muted clock's displayed time.
 * Muted clocks are skipped — their last-shown time is frozen.
 */
function updateClocks() {
  const now = new Date();

  timezones.forEach(function (entry) {
    if (entry.muted) return; // frozen — do not update

    const el = document.getElementById('time-' + entry.tz.replace(/\//g, '_'));
    if (!el) return;

    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: entry.tz,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      el.textContent = formatter.format(now);
    } catch (e) {
      el.textContent = 'Invalid timezone';
    }
  });
}

// Start the 1-second tick
setInterval(updateClocks, 1000);

// ---------------------------------------------------------
// Public API — must remain globally scoped
// ---------------------------------------------------------

/**
 * Add a new timezone clock card.
 * Called via onclick in Index.html.
 */
function addTimezone() {
  const input = document.getElementById('tzInput');
  const tz = input.value.trim();

  if (!tz) {
    alert('Please enter a time zone (e.g. America/New_York).');
    return;
  }

  // Validate by attempting to use the IANA key
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
  } catch (e) {
    alert('"' + tz + '" is not a valid IANA time zone identifier.');
    return;
  }

  // Prevent duplicates
  const alreadyExists = timezones.some(function (entry) {
    return entry.tz === tz;
  });
  if (alreadyExists) {
    alert('"' + tz + '" is already displayed.');
    return;
  }

  timezones.push({ tz: tz, muted: false });
  input.value = '';
  renderClocks();
}

/**
 * Remove a clock card by its IANA time zone string.
 * Called via onclick generated in renderClocks().
 */
function removeTimezone(tz) {
  timezones = timezones.filter(function (entry) {
    return entry.tz !== tz;
  });
  renderClocks();
}

/**
 * Toggle the muted (paused) state of a clock.
 * Called via onclick generated in renderClocks().
 */
function toggleMute(tz) {
  const entry = timezones.find(function (e) { return e.tz === tz; });
  if (!entry) return;

  entry.muted = !entry.muted;

  // Update card class
  const card = document.getElementById('card-' + tz.replace(/\//g, '_'));
  if (card) {
    card.classList.toggle('muted', entry.muted);
  }

  // Update mute button label, title, and aria-pressed
  const muteBtn = card ? card.querySelector('.btn-mute') : null;
  if (muteBtn) {
    muteBtn.textContent = entry.muted ? '▶ Resume' : '⏸ Mute';
    muteBtn.title      = entry.muted ? 'Resume this clock' : 'Pause this clock';
    muteBtn.setAttribute('aria-pressed', String(entry.muted));
    muteBtn.classList.toggle('active', entry.muted);
  }
}

/**
 * Toggle dark theme on <body>.
 * Called via onclick in Index.html.
 */
function toggleTheme() {
  document.body.classList.toggle('dark-theme');
}

// ---------------------------------------------------------
// Initialise
// ---------------------------------------------------------
renderClocks();
