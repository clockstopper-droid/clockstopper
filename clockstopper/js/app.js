// ─── State ────────────────────────────────────────────────────────────────────
var timezones = ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];
var isMuted   = false;

// ─── WiFi / Connectivity State ────────────────────────────────────────────────
/**
 * Connectivity module – detects network state via the Online/Offline API and
 * the Network Information API (where available) and exposes helpers so that
 * any part of the application (or future callers) can gate data-transmitting
 * operations on a live connection.
 *
 * Public surface
 * ──────────────
 *   wifi.isOnline()          → boolean  – true when the browser reports a live network
 *   wifi.getConnectionType() → string   – e.g. "wifi", "4g", "ethernet", "unknown"
 *   wifi.canTransmit()       → boolean  – true when online AND connection type is not
 *                                         a known unavailable type
 *   wifi.onChange(fn)        → void     – register a callback invoked on every status
 *                                         change; receives the current status object
 *   wifi.offChange(fn)       → void     – deregister a previously registered callback
 */
var wifi = (function () {
    // Internal subscriber list
    var _listeners = [];

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Returns true when navigator.onLine is true (or the API is absent). */
    function _isOnline() {
        return (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean')
            ? navigator.onLine
            : true; // assume online if API unavailable
    }

    /**
     * Returns the effective connection type string.
     * Uses the Network Information API (navigator.connection) when present.
     * Falls back to "unknown" when online but the API is absent, or "none" when offline.
     */
    function _getConnectionType() {
        if (!_isOnline()) return 'none';

        var conn = (navigator.connection || navigator.mozConnection || navigator.webkitConnection);
        if (conn) {
            // Prefer effectiveType (e.g. "4g") when available; fall back to type
            return conn.type || conn.effectiveType || 'unknown';
        }

        return 'unknown';
    }

    /**
     * Builds the status object shared with listeners and returned by public methods.
     * @returns {{ online: boolean, type: string, canTransmit: boolean }}
     */
    function _buildStatus() {
        var online = _isOnline();
        var type   = _getConnectionType();
        // canTransmit: online and not explicitly "none"
        var canTransmit = online && type !== 'none';
        return { online: online, type: type, canTransmit: canTransmit };
    }

    /** Notifies all registered listeners with the current status. */
    function _notify() {
        var status = _buildStatus();
        for (var i = 0; i < _listeners.length; i++) {
            try { _listeners[i](status); } catch (e) { /* swallow listener errors */ }
        }
    }

    // ── Event wiring ──────────────────────────────────────────────────────────

    // Online / Offline events fire in all supported browsers
    window.addEventListener('online',  _notify);
    window.addEventListener('offline', _notify);

    // Network Information API change event (Chrome/Android)
    var _conn = (navigator.connection || navigator.mozConnection || navigator.webkitConnection);
    if (_conn && typeof _conn.addEventListener === 'function') {
        _conn.addEventListener('change', _notify);
    }

    // ── Public API ────────────────────────────────────────────────────────────
    return {
        /** Returns true when the browser reports a live network connection. */
        isOnline: function () { return _isOnline(); },

        /** Returns the current connection type string (e.g. "wifi", "4g", "none"). */
        getConnectionType: function () { return _getConnectionType(); },

        /**
         * Returns true when the network is available and data transmission is
         * considered viable.  Callers should check this before sending any data.
         */
        canTransmit: function () { return _buildStatus().canTransmit; },

        /**
         * Register a change-listener.
         * @param {function({online: boolean, type: string, canTransmit: boolean})} fn
         */
        onChange: function (fn) {
            if (typeof fn === 'function' && _listeners.indexOf(fn) === -1) {
                _listeners.push(fn);
            }
        },

        /**
         * Deregister a previously registered change-listener.
         * @param {function} fn
         */
        offChange: function (fn) {
            var idx = _listeners.indexOf(fn);
            if (idx !== -1) _listeners.splice(idx, 1);
        }
    };
}());

// ─── WiFi Status UI ──────────────────────────────────────────────────────────

/**
 * Maps a connection type string to a human-readable label.
 * @param {string} type
 * @returns {string}
 */
function _wifiTypeLabel(type) {
    var labels = {
        'wifi':      'WiFi',
        'ethernet':  'Ethernet',
        '4g':        '4G',
        '3g':        '3G',
        '2g':        '2G',
        'slow-2g':   '2G (slow)',
        'none':      'Offline',
        'unknown':   'Connected'
    };
    return labels[type] || 'Connected';
}

/**
 * Refreshes the WiFi status indicator element in the DOM to reflect the
 * current network state.
 */
function updateWifiStatus() {
    var indicator = document.getElementById('wifiStatus');
    if (!indicator) return;

    var online    = wifi.isOnline();
    var type      = wifi.getConnectionType();
    var typeLabel = _wifiTypeLabel(type);

    // Update CSS classes for colour coding
    indicator.classList.remove('wifi-online', 'wifi-offline');
    indicator.classList.add(online ? 'wifi-online' : 'wifi-offline');

    // Icon: filled circle when online, hollow circle when offline
    var iconSpan  = indicator.querySelector('.wifi-icon');
    var labelSpan = indicator.querySelector('.wifi-label');

    if (iconSpan) {
        iconSpan.textContent = online ? '●' : '○';
        iconSpan.setAttribute('aria-hidden', 'true');
    }

    if (labelSpan) {
        labelSpan.textContent = online ? typeLabel : 'Offline';
    }

    // Accessible title on the whole indicator
    indicator.setAttribute(
        'title',
        online
            ? 'Network connected – ' + typeLabel
            : 'No network connection'
    );
    indicator.setAttribute('aria-label', indicator.getAttribute('title'));
}

// Wire the connectivity module to keep the indicator live on state changes
wifi.onChange(function () { updateWifiStatus(); });

// ─── Clock Rendering ──────────────────────────────────────────────────────────

/**
 * Formats the current time for the given IANA timezone.
 * @param {string} tz  – IANA timezone identifier
 * @returns {string}
 */
function formatTime(tz) {
    try {
        return new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hour:     '2-digit',
            minute:   '2-digit',
            second:   '2-digit',
            hour12:   true
        }).format(new Date());
    } catch (e) {
        return '--:--:--';
    }
}

