# Project Context Document: Global Time Clock (clockstopper)

## Project Overview

**Global Time Clock** is a lightweight, client-side web application that displays three fixed world clocks: **Eastern Time**, **Central Time**, and **Western (Pacific) Time**. It is a pure frontend application with no backend dependencies, build tools, or frameworks — designed to run directly in a browser by opening `Index.html`.

The app updates all displayed clocks every second. The three time zone clocks are **fixed and hardcoded** — users cannot add or remove clocks. A **dark theme with orange accent keypad/controls** is supported via a CSS class toggle. A **mute button** allows users to silence any audio alerts without removing clocks. There are **no alarm, ticking, or audio clock sounds** — the clocks are purely digital display only. There are **no neon lighting effects** — all neon glow, neon text-shadow, neon border-glow, and neon color effects have been removed from the CSS and JS; the visual style uses clean, flat dark theme styling with orange accents only. An **enhanced connectivity panel** displays WiFi/network status, detects available networks, and allows network selection — all using native browser APIs where possible, supplemented by a fetch-based connectivity probe. A **mobile network option** is supported within the connectivity panel, allowing the user to select and use a mobile/cellular network connection when available; the app detects and surfaces mobile network types (e.g., `cellular`, `4g`, `3g`, `2g`) via the `NetworkInformation` API and allows the user to prefer mobile network for call audio routing. An **outgoing call audio system** provides call audio output and requests microphone permissions using the native browser MediaDevices API, with call audio routed through the **currently selected network** (WiFi or mobile). A **dialer UI** displays the number being dialed with a dedicated number display box above the keypad and a live "number being dialed" readout beneath it, updating as digits are entered. A **caller ID name feature** allows the user to set a custom display name — any words or text the user chooses — that appears on the recipient's caller ID instead of the caller's phone number. The user enters and saves a custom caller ID name string which is used when placing outgoing calls; the saved name is what the recipient will see on their caller ID display. **Physical and virtual keyboard input** is supported for the dialer — users can type digits, `*`, `#`, `+`, and control keys (`Backspace`, `Enter`, `Escape`) directly from a hardware keyboard or software keyboard, with the dialer responding identically to keypad button taps. A **call duration timer** is displayed in `#callStatus` during an active call, showing a live elapsed time counter (formatted as `MM:SS` or `HH:MM:SS`) that starts when the call connects and stops when the call ends.

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
| Caller ID Name | User-defined free-text string stored in app state; submitted with outgoing call metadata; any words/characters the user enters will appear on the recipient's caller ID display |
| Call Duration Timer | `setInterval`-based elapsed time counter; starts on call connect, stops on call end; displays in `#callStatus` formatted as `MM:SS` (or `HH:MM:SS` for calls ≥ 1 hour) |
| Keyboard Input | `keydown` event listener on `document`; maps key values to `dialDigit()`, `clearDialed()`, `initiateCall()`, `endCall()` |
| Android Packaging | Android WebView wrapper (WebView-based native Android app) |
| Runtime | Browser (standalone) + Android WebView (mobile deployment) |

---

## Repository Structure

```
clockstopper/
├── Index.html          # Entry point — main HTML shell
├── Css/
│   └── Style.css       # Global styles, responsive layout, dark theme, connectivity panel, call UI, dialer UI, mobile network UI, caller ID name UI, call duration timer display
├── js/
│   └── app.js          # All application logic, theme toggle, mute toggle, connectivity detection, mobile network selection, call audio, dialer, caller ID name, keyboard input handling, call duration timer
├── README.md           # Project documentation
└── .gitignore          # Android/IntelliJ artifacts excluded
```

> **Note:** The `.gitignore` file contains Android/Gradle/IntelliJ patterns. The repository has been used as the basis for an Android WebView application, so these entries are directly relevant to the Android packaging layer as well as any IntelliJ/Android Studio IDE artifacts.

---

## Android Deployment

The application has been packaged as an **Android WebView-based mobile dialing app**. Key architectural decisions for Android deployment:

- The web app (`Index.html`, `Css/Style.css`, `js/app.js`) serves as the UI layer loaded inside an Android `WebView`.
- The Android wrapper grants necessary permissions (microphone, network state) via the Android manifest, complementing the browser-level `getUserMedia()` permission requests.
- The dialer UI, keypad, connectivity panel, call audio system, caller ID name input, and call duration timer are all functional within the Android WebView environment.
- Mobile-specific CSS breakpoints and touch-friendly keypad sizing ensure a native-feeling experience on Android screen sizes.
- The `.gitignore` Android/Gradle/IntelliJ entries are intentional and directly applicable to the Android project artifacts generated during packaging.
- Keyboard input support is compatible with Android WebView's software keyboard — physical keyboard events and soft keyboard input events both dispatch `keydown` events that the dialer listener handles.

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
| `#` | `dialDigit('#')` — appends hash/pound character |
| `+` | `dialDigit('+')` — appends plus character (international prefix) |
| `Backspace` | `clearDialed()` — removes last digit (backspace behavior) |
| `Enter` | `initiateCall()` — starts outgoing call if number is present |
| `Escape` | `endCall()` — ends active call or clears dialer state |

