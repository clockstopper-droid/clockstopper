# Project Context Document: Global Time Clock (clockstopper)

## Project Overview

**Global Time Clock** is a lightweight, client-side web application that displays three fixed world clocks: **Eastern Time**, **Central Time**, and **Western (Pacific) Time**. It is a pure frontend application with no backend dependencies, build tools, or frameworks — designed to run directly in a browser by opening `Index.html`.

The app updates all displayed clocks every second. The three time zone clocks are **fixed and hardcoded** — users cannot add or remove clocks. A **dark theme with orange accent keypad/controls** is supported via a CSS class toggle. A **mute button** allows users to silence any audio alerts without removing clocks. There are **no alarm, ticking, or audio clock sounds** — the clocks are purely digital display only. There are **no neon lighting effects** — all neon glow, neon text-shadow, neon border-glow, and neon color effects have been removed from the CSS and JS; the visual style uses clean, flat dark theme styling with orange accents only. An **enhanced connectivity panel** displays WiFi/network status, detects available networks, and allows network selection — all using native browser APIs where possible, supplemented by a fetch-based connectivity probe. A **mobile network option** is supported within the connectivity panel, allowing the user to select and use a mobile/cellular network connection when available; the app detects and surfaces mobile network types (e.g., `cellular`, `4g`, `3g`, `2g`) via the `NetworkInformation` API and allows the user to prefer mobile network for call audio routing. An **outgoing call audio system** provides call audio output and requests microphone permissions using the native browser MediaDevices API, with call audio routed through the **currently selected network** (WiFi or mobile). A **microphone permission pre-check UI** proactively checks and displays the microphone permission state before the user attempts to dial, surfacing any permission issues (denied, prompt, granted) in `#micPermissionStatus` with appropriate visual indicators and guidance — this pre-check runs on page load and updates the UI state so users are informed of mic access status before attempting a call. A **dialer UI** displays the number being dialed with a dedicated number display box above the keypad and a live "number being dialed" readout beneath it, updating as digits are entered. A **caller ID name feature** allows the user to set a custom display name — any words or text the user chooses — that appears on the recipient's caller ID instead of the caller's phone number. The user enters and saves a custom caller ID name string which is used when placing outgoing calls; the saved name is what the recipient will see on their caller ID display. **Physical and virtual keyboard input** is supported for the dialer — users can type digits, `*`, `#`, `+`, and control keys (`Backspace`, `Enter`, `Escape`) directly from a hardware keyboard or software keyboard, with the dialer responding identically to keypad button taps. A **call duration timer** is displayed in `#callStatus` during an active call, showing a live elapsed time counter (formatted as `MM:SS` or `HH:MM:SS`) that starts when the call connects and stops when the call ends. A **network type badge** is displayed in `#networkTypeIndicator` during an active call, showing the current network type (e.g., WiFi, 4G, 3G, 2G, Cellular, or Unknown) so the user can see at a glance which network is carrying the active call.

The application has been **constructed as a mobile dialing app targeting Android devices**, with all features implemented and packaged for Android deployment. The web app source serves as the UI layer within an Android WebView-based wrapper, making the dialer fully functional as a native-feeling Android application.

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
| Mobile Network Detection | `navigator.connection.type === 'cellular'` + `effectiveType` (`4g`, `3g`, `2g`) checks |
| Audio Output | Native Web Audio API (`AudioContext`) + `HTMLAudioElement` (call audio only) |
| Microphone Input | `navigator.mediaDevices.getUserMedia()` (MediaDevices API) |
| Microphone Permission Pre-Check | `navigator.permissions.query({ name: 'microphone' })` (Permissions API) on page load; falls back to `getUserMedia` probe if Permissions API unavailable; result displayed in `#micPermissionStatus` before dialing |
| Caller ID Name | User-defined free-text string stored in app state; submitted with outgoing call metadata; any words/characters the user enters will appear on the recipient's caller ID display |
| Call Duration Timer | `setInterval`-based elapsed time counter; starts on call connect, stops on call end; displays in `#callStatus` formatted as `MM:SS` (or `HH:MM:SS` for calls ≥ 1 hour) |
| Network Type Badge | `navigator.connection.type` / `effectiveType` read at call connect time and on `change` events; displayed in `#networkTypeIndicator` during active call; updates dynamically if network changes mid-call |
| Keyboard Input | `keydown` event listener on `document`; maps key values to `dialDigit()`, `clearDialed()`, `initiateCall()`, `endCall()` |
| Android Packaging | Android WebView wrapper (WebView-based native Android app) |
| Runtime | Browser (standalone) + Android WebView (mobile deployment) |

