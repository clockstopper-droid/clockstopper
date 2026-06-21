# Project Context Document: Global Time Clock (clockstopper)

## Project Overview

**Global Time Clock** is a lightweight, client-side web application that displays multiple world clocks simultaneously across different IANA time zones. It is a pure frontend application with no backend dependencies, build tools, or frameworks — designed to run directly in a browser by opening `Index.html`.

The app updates all displayed clocks every second and allows users to dynamically add or remove time zones via a simple UI. A **dark theme with orange accent keypad/controls** is supported via a CSS class toggle. A **mute button** allows users to silence any audio alerts/ticking sounds without removing clocks. An **enhanced connectivity panel** displays WiFi/network status, detects available networks, and allows network selection — all using native browser APIs where possible, supplemented by a fetch-based connectivity probe.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Markup | HTML5 |
| Styling | CSS3 (custom, no framework) |
| Logic | Vanilla JavaScript (ES6+) |
| Time Zone Handling | Native `Intl.DateTimeFormat` API (IANA time zones) |
| Connectivity Detection | Native `navigator.onLine` API + `online`/`offline` window events + fetch-based probe |
| Network Information | `navigator.connection` / `NetworkInformation` API (where available) |
| Runtime | Browser only — no Node.js, no build step |

---

## Repository Structure

```
clockstopper/
├── Index.html          # Entry point — main HTML shell
├── Css/
│   └── Style.css       # Global styles, responsive layout, dark theme, connectivity panel
├── js/
│   └── app.js          # All application logic, theme toggle, mute toggle, connectivity detection
├── README.md           # Project documentation
└── .gitignore          # Android/IntelliJ artifacts excluded
```

> **Note:** The `.gitignore` file contains Android/Gradle/IntelliJ patterns, suggesting this repository may have been initialized from an Android project template or the developer reused an existing `.gitignore`. These entries are irrelevant to the web app itself.

---

## Architecture

This is a **single-page, no-framework, pure JavaScript application**. There is no module system, no bundler, and no package manager involved.

### Component Breakdown

```
Index.html
  └── #clocksGrid              → Dynamic container where clock cards are injected
  └── #tzInput                 → Text input for new IANA time zone strings
  └── #connectivityPanel       → Enhanced connectivity panel container (replaces simple #wifiStatus)
  └── #wifiStatus              → Status indicator element within the connectivity panel
  └── #networkList             → Dynamic list of detected/available networks within the panel
  └── #connectivityProbeStatus → Displays result of fetch-based internet probe
  └── addTimezone()            → Called inline via button onclick
  └── toggleTheme()            → Called inline via theme toggle button onclick
  └── toggleMute()             → Called inline via mute button onclick
  └── toggleConnectivityPanel()→ Called inline to expand/collapse the connectivity panel

js/app.js
  └── State management         → Tracks list of active time zones, mute state, connectivity state, network info
  └── Clock rendering          → Generates DOM elements for each clock card
  └── Tick loop                → setInterval (every 1000ms) updates all clocks
  └── addTimezone()            → Validates and adds a new time zone
  └── removeTimezone()         → Removes a clock card by time zone identifier
  └── toggleTheme()            → Toggles dark-theme class on <body>
  └── toggleMute()             → Toggles muted state; updates mute button appearance
  └── toggleConnectivityPanel()→ Expands/collapses the connectivity panel
  └── initConnectivity()       → Registers online/offline event listeners, sets initial state, starts probe
  └── updateConnectivityUI()   → Updates connectivity panel classes and text to reflect online/offline
  └── probeConnectivity()      → Fetch-based probe to verify actual internet access beyond navigator.onLine
  └── updateNetworkInfo()      → Reads navigator.connection and updates network detail display
  └── scanNetworks()           → Attempts to enumerate available networks (where browser API permits)

Css/Style.css
  └── .container               → Page wrapper, centered layout
  └── .clocks-grid             → CSS Grid layout for clock cards
  └── .controls                → Input and button styling
  └── .dark-theme              → Dark background with orange accent keypad/controls
  └── .mute-btn                → Mute button base styles
  └── .mute-btn.muted          → Visual state for muted/active mute
  └── .connectivity-panel      → Enhanced connectivity panel container styles
  └── .connectivity-panel.expanded → Expanded/visible state of the panel
  └── .wifi-status             → Connectivity indicator base styles
  └── .wifi-status.online      → Visual state for online/connected
  └── .wifi-status.offline     → Visual state for offline/disconnected
  └── .network-list            → Styles for the list of available/detected networks
  └── .network-list-item       → Individual network entry styles
  └── .network-list-item.selected → Visual state for currently selected/active network
  └── .probe-status            → Styles for the fetch-probe result indicator
  └── .probe-status.verified   → Visual state when internet access is confirmed via probe
  └── .probe-status.unverified → Visual state when probe fails despite navigator.onLine = true
  └── Responsive rules         → Mobile-friendly breakpoints
```

### Data Flow