/**
 * Formats the current date for the given IANA timezone.
 * @param {string} tz  – IANA timezone identifier
 * @returns {string}
 */
function formatDate(tz) {
    try {
        return new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            weekday:  'short',
            year:     'numeric',
            month:    'short',
            day:      'numeric'
        }).format(new Date());
    } catch (e) {
        return '';
    }
}

/**
 * Creates and returns a clock card DOM element for a timezone.
 * @param {string} tz
 * @returns {HTMLElement}
 */
function createClockCard(tz) {
    var card = document.createElement('div');
    card.className = 'clock-card';
    card.id        = 'clock-' + tz.replace(/\//g, '-').replace(/ /g, '_');
    card.setAttribute('data-tz', tz);
    card.setAttribute('role', 'listitem');

    var tzLabel = document.createElement('div');
    tzLabel.className   = 'tz-label';
    tzLabel.textContent = tz;

    var timeDisplay = document.createElement('div');
    timeDisplay.className   = 'time-display';
    timeDisplay.textContent = formatTime(tz);
    timeDisplay.setAttribute('aria-live', 'polite');
    timeDisplay.setAttribute('aria-atomic', 'true');

    var dateDisplay = document.createElement('div');
    dateDisplay.className   = 'date-display';
    dateDisplay.textContent = formatDate(tz);

    var removeBtn = document.createElement('button');
    removeBtn.className   = 'remove-btn';
    removeBtn.textContent = '✕ Remove';
    removeBtn.setAttribute('aria-label', 'Remove ' + tz);
    removeBtn.onclick = function () { removeTimezone(tz); };

    card.appendChild(tzLabel);
    card.appendChild(timeDisplay);
    card.appendChild(dateDisplay);
    card.appendChild(removeBtn);

    return card;
}

/**
 * Renders all clocks from the timezones[] state into #clocksGrid.
 */
function renderClocks() {
    var grid = document.getElementById('clocksGrid');
    if (!grid) return;
    grid.innerHTML = '';
    for (var i = 0; i < timezones.length; i++) {
        grid.appendChild(createClockCard(timezones[i]));
    }
}

/**
 * Updates the time/date text on every existing clock card without re-rendering.
 */
function updateClocks() {
    var cards = document.querySelectorAll('.clock-card');
    for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var tz   = card.getAttribute('data-tz');
        if (!tz) continue;

        var timeEl = card.querySelector('.time-display');
        var dateEl = card.querySelector('.date-display');

        if (timeEl) timeEl.textContent = formatTime(tz);
        if (dateEl) dateEl.textContent = formatDate(tz);
    }
}

// ─── Public Actions ───────────────────────────────────────────────────────────

/**
 * Validates an IANA timezone string by attempting to construct an
 * Intl.DateTimeFormat with it.
 * @param {string} tz
 * @returns {boolean}
 */
function isValidTimezone(tz) {
    if (!tz || typeof tz !== 'string') return false;
    try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Adds a new timezone clock from the text input.
 * Globally scoped — called via onclick in Index.html.
 */
function addTimezone() {
    var input = document.getElementById('tzInput');
    if (!input) return;

    var tz = input.value.trim();

    if (!tz) {
        alert('Please enter a timezone (e.g. America/Chicago).');
        return;
    }

    if (!isValidTimezone(tz)) {
        alert('"' + tz + '" is not a valid IANA timezone identifier.\nExample: America/Chicago');
        return;
    }

    if (timezones.indexOf(tz) !== -1) {
        alert('"' + tz + '" is already displayed.');
        return;
    }

    timezones.push(tz);
    var grid = document.getElementById('clocksGrid');
    if (grid) grid.appendChild(createClockCard(tz));

    input.value = '';
    input.focus();
}

/**
 * Removes the clock card for the given timezone.
 * Globally scoped — called via onclick on remove buttons.
 * @param {string} tz
 */
function removeTimezone(tz) {
    var idx = timezones.indexOf(tz);
    if (idx !== -1) timezones.splice(idx, 1);

    var cardId = 'clock-' + tz.replace(/\//g, '-').replace(/ /g, '_');
    var card   = document.getElementById(cardId);
    if (card && card.parentNode) card.parentNode.removeChild(card);
}

/**
 * Toggles the dark theme class on <body>.
 * Globally scoped — called via onclick in Index.html.
 */
function toggleTheme() {
    document.body.classList.toggle('dark-theme');
}

/**
 * Toggles the mute state and updates the mute button appearance.
 * Globally scoped — called via onclick in Index.html.
 */
function toggleMute() {
    isMuted = !isMuted;
    var muteBtn = document.getElementById('muteBtn');
    if (muteBtn) {
        muteBtn.classList.toggle('muted', isMuted);
        muteBtn.textContent = isMuted ? '🔇 Unmute' : '🔊 Mute';
        muteBtn.setAttribute('aria-pressed', String(isMuted));
    }
}

// ─── Initialisation ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
    // Render initial clock set
    renderClocks();

    // Kick off the live clock tick (every second)
    setInterval(updateClocks, 1000);

    // Paint initial WiFi status
    updateWifiStatus();
});
