# Project Context Document: Global Time Clock (clockstopper)

## Project Overview

**Global Time Clock** is a lightweight, client-side web application that displays three fixed world clocks: **Eastern Time**, **Central Time**, and **Western (Pacific) Time**. It is a pure frontend application with no backend dependencies, build tools, or frameworks — designed to run directly in a browser by opening `Index.html`.

The app updates all displayed clocks every second. The three time zone clocks are **fixed and hardcoded** — users cannot add or remove clocks. A **dark theme with orange accent keypad/controls** is supported via a CSS class toggle. A **mute button** allows users to silence any audio alerts without removing clocks. There are **no alarm, ticking, or audio clock sounds** — the clocks are purely digital display only. There are **no neon lighting effects on general UI elements** — all general neon glow, neon text-shadow, neon border-glow, and neon color effects have been removed from the CSS and JS for most UI elements; the visual style uses clean, flat dark theme styling with orange accents only. There is **no decorative header or Old English / blackletter font** — the application header and any Old English, blackletter, or decorative serif display fonts have been removed from the UI; headings and labels use the standard flat dark-theme typeface consistent with the rest of the app.

The **dialpad has a 80% clear glass visual style** — the keypad/dialpad area uses a translucent glass effect (semi-transparent background, subtle border, backdrop blur) giving keys a frosted glass appearance. A **bright dark-red neon glow lighting effect** is displayed beneath the phone keypad as an ambient under-glow — this neon effect is active by default and provides a bright dark-red neon color glow underneath and around the dialpad area. When the **mute button is activated**, the dark-red neon under-glow effect beneath the keypad **turns off**, providing a clear visual indicator that mute is engaged; when mute is deactivated, the neon glow restores. This mute-state neon feedback is implemented via a CSS class toggled on the dialpad/keypad container by the mute button logic in `app.js`, and the neon glow is defined in `Style.css` using `box-shadow` and/or `filter` with dark-red (`#8b0000` / `#c00020` range) neon color values.

An **enhanced connectivity panel** displays WiFi/network status, detects available networks, and allows network selection — all using native browser APIs where possible, supplemented by a fetch-based connectivity probe with **exponential backoff retry logic** and **status timestamps**. A **mobile network option** is supported within the connectivity panel, allowing the user to select and use a mobile/cellular network connection when available; the app detects and surfaces mobile network types (e.g., `cellular`, `4g`, `3g`, `2g`) via the `NetworkInformation` API and allows the user to prefer mobile network for call audio routing. An **outgoing call audio system** provides call audio output and requests microphone permissions using the native browser MediaDevices API, with call audio routed through the **currently selected network** (WiFi or mobile). A **microphone permission pre-check UI** proactively checks and displays the microphone permission state before the user attempts to dial, surfacing any permission issues (denied, prompt, granted) in `#micPermissionStatus` with appropriate visual indicators and guidance — this pre-check runs on page load and updates the UI state so users are informed of mic access status before attempting a call. A **dialer UI** displays the number being dialed with a dedicated number display box above the keypad and a live "number being dialed" readout beneath it, updating as digits are entered. A **caller ID name feature** allows the user to set a custom display name — any words or text the user chooses — that appears on the recipient's caller ID instead of the caller's phone number. The user enters and saves a custom caller ID name string which is used when placing outgoing calls; the saved name is what the recipient will see on their caller ID display. **Physical and virtual keyboard input** is supported for the dialer — users can type digits, `*`, `#`, `+`, and control keys (`Backspace`, `Enter`, `Escape`) directly from a hardware keyboard or software keyboard, with the dialer responding identically to keypad button taps. A **call duration timer** is displayed in `#callStatus` during an active call, showing a live elapsed time counter (formatted as `MM:SS` or `HH:MM:SS`) that starts when the call connects and stops when the call ends. A **network type badge** is displayed in `#networkTypeIndicator` during an active call, showing the current network type (e.g., WiFi, 4G, 3G, 2G, Cellular, or Unknown) so the user can see at a glance which network is carrying the active call. The **Backspace button supports long-press to clear** — tapping Backspace removes the last dialed digit, while pressing and holding Backspace for a defined duration (long-press threshold) clears the entire dialed number at once, providing a fast erase shortcut for mobile users. The **dark theme preference is persisted via `localStorage`** — the user's last chosen theme (dark or light) is saved to `localStorage` on each toggle and restored on page load, so the preferred theme is retained across sessions and page reloads. A **call volume indicator** is displayed during an active call, showing the current call/media volume level as a visual indicator that updates in real time when the user presses the device's hardware volume up/down buttons. A **microphone mute button** is displayed during an active call, allowing the user to mute and unmute their microphone mid-call without ending the call — muting stops the local audio track from being transmitted while keeping the call connected; the mute state is reflected visually on the button (e.g., toggled appearance or label change) and the mic track's `enabled` property is toggled on the active `MediaStream` track.

