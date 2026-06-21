# Project Context Document: Global Time Clock (clockstopper)

## Project Overview

**Global Time Clock** is a lightweight, client-side web application that displays three fixed world clocks: **Eastern Time**, **Central Time**, and **Western (Pacific) Time**. It is a pure frontend application with no backend dependencies, build tools, or frameworks — designed to run directly in a browser by opening `Index.html`.

The app updates all displayed clocks every second. The three time zone clocks are **fixed and hardcoded** — users cannot add or remove clocks. A **dark theme with orange accent keypad/controls** is supported via a CSS class toggle. A **mute button** allows users to silence any audio alerts without removing clocks. There are **no alarm, ticking, or audio clock sounds** — the clocks are purely digital display only. There are **no neon lighting effects** — all neon glow, neon text-shadow, neon border-glow, and neon color effects have been removed from the CSS and JS; the visual style uses clean, flat dark theme styling with orange accents only. There is **no decorative header or Old English / blackletter font** — the application header and any Old English, blackletter, or decorative serif display fonts have been removed from the UI; headings and labels use the standard flat dark-theme typeface consistent with the rest of the app. An **enhanced connectivity panel** displays WiFi/network status, detects available networks, and allows network selection — all using native browser APIs where possible, supplemented by a fetch-based connectivity probe with **exponential backoff retry logic** and **status timestamps**. A **mobile network option** is supported within the connectivity panel, allowing the user to select and use a mobile/cellular network connection when available; the app detects and surfaces mobile network types (e.g., `cellular`, `4g`, `3g`, `2g`) via the `NetworkInformation` API and allows the user to prefer mobile network for call audio routing. An **outgoing call audio system** provides call audio output and requests microphone permissions using the native browser MediaDevices API, with call audio routed through the **currently selected network** (WiFi or mobile). A **microphone permission pre-check UI** proactively checks and displays the microphone permission state before the user attempts to dial, surfacing any permission issues (denied, prompt, granted) in `#micPermissionStatus` with appropriate visual indicators and guidance — this pre-check runs on page load and updates the UI state so users are informed of mic access status before attempting a call. A **dialer UI** displays the number being dialed with a dedicated number display box above the keypad and a live "number being dialed" readout beneath it, updating as digits are entered. A **caller ID name feature** allows the user to set a custom display name — any words or text the user chooses — that appears on the recipient's caller ID instead of the caller's phone number. The user enters and saves a custom caller ID name string which is used when placing outgoing calls; the saved name is what the recipient will see on their caller ID display. **Physical and virtual keyboard input** is supported for the dialer — users can type digits, `*`, `#`, `+`, and control keys (`Backspace`, `Enter`, `Escape`) directly from a hardware keyboard or software keyboard, with the dialer responding identically to keypad button taps. A **call duration timer** is displayed in `#callStatus` during an active call, showing a live elapsed time counter (formatted as `MM:SS` or `HH:MM:SS`) that starts when the call connects and stops when the call ends. A **network type badge** is displayed in `#networkTypeIndicator` during an active call, showing the current network type (e.g., WiFi, 4G, 3G, 2G, Cellular, or Unknown) so the user can see at a glance which network is carrying the active call. The **Backspace button supports long-press to clear** — tapping Backspace removes the last dialed digit, while pressing and holding Backspace for a defined duration (long-press threshold) clears the entire dialed number at once, providing a fast erase shortcut for mobile users. The **dark theme preference is persisted via `localStorage`** — the user's last chosen theme (dark or light) is saved to `localStorage` on each toggle and restored on page load, so the preferred theme is retained across sessions and page reloads.