```
User Input (tzInput)
    → addTimezone()
        → Validate IANA string via Intl.DateTimeFormat
        → Push to timezones[] array
        → Render new clock card into #clocksGrid

setInterval (1000ms)
    → updateClocks()
        → For each timezone in timezones[]
            → Format current time using Intl.DateTimeFormat
            → Update the DOM element for that clock

Theme Toggle Button
    → toggleTheme()
        → Toggle .dark-theme class on document.body
        → CSS handles all visual changes via class-scoped rules

Mute Button
    → toggleMute()
        → Toggle isMuted boolean state variable in app.js
        → Update mute button label/icon/class to reflect current state
        → Audio output (if any) respects the isMuted flag

Window online/offline events + navigator.onLine
    → updateConnectivityUI()
        → Add/remove .online / .offline CSS classes on #wifiStatus element
        → Update indicator text/icon to reflect current connectivity state
        → Trigger probeConnectivity() to verify actual internet access

probeConnectivity()
    → fetch() request to a known lightweight endpoint
        → On success: mark #connectivityProbeStatus as .verified
        → On failure: mark #connectivityProbeStatus as .unverified
        → Updates panel display regardless of navigator.onLine value

navigator.connection (NetworkInformation API)
    → updateNetworkInfo()
        → Read effectiveType, downlink, rtt, type properties if available
        → Update network detail display in connectivity panel
        → Register change event listener if API is available

Connectivity Panel Toggle
    → toggleConnectivityPanel()
        → Toggle .expanded class on #connectivityPanel
        → On expand: trigger updateNetworkInfo() and scanNetworks()
        → CSS handles show/hide and animation via class-scoped rules
```

---

## Key Files

### `Index.html`
- The **sole HTML file** and application entry point.
- Defines the page structure: a heading, the `#clocksGrid` div (dynamically populated), the controls section, a **theme toggle button**, a **mute button**, and an **enhanced `#connectivityPanel`** containing the `#wifiStatus` indicator, `#networkList`, and `#connectivityProbeStatus` elements.
- Loads `css/style.css` and `js/app.js` via relative paths.
- Uses inline `onclick="addTimezone()"` on the Add Clock button, `onclick="toggleTheme()"` on the theme toggle button, `onclick="toggleMute()"` on the mute button, and `onclick="toggleConnectivityPanel()"` on the connectivity panel trigger — all functions must be globally scoped in `app.js`.
- The `#wifiStatus`, `#networkList`, and `#connectivityProbeStatus` elements are updated programmatically — they do not use `onclick` handlers.
- **Case sensitivity note:** The file is named `Index.html` (capital I). On case-sensitive file systems (Linux servers, some CI environments), references must match exactly.

### `js/app.js`
- Contains **all application logic** including theme toggling, mute toggling, and the full connectivity/network detection system.
- Manages the time zone state array, mute state (`isMuted` boolean), connectivity state, network info state, DOM rendering, the update interval, add/remove operations, dark theme toggle, mute toggle, connectivity panel updates, and network scanning.
- Uses the `Intl.DateTimeFormat` API for locale-aware, time-zone-aware formatting — no external date libraries needed.
- Uses `navigator.onLine` for the initial connectivity state on page load.
- Uses `navigator.connection` (NetworkInformation API) where available to surface network type, effective type, downlink speed, and RTT.
- Implements `probeConnectivity()` using `fetch()` to a known lightweight endpoint to verify actual internet access, supplementing the unreliable `navigator.onLine` value.
- Registers `window` event listeners for `'online'` and `'offline'` events to reactively update the connectivity panel.
- `toggleTheme()`, `toggleMute()`, and `toggleConnectivityPanel()` must remain globally scoped as they are referenced via HTML `onclick` attributes.
- `initConnectivity()` is called on page load (e.g., `DOMContentLoaded` or at script execution time) to set up listeners, render initial state, and run the initial probe.

### `Css/Style.css`
- Handles all visual presentation including the **dark theme**, **mute button states**, and **enhanced connectivity panel**.
- Implements a **CSS Grid** layout for the clock cards (`#clocksGrid`).
- Dark theme is implemented via a `.dark-theme` class on `<body>`, using **orange as the primary accent color** for buttons (keypad/controls area).
- Mute button uses a `.muted` class (toggled on the button element) to visually indicate the muted state.
- Connectivity panel uses `.expanded` class for show/hide toggling and animation; `.online`/`.offline` on `#wifiStatus`; `.verified`/`.unverified` on `#connectivityProbeStatus`; `.selected` on active network list items.
- Dark theme styles for the connectivity panel are scoped under `.dark-theme` for consistency with the theming system.
- Includes responsive/mobile-friendly rules.
- **Case sensitivity note:** The folder is `Css/` and file is `Style.css` (both capitalized). References in HTML must match.

---

## Theming System

### Dark Theme with Orange Keypad