The application has been **constructed as a mobile dialing app targeting Android devices**, with all features implemented and packaged for Android deployment. The web app source serves as the UI layer within an Android WebView-based wrapper, making the dialer fully functional as a native-feeling Android application.

A **feature test suite** has been defined and implemented, providing structured automated and manual test coverage for all major application features.

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
| Microphone Mute (Mid-Call) | `MediaStreamTrack.enabled = false/true` on the active audio track of the live `MediaStream`; toggled by in-call mute button; mute state reflected visually on button; does not end the call |
| Microphone Permission Pre-Check | `navigator.permissions.query({ name: 'microphone' })` (Permissions API) on page load; falls back to `getUserMedia` probe if Permissions API unavailable; result displayed in `#micPermissionStatus` before dialing |
| Caller ID Name | User-defined free-text string stored in app state; submitted with outgoing call metadata; any words/characters the user enters will appear on the recipient's caller ID display |
| Call Duration Timer | `setInterval`-based elapsed time counter; starts on call connect, stops on call end; displays in `#callStatus` formatted as `MM:SS` (or `HH:MM:SS` for calls ≥ 1 hour) |
| Network Type Badge | `navigator.connection.type` / `effectiveType` read at call connect time and on `change` events; displayed in `#networkTypeIndicator` during active call; updates dynamically if network changes mid-call |
| Call Volume Indicator | Hardware volume key events (`keydown` for `VolumeUp`/`VolumeDown` on Android WebView, or equivalent media key events); current volume level read from `HTMLAudioElement.volume` or `AudioContext` gain; displayed as a visual indicator in the call UI during an active call; updates in real time as hardware volume buttons are pressed |
| Keyboard Input | `keydown` event listener on `document`; maps key values to `dialDigit()`, `clearDialed()`, `initiateCall()`, `endCall()` |
| Backspace Long-Press | `pointerdown`/`pointerup`/`pointercancel` (or `mousedown`/`touchstart` equivalents) event listeners on the Backspace button; `setTimeout` detects long-press threshold; short tap → `clearLastDigit()`, long hold → `clearDialed()` (full clear) |
| Connectivity Probe Retry | Exponential backoff scheduler in `app.js`; probe retries on failure with increasing delay intervals; backoff resets on successful probe or when `online` event fires |
| Connectivity Status Timestamps | Each connectivity status change (online, offline, probe success, probe failure) is timestamped using `Date` and displayed in the connectivity panel UI |
| Theme Persistence | `localStorage` key (e.g., `darkTheme` or `theme`) stores the user's theme preference; read on page load to restore state; written on every theme toggle |
| Dialpad Glass Effect | CSS `backdrop-filter: blur()`, semi-transparent `background` (`rgba` with ~80% transparency), and subtle `border` on the keypad container produce a frosted/clear glass visual for the dialpad keys |
| Dialpad Neon Under-Glow | CSS `box-shadow` and/or `filter` on the dialpad container using dark-red neon color values (`#8b0000`–`#c00020` range); glow is active by default; a CSS class toggled by mute button logic in `app.js` removes/suppresses the glow when mute is active, restores it when mute is off |
| Typography | System/sans-serif fonts only — no decorative, Old English, blackletter, or display fonts used anywhere in the app |
| Android Packaging | Android WebView wrapper (WebView-based native Android app) |
| Runtime | Browser (standalone) + Android WebView (mobile deployment) |
| Test Suite | Vanilla JS test runner (`tests/runner.js`) + feature test files (`tests/features/`) — no external test framework dependency |

---

## Repository Structure