The application has been **constructed as a mobile dialing app targeting Android devices**, with all features implemented and packaged for Android deployment. The web app source serves as the UI layer within an Android WebView-based wrapper, making the dialer fully functional as a native-feeling Android application.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Markup | HTML5 |
| Styling | CSS3 (custom, no framework) |
| Logic | Vanilla JavaScript (ES6+) |
| Time Zone Handling | Native `Intl.DateTimeFormat` API (IANA time zones) |
| Connectivity Detection | Native `navigator.onLine` API + `online`/`offline` window events + fetch-based connectivity probe with exponential backoff retry and status timestamps |
| Network Information | `navigator.connection` / `NetworkInformation` API (where available) |
| Mobile Network Detection | `navigator.connection.type === 'cellular'` + `effectiveType` (`4g`, `3g`, `2g`) checks |
| Audio Output | Native Web Audio API (`AudioContext`) + `HTMLAudioElement` (call audio only) |
| Microphone Input | `navigator.mediaDevices.getUserMedia()` (MediaDevices API) |
| Microphone Permission Pre-Check | `navigator.permissions.query({ name: 'microphone' })` (Permissions API) on page load; falls back to `getUserMedia` probe if Permissions API unavailable; result displayed in `#micPermissionStatus` before dialing |
| Caller ID Name | User-defined free-text string stored in app state; submitted with outgoing call metadata; any words/characters the user enters will appear on the recipient's caller ID display |
| Call Duration Timer | `setInterval`-based elapsed time counter; starts on call connect, stops on call end; displays in `#callStatus` formatted as `MM:SS` (or `HH:MM:SS` for calls ≥ 1 hour) |
| Network Type Badge | `navigator.connection.type` / `effectiveType` read at call connect time and on `change` events; displayed in `#networkTypeIndicator` during active call; updates dynamically if network changes mid-call |
| Keyboard Input | `keydown` event listener on `document`; maps key values to `dialDigit()`, `clearDialed()`, `initiateCall()`, `endCall()` |
| Backspace Long-Press | `pointerdown`/`pointerup`/`pointercancel` (or `mousedown`/`touchstart` equivalents) event listeners on the Backspace button; `setTimeout` detects long-press threshold; short tap → `clearLastDigit()`, long hold → `clearDialed()` (full clear) |
| Connectivity Probe Retry | Exponential backoff scheduler in `app.js`; probe retries on failure with increasing delay intervals; backoff resets on successful probe or when `online` event fires |
| Connectivity Status Timestamps | Each connectivity status change (online, offline, probe success, probe failure) is timestamped using `Date` and displayed in the connectivity panel UI |
| Theme Persistence | `localStorage` key (e.g., `darkTheme` or `theme`) stores the user's theme preference; read on page load to restore state; written on every theme toggle |
| Typography | System/sans-serif fonts only — no decorative, Old English, blackletter, or display fonts used anywhere in the app |
| Android Packaging | Android WebView wrapper (WebView-based native Android app) |
| Runtime | Browser (standalone) + Android WebView (mobile deployment) |

---

## Repository Structure

```
clockstopper/
├── Index.html          # Entry point — main HTML shell
├── Css/
│   └── Style.css       # Global styles, responsive layout, dark theme, connectivity panel, call UI, dialer UI, mobile network UI, caller ID name UI, call duration timer display, mic permission pre-check UI states, network type badge styles, connectivity status timestamp display styles
├── js/
│   └── app.js          # All application logic, theme toggle, mute toggle, connectivity detection, connectivity probe with exponential backoff retry and status timestamps, mobile network selection, call audio, dialer, caller ID name, keyboard input handling, call duration timer, mic permission pre-check, network type badge logic, backspace long-press clear logic, dark theme localStorage persistence
├── README.md           # Project documentation
└── .gitignore          # Android/IntelliJ artifacts excluded
```

> **Note:** The `.gitignore` file contains Android/Gradle/IntelliJ patterns. The repository has been used as the basis for an Android WebView application, so these entries are directly relevant to the Android packaging layer as well as any IntelliJ/Android Studio IDE artifacts.

---

## Android Deployment

The application has been packaged as an **Android WebView-based mobile dialing app**. Key architectural decisions for Android deployment:

- The web app (`Index.html`, `Css/Style.css`, `js/app.js`) serves as the UI layer loaded inside an Android `WebView`.
- The Android wrapper grants necessary permissions (microphone, network state) via the Android manifest, complementing the browser-level `getUserMedia()` permission requests.
- The dialer UI, keypad, connectivity panel, call audio system, caller ID name input, call duration timer, microphone permission pre-check, network type badge, and backspace long-press clear are all functional within the Android WebView environment.
- Mobile-specific CSS breakpoints and touch-friendly keypad sizing ensure a native-feeling experience on Android screen sizes.
- The `.gitignore` Android/Gradle/IntelliJ entries are intentional and directly applicable to the Android project artifacts generated during packaging.
- Keyboard input support is compatible with Android WebView's software keyboard — physical keyboard events and soft keyboard input events both dispatch `keydown` events that the dialer listener handles.
- The microphone permission pre-check is particularly important in the Android WebView context, where mic permissions must be granted both at the Android manifest level and at the browser/WebView level; the pre-check UI surfaces which layer is blocking access if mic is unavailable.
- The network type badge reads `navigator.connection` data which is available in Android WebView when the `ACCESS_NETWORK_STATE` permission is granted in the Android manifest.
- The backspace long-press uses pointer/touch events which are natively supported in Android WebView; the implementation avoids context menu triggers on long-press by calling `preventDefault()` where appropriate.
- The connectivity probe with exponential backoff is compatible with Android WebView's network stack; probe fetch requests respect the WebView's network permissions and connectivity state.
- **`localStorage` is available in Android WebView** and the dark theme preference persisted via `localStorage` works correctly across WebView sessions; no special WebView configuration is required for `localStorage` access in this context.

---

## Fixed Time Zones

The application displays **exactly three clocks**, hardcoded in `app.js`. There is no user-facing add/remove clock functionality.

| Clock Label | IANA Time Zone |
|---|---|
| Eastern Time | `America/New_York` |
| Central Time | `America/Chicago` |
| Western Time | `America/Los_Angeles` |

