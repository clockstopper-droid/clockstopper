# Project Context Document: Global Time Clock (clockstopper)

## Project Overview

**Global Time Clock** is a lightweight, client-side web application that displays multiple world clocks simultaneously across different IANA time zones. It is a pure frontend application with no backend dependencies, build tools, or frameworks — designed to run directly in a browser by opening `Index.html`.

The app updates all displayed clocks every second and allows users to dynamically add or remove time zones via a simple UI. A **dark theme with orange accent keypad/controls** is supported via a CSS class toggle. A **mute button** allows users to silence any audio alerts/ticking sounds without removing clocks.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Markup | HTML5 |
| Styling | CSS3 (custom, no framework) |
| Logic | Vanilla JavaScript (ES6+) |
| Time Zone Handling | Native `Intl.DateTimeFormat` API (IANA time zones) |
| Runtime | Browser only — no Node.js, no build step |

---

## Repository Structure

```
clockstopper/
├── Index.html          # Entry point — main HTML shell
├── Css/
│   └── Style.css       # Global styles, responsive layout, dark theme
├── js/
│   └── app.js          # All application logic, theme toggle, mute toggle
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
  └── #clocksGrid         → Dynamic container where clock cards are injected
  └── #tzInput            → Text input for new IANA time zone strings
  └── addTimezone()       → Called inline via button onclick
  └── toggleTheme()       → Called inline via theme toggle button onclick
  └── toggleMute()        → Called inline via mute button onclick

js/app.js
  └── State management    → Tracks list of active time zones and mute state
  └── Clock rendering     → Generates DOM elements for each clock card
  └── Tick loop           → setInterval (every 1000ms) updates all clocks
  └── addTimezone()       → Validates and adds a new time zone
  └── removeTimezone()    → Removes a clock card by time zone identifier
  └── toggleTheme()       → Toggles dark-theme class on <body>
  └── toggleMute()        → Toggles muted state; updates mute button appearance

Css/Style.css
  └── .container          → Page wrapper, centered layout
  └── .clocks-grid        → CSS Grid layout for clock cards
  └── .controls           → Input and button styling
  └── .dark-theme         → Dark background with orange accent keypad/controls
  └── .mute-btn           → Mute button base styles
  └── .mute-btn.muted     → Visual state for muted/active mute
  └── Responsive rules    → Mobile-friendly breakpoints
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
```

---

## Key Files

### `Index.html`
- The **sole HTML file** and application entry point.
- Defines the page structure: a heading, the `#clocksGrid` div (dynamically populated), the controls section, a **theme toggle button**, and a **mute button**.
- Loads `css/style.css` and `js/app.js` via relative paths.
- Uses inline `onclick="addTimezone()"` on the Add Clock button, `onclick="toggleTheme()"` on the theme toggle button, and `onclick="toggleMute()"` on the mute button — all functions must be globally scoped in `app.js`.
- **Case sensitivity note:** The file is named `Index.html` (capital I). On case-sensitive file systems (Linux servers, some CI environments), references must match exactly.

### `js/app.js`
- Contains **all application logic** including theme toggling and mute toggling.
- Manages the time zone state array, mute state (`isMuted` boolean), DOM rendering, the update interval, add/remove operations, dark theme toggle, and mute toggle.
- Uses the `Intl.DateTimeFormat` API for locale-aware, time-zone-aware formatting — no external date libraries needed.
- `toggleTheme()` and `toggleMute()` must remain globally scoped as they are referenced via HTML `onclick` attributes.

### `Css/Style.css`
- Handles all visual presentation including the **dark theme** and **mute button states**.
- Implements a **CSS Grid** layout for the clock cards (`#clocksGrid`).
- Dark theme is implemented via a `.dark-theme` class on `<body>`, using **orange as the primary accent color** for buttons (keypad/controls area).
- Mute button uses a `.muted` class (toggled on the button element) to visually indicate the muted state.
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