```
clockstopper/
├── Index.html          # Entry point — main HTML shell
├── Css/
│   └── Style.css       # Global styles, responsive layout, dark theme, connectivity panel, call UI, dialer UI, mobile network UI, caller ID name UI, call duration timer display, mic permission pre-check UI states, network type badge styles, connectivity status timestamp display styles, call volume indicator styles, mic mute button styles (active/muted state visual toggle), dialpad glass effect (backdrop-filter/rgba), dialpad dark-red neon under-glow (box-shadow/filter), mute-active neon-off CSS class
├── js/
│   └── app.js          # All application logic, theme toggle, mute toggle (including neon glow class toggle on dialpad container), connectivity detection, connectivity probe with exponential backoff retry and status timestamps, mobile network selection, call audio, dialer, caller ID name, keyboard input handling, call duration timer, mic permission pre-check, network type badge logic, backspace long-press clear logic, dark theme localStorage persistence, call volume indicator logic, mic mute (mid-call) toggle logic
├── tests/
│   ├── runner.js        # Vanilla JS test runner — discovers and executes all feature test files, reports pass/fail counts, requires no external framework
│   ├── runner.html      # Browser-based test harness page — loads runner.js and all test files, displays results in-browser
│   └── features/        # Per-feature test files, one file per major app feature
│       ├── clocks.test.js              # Time zone clock display and update tests
│       ├── theme.test.js               # Dark/light theme toggle and localStorage persistence tests
│       ├── mute.test.js                # Mute button behavior tests (including neon glow on/off state)
│       ├── dialer.test.js              # Dialer digit entry, display, and keyboard input tests
│       ├── backspace.test.js           # Backspace short-tap and long-press clear tests
│       ├── callerIdName.test.js        # Caller ID name input and save tests
│       ├── callDurationTimer.test.js   # Call duration timer start/stop/format tests
│       ├── networkTypeBadge.test.js    # Network type badge display and update tests
│       ├── micPermission.test.js       # Microphone permission pre-check UI state tests
│       ├── connectivity.test.js        # Connectivity panel, probe, backoff, and timestamp tests
│       ├── mobileNetwork.test.js       # Mobile network detection and selection tests
│       ├── callVolume.test.js          # Call volume indicator display and hardware key tests
│       ├── callAudio.test.js           # Outgoing call audio routing and MediaDevices API tests
│       └── micMute.test.js             # Mic mute button toggle, track enabled state, and in-call mute UI tests
├── README.md           # Project documentation
└── .gitignore          # Web-project-appropriate ignore rules (see .gitignore conventions below)
```

> **Note:** The `.gitignore` file has been updated to contain **web-project-appropriate rules** rather than Android/Gradle/IntelliJ patterns. Since the web app source is the primary repository content and Android packaging is a separate concern, the `.gitignore` now targets artifacts relevant to the web layer (e.g., OS metadata files, editor/IDE config, browser test artifacts) rather than Android build outputs. Any Android/Gradle/IntelliJ exclusion patterns belong in the Android wrapper project's own `.gitignore`, not in this web source repository.

> **Test suite note:** The `tests/` directory and all contents are part of the web app source layer and are committed to the repository. Tests are run in-browser via `tests/runner.html` or by executing `runner.js` in a compatible JS environment. No Node.js, npm, or build toolchain is required to run the test suite.

---

## Dialpad Glass & Neon Glow Design Conventions

The dialpad visual treatment follows two layered effects:

### Glass Dialpad
- The keypad container and individual key buttons use an **~80% clear/transparent glass style**: `background: rgba(255,255,255,0.08)` (or equivalent dark-glass tone), `backdrop-filter: blur(Npx)`, and a thin `border: 1px solid rgba(255,255,255,0.15)` or similar to achieve a frosted glass appearance.
- Keys remain legible against the dark background while the glass effect gives depth and a premium mobile UI feel.

### Dark-Red Neon Under-Glow
- A **bright dark-red neon glow** effect is rendered beneath/around the dialpad container using CSS `box-shadow` with spread and blur values, and/or `filter: drop-shadow()`, using colors in the `#8b0000`–`#c00020` range (dark red neon).
- The glow is **active by default** whenever the dialer is displayed.
- When the **mute button is toggled on**, `app.js` adds a CSS class (e.g., `.muted` or `.neon-off`) to the dialpad container. This class sets `box-shadow: none` (or overrides the neon shadow to transparent/zero), turning off the red neon glow as a visual mute indicator.
- When mute is toggled off, the class is removed and the glow restores.
- This pattern means **mute state has two visual signals**: the mute button's own appearance change, and the dialpad neon glow extinguishing.

---

## .gitignore Conventions

The `.gitignore` is maintained as a **web-project-appropriate** ignore file. Key conventions:

- **Included (ignored):** OS metadata files (`.DS_Store`, `Thumbs.db`), editor/IDE configs (`.vscode/`, `.idea/`), temporary files, local environment overrides, and any browser test output artifacts.
- **Excluded from ignore rules:** Android build outputs, Gradle caches, IntelliJ Android Studio artifacts — these belong in the Android wrapper project's own `.gitignore`, not here.
- The `.gitignore` should not reference Android, Gradle,