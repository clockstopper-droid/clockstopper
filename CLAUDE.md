# Project Context Document: Global Time Clock (clockstopper)

## Project Overview

**Global Time Clock** is a lightweight, client-side web application that displays three fixed world clocks: **Eastern Time**, **Central Time**, and **Western (Pacific) Time**. It is a pure frontend application with no backend dependencies, build tools, or frameworks — designed to run directly in a browser by opening `Index.html`.

The app updates all displayed clocks every second. The three time zone clocks are **fixed and hardcoded** — users cannot add or remove clocks. A **dark theme with orange accent keypad/controls** is supported via a CSS class toggle. A **mute button** allows users to silence any audio alerts without removing clocks. There are **no alarm, ticking, or audio clock sounds** — the clocks are purely digital display only. There are **no neon lighting effects** — all neon glow, neon text-shadow, neon border-glow, and neon color effects have been removed from the CSS and JS; the visual style uses clean, flat dark theme styling with orange accents only. There is **no decorative header or Old English / blackletter font** — the application header and any Old English, blackletter, or decorative serif display fonts have been removed from the UI; headings and labels use the standard flat dark-theme typeface consistent with the rest of the app. An **enhanced connectivity panel** displays WiFi/network status, detects available networks, and allows network selection — all using native browser APIs where possible, supplemented by a fetch-based connectivity probe with **exponential backoff retry logic** and **status timestamps**. A **mobile network option** is supported within the connectivity panel, allowing the user to select and use a mobile/cellular network connection when available; the app detects and surfaces mobile network types (e.g., `cellular`, `4g`, `3g`, `2g`) via the `NetworkInformation` API and allows the user to prefer mobile network for call audio routing. An **outgoing call audio system** provides call audio output and requests microphone permissions using the native browser MediaDevices API, with call audio routed through the **currently selected network** (WiFi or mobile). A **microphone permission pre-check UI** proactively checks and displays the microphone permission state before the user attempts to dial, surfacing any permission issues (denied, prompt, granted) in `#micPermissionStatus` with appropriate visual indicators and guidance — this pre-check runs on page load and updates the UI state so users are informed of mic access status before attempting a call. A **dialer UI** displays the number being dialed with a dedicated number display box above the keypad and a live "number being dialed" readout beneath it, updating as digits are entered. A **caller ID name feature** allows the user to set a custom display name — any words or text the user chooses — that appears on the recipient's caller ID instead of the caller's phone number. The user enters and saves a custom caller ID name string which is used when placing outgoing calls; the saved name is what the recipient will see on their caller ID display. **Physical and virtual keyboard input** is supported for the dialer — users can type digits, `*`, `#`, `+`, and control keys (`Backspace`, `Enter`, `Escape`) directly from a hardware keyboard or software keyboard, with the dialer responding identically to keypad button taps. A **call duration timer** is displayed in `#callStatus` during an active call, showing a live elapsed time counter (formatted as `MM:SS` or `HH:MM:SS`) that starts when the call connects and stops when the call ends. A **network type badge** is displayed in `#networkTypeIndicator` during an active call, showing the current network type (e.g., WiFi, 4G, 3G, 2G, Cellular, or Unknown) so the user can see at a glance which network is carrying the active call. The **Backspace button supports long-press to clear** — tapping Backspace removes the last dialed digit, while pressing and holding Backspace for a defined duration (long-press threshold) clears the entire dialed number at once, providing a fast erase shortcut for mobile users. The **dark theme preference is persisted via `localStorage`** — the user's last chosen theme (dark or light) is saved to `localStorage` on each toggle and restored on page load, so the preferred theme is retained across sessions and page reloads. A **call volume indicator** is displayed during an active call, showing the current call/media volume level as a visual indicator that updates in real time when the user presses the device's hardware volume up/down buttons.

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
│   └── Style.css       # Global styles, responsive layout, dark theme, connectivity panel, call UI, dialer UI, mobile network UI, caller ID name UI, call duration timer display, mic permission pre-check UI states, network type badge styles, connectivity status timestamp display styles, call volume indicator styles
├── js/
│   └── app.js          # All application logic, theme toggle, mute toggle, connectivity detection, connectivity probe with exponential backoff retry and status timestamps, mobile network selection, call audio, dialer, caller ID name, keyboard input handling, call duration timer, mic permission pre-check, network type badge logic, backspace long-press clear logic, dark theme localStorage persistence, call volume indicator logic
├── tests/
│   ├── runner.js        # Vanilla JS test runner — discovers and executes all feature test files, reports pass/fail counts, requires no external framework
│   ├── runner.html      # Browser-based test harness page — loads runner.js and all test files, displays results in-browser
│   └── features/        # Per-feature test files, one file per major app feature
│       ├── clocks.test.js              # Time zone clock display and update tests
│       ├── theme.test.js               # Dark/light theme toggle and localStorage persistence tests
│       ├── mute.test.js                # Mute button behavior tests
│       ├── dialer.test.js              # Dialer digit entry, display, and keyboard input tests
│       ├── backspace.test.js           # Backspace short-tap and long-press clear tests
│       ├── callerIdName.test.js        # Caller ID name input and save tests
│       ├── callDurationTimer.test.js   # Call duration timer start/stop/format tests
│       ├── networkTypeBadge.test.js    # Network type badge display and update tests
│       ├── micPermission.test.js       # Microphone permission pre-check UI state tests
│       ├── connectivity.test.js        # Connectivity panel, probe, backoff, and timestamp tests
│       ├── mobileNetwork.test.js       # Mobile network detection and selection tests
│       ├── callVolume.test.js          # Call volume indicator display and hardware key tests
│       └── callAudio.test.js           # Outgoing call audio routing and MediaDevices API tests
├── README.md           # Project documentation
└── .gitignore          # Android/IntelliJ artifacts excluded
```

> **Note:** The `.gitignore` file contains Android/Gradle/IntelliJ patterns. The repository has been used as the basis for an Android WebView application, so these entries are directly relevant to the Android packaging layer as well as any IntelliJ/Android Studio IDE artifacts.

> **Test suite note:** The `tests/` directory and all contents are part of the web app source layer and are committed to the repository. Tests are run in-browser via `tests/runner.html` or by executing `runner.js` in a compatible JS environment. No Node.js, npm, or build toolchain is required to run the test suite.

---

## Feature Test Suite

A structured test suite covering all major application features is located in `tests/`. The suite uses a **custom vanilla JS test runner** with no external framework dependencies, consistent with the project's no-build-tools philosophy.

### Test Runner (`tests/runner.js`)

- Discovers and runs all registered test files/suites.
- Reports per-suite and aggregate pass/fail/skip counts.
- Outputs results to the browser console and to the `tests/runner.html` page DOM.
- Supports synchronous and `async`/`Promise`-based test cases.
- Provides `describe()`, `it()`, `beforeEach()`, `afterEach()`, and `assert` helpers matching conventional test API shape.
- No dependency on Jasmine, Mocha, Jest, or any other external test framework.

### Test Harness (`tests/runner.html`)

- Standalone HTML page that loads `Index.html` content (or a minimal DOM stub) alongside the test runner and all feature test files.
- Can be opened directly in a browser — no server required.
- Displays pass/fail results inline in the page as well as in the browser console.
- Compatible with Android WebView for on-device test execution if needed.

### Feature Test Files (`tests/features/`)

Each file targets one application feature domain. Tests use DOM stubs/mocks for browser APIs that are unavailable in pure JS environments (e.g., `navigator.connection`, `navigator.mediaDevices`, `localStorage`). Key test patterns:

- **Clock tests** (`clocks.test.js`): Verify that three clock elements are rendered, that displayed time updates each second, and that correct IANA time zones are used.
- **Theme tests** (`theme.test.js`): Verify dark/light class toggle, `localStorage` read on load, `localStorage` write on toggle, and default theme fallback.
- **Mute tests** (`mute.test.js`): Verify mute button toggles muted state and that audio is suppressed when muted.
- **Dialer tests** (`dialer.test.js`): Verify digit entry updates display, keyboard input dispatches correctly, `*`/`#`/`+` are accepted, and `Escape` clears the dialed number.
- **Backspace tests** (`backspace.test.js`): Verify short tap removes last digit, long-press clears entire number, and `pointercancel` aborts long-press.
- **Caller ID name tests** (`callerIdName.test.js`): Verify name input is saved to state, displayed correctly, and submitted with call metadata.
- **Call duration timer tests** (`callDurationTimer.test.js`): Verify timer starts on call connect, increments each second, formats as `MM:SS` / `HH:MM:SS`, and stops on call end.
- **Network type badge tests** (`networkTypeBadge.test.js`): Verify badge shows correct label for each network type, is visible only during active call, and updates on network change events.
- **Mic permission tests** (`micPermission.test.js`): Verify pre-check runs on page load, correct status (`granted`/`prompt`/`denied`) is reflected in `#micPermissionStatus`, and fallback probe is triggered when Permissions API is unavailable.
- **Connectivity tests** (`connectivity.test.js`): Verify online/offline event handling, probe execution, exponential backoff delay progression, backoff reset on success, and status timestamp display.
- **Mobile network tests** (`mobileNetwork.test.js`): Verify cellular type detection, mobile network option display, and network preference selection.
- **Call volume tests** (`callVolume.test.js`): Verify indicator appears during call, reflects correct volume level, updates on `VolumeUp`/`VolumeDown` key events, and hides after call ends.
- **Call audio tests** (`callAudio.test.js`): Verify `getUserMedia()` is called on dial, audio is routed through selected network, and call state transitions correctly.

### Test Conventions

- All test files use the runner's `describe`/`it` API — no global test framework assumptions.
- Browser APIs unavailable in the test environment (`navigator.connection`, `navigator.mediaDevices`, `localStorage`, `AudioContext`) are **mocked/stubbed inline** within each test file's `beforeEach` or at module scope.
- Tests do **not** require a live network, microphone, or audio device — all external dependencies are stubbed.
- Test files are **read-only with respect to `app.js` and `Style.css`** — they import/reference app logic but do not modify source files.
- Async tests use `async`/`await` or return a `Promise` to the runner for correct async handling.
- Each test file is independently runnable in isolation (no inter-file dependencies).

---

## Android Deployment

The application has been packaged as an **Android WebView-based mobile dialing app**. Key architectural decisions for Android deployment:

- The web app (`Index.html`, `Css/Style.css`, `js/app.js`) serves as the UI layer loaded inside an Android `WebView`.
- The Android wrapper grants necessary permissions (microphone, network state) via the Android manifest, complementing the browser-level `getUserMedia()` permission requests.
- The dialer UI, keypad, connectivity panel, call audio system, caller ID name input, call duration timer, microphone permission pre-check, network type badge, backspace long-press clear, and call volume indicator are all functional within the Android WebView environment.
-