### Theme Color Palette (Dark Mode)
| Element | Style |
|---|---|
| Background | Dark (near-black or dark gray) |
| Text | Light (white or light gray) |
| Buttons / Keypad controls | Orange accent |
| Clock cards | Darker card background |

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

## Coding Conventions

- **No modules or imports** — all JavaScript is in a single global script file.
- **Global functions** — `addTimezone()`, `removeTimezone()`, `toggleTheme()`, and `toggleMute()` must remain globally accessible because they are referenced in HTML `onclick` attributes.
- **IANA time zone strings** — time zones are identified by standard IANA keys (e.g., `America/New_York`, `Asia/Tokyo`, `UTC`).
- **Native browser APIs only** — `Intl.DateTimeFormat`, `setInterval`, `document.getElementById`, `document.createElement` — no polyfills or libraries.
- **State via boolean flags** — simple feature toggles (mute, theme) use boolean variables in `app.js` combined with CSS class toggling on relevant elements.
- **Theme/state toggling via CSS class** — use `classList.toggle()` or `classList.add/remove()` pattern; avoid inline styles for stateful UI changes.
- **File naming uses capitalized names** — `Index.html`, `Css/`, `Style.css` — be consistent when adding new files or referencing existing ones.
- **No linting or formatting configuration** present — follow the existing style observed in `app.js`.

---

## Supported Time Zones (Examples)

As documented in `README.md` and shown in the UI:

- `UTC`
- `America/New_York`
- `America/Los_Angeles`
- `Europe/London`
- `Europe/Paris`
- `Asia/Tokyo`
- `Asia/Shanghai`
- `Australia/Sydney`

Any valid **IANA time zone identifier** supported by the user's browser should work.

---

## Development Workflow

### Running Locally
1. Clone the repository.
2. Open `Index.html` directly in any modern web browser.
3. No install step, no build step, no server required.

### Making Changes
- **HTML structure:** Edit `Index.html`.
- **Styling:** Edit `Css/Style.css`.
- **Logic/functionality:** Edit `js/app.js`.
- Refresh the browser to see changes — no hot reload or build process.

### Browser Compatibility
- Requires a browser with `Intl.DateTimeFormat` and `timeZone` option support.
- All modern browsers (Chrome, Firefox, Safari, Edge) are supported.
- Internet Explorer is **not** supported.

---

## Known Quirks & Gotchas

| Issue | Detail |
|---|---|
| Case-sensitive filenames | `Index.html`, `Css/Style.css` use capital letters — match exactly on Linux systems |
| Android `.gitignore` | The gitignore is Android/Gradle-oriented; irrelevant to this web project but harmless |
| Global function scope | `addTimezone()`, `removeTimezone()`, `toggleTheme()`, and `toggleMute()` must not be wrapped in a module or block scope |
| No persistence | Added time zones are lost on page refresh — no localStorage or backend storage |
| No theme persistence | Dark/light theme preference is not saved across sessions — resets to default on refresh |
| No mute persistence | Mute state is not saved across sessions — resets to unmuted on refresh |
| No input sanitization UI feedback | Invalid IANA strings should be validated; check `app.js` for current error handling behavior |
| Single JS file | All logic lives in `app.js` — keep this in mind to avoid scope conflicts when extending |

---

## Extension Points

When adding features, consider these integration points:

- **LocalStorage persistence** — Save/restore the active time zone list across sessions.
- **Theme preference persistence** — Save dark/light mode preference to `localStorage` and restore on load.
- **Mute preference persistence** — Save mute state to `localStorage` and restore on load; follows same pattern as theme persistence.
- **12/24-hour toggle** — Add a UI option passed into `Intl.DateTimeFormat` options.
- **Clock card customization** — Add labels/nicknames per clock stored alongside the IANA key.
- **Drag-to-reorder** — Reorder clock cards using HTML5 Drag and Drop API.
- **Audio alerts/ticking** — Any future audio features should gate playback on the `isMuted` flag already in place.
- **Additional theme variants** — The `.dark-theme` class pattern can be extended with other theme classes (e.g., `.high-contrast-theme`) following the same CSS scoping approach.