Implementation notes:
- The keyboard listener is initialized during page load setup in `app.js`.
- Input is **guarded**: if focus is on a text input element (e.g., `#callerIdNameInput`), keyboard events are **not intercepted** by the dialer listener, allowing normal text typing in form fields — this is especially important for the caller ID name input so users can freely type words without triggering dialer actions.
- The listener does not call `preventDefault()` globally — only for keys that have been mapped to dialer actions and are not directed at a text input, preventing accidental page scroll or browser shortcut conflicts.
- Behavior is identical whether triggered by a keypad button tap or a keyboard key press — both routes call the same underlying `dialDigit()`, `clearDialed()`, `initiateCall()`, and `endCall()` functions.

---

## Architecture

This is a **single-page, no-framework, pure JavaScript application** deployable both as a standalone browser app and as the UI layer of an Android WebView application. There is no module system, no bundler, and no package manager involved.

### Component Breakdown

```
Index.html
  └── #clocksGrid              → Static container holding the three fixed clock cards (Eastern, Central, Western)
  └── #connectivityPanel       → Enhanced connectivity panel container
  └── #wifiStatus              → Status indicator element within the connectivity panel
  └── #networkList             → Dynamic list of detected/available networks within the panel
  └── #mobileNetworkOption     → Selectable option within connectivity panel to use mobile/cellular network
  └── #connectivityProbeStatus → Displays result of fetch-based internet probe
  └── #callPanel               → Outgoing call UI panel container
  └── #callerIdNameInput       → Free-text input for the user to enter any words/name for caller ID display
  └── #setCallerIdNameBtn      → Button to save the entered caller ID name to app state
  └── #callerIdNameDisplay     → Read-only display showing the currently active caller ID name (what recipients will see)
  └── #dialerDisplay           → Primary number display box showing the outgoing number being dialed
  └── #dialedNumberReadout     → Secondary label/readout beneath the dialer display showing live digit entry
  └── #callStatus              → Text/icon display of current call state; also shows live call duration timer (MM:SS or HH:MM:SS) during active call
  └── #micPermissionStatus     → Displays microphone permission state
  └── #networkTypeIndicator    → Displays current active network type (WiFi, 4G, 3G, etc.) during a call
  └── toggleTheme()            → Called inline via theme toggle button onclick
  └── toggleMute()             → Called inline via mute button onclick
  └── toggleConnectivityPanel()→ Called inline to expand/collapse the connectivity panel
  └── selectMobileNetwork()    → Called inline to set mobile/cellular as the preferred network for calls
  └── setCallerIdName()        → Called inline by #setCallerIdNameBtn to save caller ID name from input to state;
                                  the saved name (any words the user entered) becomes what the recipient sees
  └── dialDigit(digit)         → Called inline by each keypad button OR by keyboard input handler to append a digit
  └── clearDialed()            → Called inline by a clear/backspace button OR by Backspace key to remove the last digit or clear all
  └── initiateCall()           → Called inline to start an outgoing call; also triggered by Enter key
  └── endCall()                → Called inline to end an active call; also triggered by Escape key

js/app.js
  └── State management         → Tracks mute state, connectivity state, network info, preferred network type
                                  (wifi vs. mobile/cellular), call state, dialed number string,
                                  callerIdName string (free-text custom caller ID name; any words entered by
                                  user; shown to recipient on their caller ID display),
                                  callStartTime (timestamp recorded when call connects),
                                  callDurationInterval (setInterval reference for the duration timer)
  └── Clock rendering          → Generates DOM elements for the three fixed clock cards on page load
  └── Tick loop                → setInterval (every 1000ms) updates all three clocks
  └── toggleTheme()            → Toggles dark-theme class on <body>
  └── toggleMute()             → Toggles muted state; updates mute button appearance
  └── toggleConnectivityPanel()→ Expands/collapses the connectivity panel
  └── selectMobileNetwork()    → Sets preferredNetwork state to 'cellular'; updates UI to reflect mobile network
                                  selection; call audio will be routed using the mobile connection
  └── setCallerIdName()        → Reads value from #callerIdNameInput; saves to callerIdName state variable;
                                  updates #callerIdNameDisplay to confirm the active name to the user;
                                  the name (any words/text the user typed) is passed as caller identity
                                  when initiateCall() is invoked — this is what the recipient sees on caller ID
  └── dialDigit(digit)         → Appends a digit character to the dialedNumber state string; updates #dialerDisplay and #dialedNumberReadout
  └── clearDialed()            → Removes last character (backspace) or clears full dialedNumber string; updates display elements
  └── startCallDurationTimer() → Records callStartTime; starts a 1000ms setInterval that computes elapsed
                                  seconds, formats as MM:SS or HH:MM:SS, and writes the duration string
                                  into #callStatus each tick
  └── stopCallDurationTimer()  → Clears the callDurationInterval; resets callStartTime to null; called by endCall()
  └── initKeyboardInput()      → Attaches document-level keydown listener; maps digit/