These are rendered on page load and cannot be changed by the user at runtime. The `addTimezone()` / `removeTimezone()` functions and the `#tzInput` text input have been **removed** from the application.

---

## Visual Style Conventions

- **No neon lighting effects.** All neon glow, neon `text-shadow`, neon `box-shadow` glow, neon border-glow, and neon color palette entries have been removed from `Style.css` and `app.js`. This was an explicit cleanup task and must not be reintroduced.
- **No decorative header or Old English font.** The application header element and any Old English, blackletter, or decorative display font (`MedievalSharp`, `UnifrakturMaguntia`, `Old English Text MT`, or similar) have been removed from `Index.html` and `Style.css`. These must not be reintroduced. Headings and labels use the standard system/sans-serif typeface.
- **Dark theme** uses a clean, flat dark background with **orange accent** colors on keypad buttons and interactive controls only.
- Buttons and interactive elements use solid, flat styling — no glow, bloom, or luminescence effects.
- Clock card and panel borders use subtle, non-glowing contrast to separate sections.
- Microphone permission pre-check status indicators use color-coded flat styling (e.g., green for granted, yellow/amber for prompt, red for denied) consistent with the dark theme — no neon or glow effects on these indicators.
- The **network type badge** (`#networkTypeIndicator`) uses flat, color-coded badge styling consistent with the dark theme — no glow or neon effects. Badge color or label varies by network type (e.g., WiFi, 4G, 3G, 2G, Cellular, Unknown) and is visible only during an active call.
- **Connectivity status timestamps** in the connectivity panel use flat, muted text styling (e.g., smaller font size, subdued color) consistent with the dark theme — no decorative or neon styling on timestamp text.
- **Typography is strictly utilitarian** — only system fonts or a clean sans-serif stack are used. No Google Fonts, web font imports, or decorative typefaces of any kind are permitted.

---

## Theme Persistence via localStorage

The user's dark/light theme preference is **persisted across sessions** using the browser's `localStorage` API.

### Implementation Details

- A **`localStorage` key** (e.g., `darkTheme` or `theme`) stores the current theme preference as a string value (e.g., `'true'`/`'false'`, or `'dark'`/`'light'`).
- On **page load**, `app.js` reads the stored key from `localStorage` and applies the appropriate CSS class to the document (e.g., adds or removes the dark theme class) before the first render, preventing a flash of unstyled/wrong-theme content.
- On **every theme toggle**, `app.js` writes the new preference to `localStorage` immediately after updating the DOM class, keeping the stored value always in sync with the current state.
- If no value is stored in `localStorage` (first visit or cleared storage), the app falls back to a defined **default theme** (dark or light as specified by the implementation).
- The `localStorage` read/write is handled within the theme toggle logic in `app.js` — no separate persistence module is introduced.
- This pattern is consistent with the app's general approach of using native browser APIs for all state management, with no external libraries or build tools.

---

## Connectivity Probe with Retry Backoff and Status Timestamps

The fetch-based connectivity probe has been enhanced with **exponential backoff retry logic** and **status timestamps** displayed in the connectivity panel.

### Exponential Backoff Retry

Key implementation details:
- When a connectivity probe fetch fails (network error or non-2xx response), the probe is **not retried immediately** — instead it schedules a retry after an increasing delay.
- **Backoff schedule** is defined as a constant array or formula in `app.js` (e.g., initial delay 2s, doubling on each failure up to a defined maximum such as 60s).
- A **maximum retry delay cap** prevents unbounded wait times between probes.
- The backoff state (current delay, retry timeout handle) is managed as module-level variables in `app.js` and is reset when:
  - A probe succeeds.
  - The browser `online` event fires (indicating connectivity restored), which triggers an immediate re-probe rather than waiting for the next backoff interval.
- The `offline` browser event cancels any pending retry timeout and marks connectivity as offline immediately without waiting for the next probe.
- All retry scheduling uses `setTimeout`; no external scheduler libraries are used.

### Status Timestamps

Key implementation details:
- Every connectivity **status change event** — online, offline, probe success, probe failure — records a timestamp using `new Date()` (or `Date.now()`) at the moment the status changes.
- Timestamps are **formatted for display** (e.g., `HH:MM:SS` local time, or a short date+time string) and rendered into a designated element in the connectivity panel UI (e.g., a `#connectivityTimestamp` or inline within the status label).
- The timestamp reflects the **last status change**, not a continuously updating clock — it is updated only when status transitions occur.
- Timestamp display styling uses flat, muted text consistent with the dark theme (smaller font, subdued color) — no special decoration.
- In `Index.html`, the connectivity panel includes a timestamp display element updated by `app.js` on each status change.
- Timestamps are stored in `app.js` app-level state alongside connectivity status and are cleared/reset on page load.

---

## Backspace Button Long-Press to Clear

The Backspace button on the dialer keypad supports two distinct behaviors based on press duration:

- **Short tap (default):** Removes the last entered digit from the dialed number string — equivalent to a single `clearLastDigit()` operation.
- **Long press (hold):**