- Activated by toggling the `.dark-theme` CSS class on `document.body`.
- All dark theme rules are **scoped under `.dark-theme`** in `Style.css` — no separate stylesheet is needed.
- **Orange accent** is applied to the controls/keypad area (buttons, input borders, interactive elements) when dark theme is active.
- The toggle is handled by `toggleTheme()` in `app.js`, called via an `onclick` button in `Index.html`.
- Theme state is **not persisted** across page refreshes (no localStorage for theme preference currently).
- The connectivity panel's dark-theme appearance is also scoped under `.dark-theme` for visual consistency.

### Theme Color Palette (Dark Mode)
| Element | Style |
|---|---|
| Background | Dark (near-black or dark gray) |
| Text | Light (white or light gray) |
| Buttons / Keypad controls | Orange accent |
| Clock cards | Darker card background |
| Connectivity indicator (online) | Green (dark-theme scoped) |
| Connectivity indicator (offline) | Red (dark-theme scoped) |
| Probe verified | Green (dark-theme scoped) |
| Probe unverified | Amber/yellow (dark-theme scoped) |

---

## Mute System

### Mute Button

- A **mute button** is present in the controls area in `Index.html`, wired to `onclick="toggleMute()"`.
- `toggleMute()` in `app.js` maintains an `isMuted` boolean state variable.
- When toggled, the button receives or loses a `.muted` CSS class to provide clear visual feedback of the current mute state (e.g., changed label, icon, or color).
- Any audio output (ticking sounds, alerts) in the application must check `isMuted` before playing.
- Mute state is **not persisted** across page refreshes — resets to unmuted on reload.
- Follows the same **CSS class toggle pattern** used by the theme system — no inline styles.

---

## Connectivity Detection System

### Enhanced Connectivity Panel

- A **`#connectivityPanel`** container is present in `Index.html`, replacing the former simple `#wifiStatus` element as a standalone indicator.
- The panel is **collapsible/expandable** via `toggleConnectivityPanel()`, which toggles an `.expanded` CSS class on the panel container.
- The panel contains three sub-components:
  1. **`#wifiStatus`** — Basic online/offline indicator driven by `navigator.onLine` and `window` `online`/`offline` events.
  2. **`#connectivityProbeStatus`** — Fetch-based probe result indicating whether actual internet access is confirmed (`.verified`) or unconfirmed (`.unverified`), addressing the known limitation that `navigator.onLine` can return `true` without real WAN access.
  3. **`#networkList`** — Dynamic list of available/detected networks populated by `scanNetworks()`; entries use `.selected` class to mark the active network.
- Initial state is determined by `navigator.onLine` at page load time via `initConnectivity()` in `app.js`.
- `probeConnectivity()` uses `fetch()` to a known lightweight endpoint and updates `#connectivityProbeStatus` independently of `navigator.onLine`.
- `updateNetworkInfo()` reads from `navigator.connection` (NetworkInformation API) where available — gracefully degrades on unsupported browsers.
- `scanNetworks()` attempts to enumerate available networks using browser APIs where permitted; degrades gracefully where not available.
- All state changes are reflected via CSS class toggling — no inline styles.
- Follows the same **CSS class toggle / state-driven UI pattern** used by the theme and mute systems.
- No external libraries or APIs are used; relies entirely on native browser capabilities (`navigator.onLine`, `navigator.connection`, `fetch()`, `window` events).

### Connectivity API Availability Notes

| API | Availability | Fallback Behavior |
|---|---|---|
| `navigator.onLine` | All modern browsers | Primary signal; known to be unreliable for WAN detection |
| `window` `online`/`offline` events | All modern browsers | Primary reactive update mechanism |
| `fetch()` probe | All modern browsers | Used to verify actual internet access |
| `navigator.connection` (NetworkInformation) | Chrome/Android; not Safari/Firefox | Gracefully omitted if unavailable |
| Network enumeration/selection | Very limited browser support | Panel degrades to status-only display |

---

## Coding Conventions

- **No modules or imports** — all JavaScript is in a single global script file.
- **Global functions** — `addTimezone()`, `removeTimezone()`, `toggleTheme()`, `toggleMute()`, and `toggleConnectivityPanel()` must remain globally accessible because they are referenced in HTML `onclick` attributes.
- **IANA time zone strings** — time zones are identified by standard IANA keys (e.g., `America/New_York`, `Asia/Tokyo`, `UTC`).
- **Native browser APIs only** — `Intl.DateTimeFormat`, `navigator.onLine`, `navigator.connection`, `fetch()`, `window` events, `setInterval`, `document.getElementById`, `document.createElement` — no polyfills or libraries.
- **State via boolean flags** — simple feature toggles (mute, theme, panel expanded) use boolean variables in `app.js` combined with CSS class toggling on relevant elements.
- **Theme/state toggling via CSS class** — use `classList.toggle()` or `classList.add/remove()` pattern; avoid inline styles for stateful UI changes. This pattern applies to theme, mute, connectivity indicator states, panel expansion, probe status, and network selection states.
- **Graceful degradation** — features relying