---

## Repository Structure

```
clockstopper/
├── Index.html          # Entry point — main HTML shell
├── Css/
│   └── Style.css       # Global styles, responsive layout, dark theme, connectivity panel, call UI, dialer UI, mobile network UI, caller ID name UI, call duration timer display, mic permission pre-check UI states, network type badge styles
├── js/
│   └── app.js          # All application logic, theme toggle, mute toggle, connectivity detection, mobile network selection, call audio, dialer, caller ID name, keyboard input handling, call duration timer, mic permission pre-check, network type badge logic
├── README.md           # Project documentation
└── .gitignore          # Android/IntelliJ artifacts excluded
```

> **Note:** The `.gitignore` file contains Android/Gradle/IntelliJ patterns. The repository has been used as the basis for an Android WebView application, so these entries are directly relevant to the Android packaging layer as well as any IntelliJ/Android Studio IDE artifacts.

---

## Android Deployment

The application has been packaged as an **Android WebView-based mobile dialing app**. Key architectural decisions for Android deployment:

- The web app (`Index.html`, `Css/Style.css`, `js/app.js`) serves as the UI layer loaded inside an Android `WebView`.
- The Android wrapper grants necessary permissions (microphone, network state) via the Android manifest, complementing the browser-level `getUserMedia()` permission requests.
- The dialer UI, keypad, connectivity panel, call audio system, caller ID name input, call duration timer, microphone permission pre-check, and network type badge are all functional within the Android WebView environment.
- Mobile-specific CSS breakpoints and touch-friendly keypad sizing ensure a native-feeling experience on Android screen sizes.
- The `.gitignore` Android/Gradle/IntelliJ entries are intentional and directly applicable to the Android project artifacts generated during packaging.
- Keyboard input support is compatible with Android WebView's software keyboard — physical keyboard events and soft keyboard input events both dispatch `keydown` events that the dialer listener handles.
- The microphone permission pre-check is particularly important in the Android WebView context, where mic permissions must be granted both at the Android manifest level and at the browser/WebView level; the pre-check UI surfaces which layer is blocking access if mic is unavailable.
- The network type badge reads `navigator.connection` data which is available in Android WebView when the `ACCESS_NETWORK_STATE` permission is granted in the Android manifest.

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
- **Dark theme** uses a clean, flat dark background with **orange accent** colors on keypad buttons and interactive controls only.
- Buttons and interactive elements use solid, flat styling — no glow, bloom, or luminescence effects.
- Clock card and panel borders use subtle, non-glowing contrast to separate sections.
- Microphone permission pre-check status indicators use color-coded flat styling (e.g., green for granted, yellow/amber for prompt, red for denied) consistent with the dark theme — no neon or glow effects on these indicators.
- The **network type badge** (`#networkTypeIndicator`) uses flat, color-coded badge styling consistent with the dark theme — no glow or neon effects. Badge color or label varies by network type (e.g., WiFi, 4G, 3G, 2G, Cellular, Unknown) and is visible only during an active call.

---

## Network Type Badge

During an active call, a **network type badge** is displayed in `#networkTypeIndicator` to inform the user which network type is currently carrying the call.

Key implementation details:
- The badge is shown when a call is active and hidden when no call is in progress.
- **Network type is determined** by reading `navigator.connection.type` and/or `navigator.connection.effectiveType` at call connect time via the `NetworkInformation` API.
- **Displayed labels and mapping:**
  | `connection.type` / `effectiveType` | Badge Label |
  |---|---|
  | `wifi` | WiFi |
  | `cellular` + `effectiveType: '4g'` | 4G |
  | `cellular` + `effectiveType: '3g'` | 3G |
  | `cellular` + `effectiveType: '2g'` | 2G |
  | `cellular` (no/unknown effectiveType) | Cellular |
  | API unavailable or `unknown` | Unknown |
- **Dynamic updates:** A `change` event listener on `navigator.connection` updates the badge if the network type changes while a call is active (e.g., WiFi drops and falls back to cellular mid-call).
- **Graceful degradation:** If `navigator.connection` is not available in the current browser/WebView, the badge displays "Unknown" and does not error.
- The badge element (`#networkTypeIndicator`) is defined in `Index.html` within the `#callPanel` area and styled in `Style.css` using flat, badge-style CSS consistent with the dark theme and orange accent palette.
- Badge visibility is toggled in `app.js` alongside call state transitions — shown in `initiateCall()` on connect, hidden in `endCall()`.
- The network type badge state and its `change` event listener are managed in `app.js` app-level state; the listener is added on call start and removed on call end to avoid stale listeners accumulating.

---

## Microphone Permission Pre-Check

The application proactively checks microphone permission state on page load and surfaces the result in `#micPermissionStatus` **before** the user attempts to dial. This ensures users are aware of mic access issues before initiating a call.

Key implementation details:
- **Primary method:** `navigator.permissions.query({ name: 'microphone' })` is called on page load via `checkMicPermission()` in `app.js`. This is non-intrusive and does not trigger a permission prompt.
- **Fallback method:** If the Permissions API is unavailable (e.g., older Android WebView versions), a passive `getUserMedia` probe is attempted to determine actual mic access state.
- **Permission states handled:**
  - `granted` — mic is available; `#micPermissionStatus` shows a positive/green indicator; dialing is unblocked.
  - `prompt` — mic permission has not been decided yet; `#micPermissionStatus` shows an informational/amber indicator advising the user that they will be prompted when a call is initiated.
  - `denied` — mic access is blocked; `#micPermissionStatus` shows a warning/red indicator with guidance on how to re-enable mic access in device settings.
- **Permission change listener:** A `permissionchange` event listener is attached to the `PermissionStatus` object returned by `navigator.permissions.query()` so that `#micPermissionStatus` updates dynamically if the user changes mic permission in device settings while the app is open.
- **`#micPermissionStatus` element** displays human-readable status text and a visual state indicator; the text and styling update reactively to reflect the current permission state.
- **Dialer guard:** When `initiateCall()` is invoked and mic permission is `denied`, the call is blocked and `#micPermissionStatus` (or `#callStatus`) surfaces an actionable error rather than silently failing.
- The pre-check and its UI state are initialized in `app.js` as part of the page load setup sequence, after DOM elements are available.
- This feature is purely additive — it does not change the behavior of `getUserMedia()` calls made during actual call initiation; it only provides earlier, more informative feedback to the user.

---

## Caller ID Name Feature

The application allows the user to set a **custom caller ID name** — any words or text of their choosing — that will appear on the recipient's caller ID display instead of the caller's raw phone number.

Key implementation details:
- A dedicated **caller ID name input field** (`#callerIdNameInput`) allows the user to type any free-text string (words, a business name, a personal name, etc.).
- A **save/set button** (`#setCallerIdNameBtn`) commits the entered name to the `callerIdName` state variable in `app.js`.
- The saved `callerIdName` string is used when `initiateCall()` is invoked, submitting the name as the caller identity for outgoing calls — **this is the text the recipient will see on their caller ID**.
- A **caller ID name display** (`#callerIdNameDisplay`) shows the currently active caller ID name so the user can confirm what recipients will see.
- The caller ID name is stored in app-level JavaScript state (not persisted to `localStorage` or any backend) — it resets on page reload.
- If no caller ID name is set, outgoing calls fall back to default behavior (number display or system default).
- There is no character restriction enforced on the caller ID name input — the user may enter any words or characters they wish to display to recipients.

---

## Call Duration Timer

During an active call, a **live elapsed time counter** is displayed in `#callStatus` to show the user how long the current call has been in progress.

Key implementation details:
- The timer starts when `initiateCall()` successfully connects a call, recording the call start time (via `Date.now()` or equivalent).
- A `setInterval` (1000ms cadence) calculates elapsed seconds and updates `#callStatus` with the formatted duration string.
- **Format:** `MM:SS` for calls under one hour; `HH:MM:SS` for calls of one hour or longer.
- The timer interval is **cleared and reset** when `endCall()` is invoked, stopping the counter at the final elapsed time before the call UI resets.
- The duration counter state (interval reference and start timestamp) is managed in `app.js` app-level state alongside the existing call state variables.
- The timer display coexists with other call status text (e.g., call connected label) within `#callStatus` — the elapsed time is shown as part of or alongside the call status string.
- The timer does **not** persist across page reloads — it is purely runtime state.

---

## Keyboard Input Support

The dialer supports **physical keyboard and software keyboard input** in addition to on-screen keypad button taps. This is implemented via a single `keydown` event listener attached to `document` in `app.js`.

Key mapping conventions:
| Key | Action |
|---|---|
| `0`–`9` | `dialDigit(key)` — appends digit to dialed number |
| `*` | `dialDigit('*')` — appends star character |
| `