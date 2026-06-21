# Project Context Document: Global Time Clock (clockstopper)

## Project Overview

**Global Time Clock** is a lightweight, client-side web application that displays three fixed world clocks: **Eastern Time**, **Central Time**, and **Western (Pacific) Time**. It is a pure frontend application with no backend dependencies, build tools, or frameworks — designed to run directly in a browser by opening `Index.html`.

The app updates all displayed clocks every second. The three time zone clocks are **fixed and hardcoded** — users cannot add or remove clocks. A **dark theme with orange accent keypad/controls** is supported via a CSS class toggle. A **mute button** allows users to silence any audio alerts without removing clocks. There are **no alarm, ticking, or audio clock sounds** — the clocks are purely digital display only. There are **no neon lighting effects** — all neon glow, neon text-shadow, neon border-glow, and neon color effects have been removed from the CSS and JS; the visual style uses clean, flat dark theme styling with orange accents only. An **enhanced connectivity panel** displays WiFi/network status, detects available networks, and allows network selection — all using native browser APIs where possible, supplemented by a fetch-based connectivity probe. A **mobile network option** is supported within the connectivity panel, allowing the user to select and use a mobile/cellular network connection when available; the app detects and surfaces mobile network types (e.g., `cellular`, `4g`, `3g`, `2g`) via the `NetworkInformation` API and allows the user to prefer mobile network for call audio routing. An **outgoing call audio system** provides call audio output and requests microphone permissions using the native browser MediaDevices API, with call audio routed through the **currently selected network** (WiFi or mobile). A **dialer UI** displays the number being dialed with a dedicated number display box above the keypad and a live "number being dialed" readout beneath it, updating as digits are entered. A **caller ID name feature** allows the user to set a custom display name that appears on the recipient's caller ID instead of the caller's phone number — the user can enter and save a custom caller ID name string which is used when placing outgoing calls. **Physical and virtual keyboard input** is supported for the dialer — users can type digits, `*`, `#`, `+`, and control keys (`Backspace`, `Enter`, `Escape`) directly from a hardware keyboard or software keyboard, with the dialer responding identically to keypad button taps.

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
| Caller ID Name | User-defined string stored in app state; submitted with outgoing call metadata |
| Keyboard Input | `keydown` event listener on `document`; maps key values to `dialDigit()`, `clearDialed()`, `initiateCall()`, `endCall()` |
| Android Packaging | Android WebView wrapper (WebView-based native Android app) |
| Runtime | Browser (standalone) + Android WebView (mobile deployment) |

---

## Repository Structure

```
clockstopper/
├── Index.html          # Entry point — main HTML shell
├── Css/
│   └── Style.css       # Global styles, responsive layout, dark theme, connectivity panel, call UI, dialer UI, mobile network UI, caller ID name UI
├── js/
│   └── app.js          # All application logic, theme toggle, mute toggle, connectivity detection, mobile network selection, call audio, dialer, caller ID name, keyboard input handling
├── README.md           # Project documentation
└── .gitignore          # Android/IntelliJ artifacts excluded
```

> **Note:** The `.gitignore` file contains Android/Gradle/IntelliJ patterns. The repository has been used as the basis for an Android WebView application, so these entries are directly relevant to the Android packaging layer as well as any IntelliJ/Android Studio IDE artifacts.

---

## Android Deployment

The application has been packaged as an **Android WebView-based mobile dialing app**. Key architectural decisions for Android deployment:

- The web app (`Index.html`, `Css/Style.css`, `js/app.js`) serves as the UI layer loaded inside an Android `WebView`.
- The Android wrapper grants necessary permissions (microphone, network state) via the Android manifest, complementing the browser-level `getUserMedia()` permission requests.
- The dialer UI, keypad, connectivity panel, call audio system, and caller ID name input are all functional within the Android WebView environment.
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

The application allows the user to set a **custom caller ID name** that will appear on the recipient's caller ID display instead of the caller's raw phone number.

Key implementation details:
- A dedicated **caller ID name input field** (`#callerIdNameInput`) allows the user to type a custom name string.
- A **save/set button** (`#setCallerIdNameBtn`) commits the entered name to the `callerIdName` state variable in `app.js`.
- The saved `callerIdName` string is used when `initiateCall()` is invoked, submitting the name as the caller identity for outgoing calls.
- A **caller ID name display** (`#callerIdNameDisplay`) shows the currently active caller ID name so the user can confirm what recipients will see.
- The caller ID name is stored in app-level JavaScript state (not persisted to `localStorage` or any backend) — it resets on page reload.
- If no caller ID name is set, outgoing calls fall back to default behavior (number display or system default).

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
- Input is **guarded**: if focus is on a text input element (e.g., `#callerIdNameInput`), keyboard events are **not intercepted** by the dialer listener, allowing normal text typing in form fields.
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
  └── #callerIdNameInput       → Text input for the user to enter a custom caller ID name
  └── #setCallerIdNameBtn      → Button to save the entered caller ID name to app state
  └── #callerIdNameDisplay     → Read-only display showing the currently active caller ID name
  └── #dialerDisplay           → Primary number display box showing the outgoing number being dialed
  └── #dialedNumberReadout     → Secondary label/readout beneath the dialer display showing live digit entry
  └── #callStatus              → Text/icon display of current call state
  └── #micPermissionStatus     → Displays microphone permission state
  └── #networkTypeIndicator    → Displays current active network type (WiFi, 4G, 3G, etc.) during a call
  └── toggleTheme()            → Called inline via theme toggle button onclick
  └── toggleMute()             → Called inline via mute button onclick
  └── toggleConnectivityPanel()→ Called inline to expand/collapse the connectivity panel
  └── selectMobileNetwork()    → Called inline to set mobile/cellular as the preferred network for calls
  └── setCallerIdName()        → Called inline by #setCallerIdNameBtn to save caller ID name from input to state
  └── dialDigit(digit)         → Called inline by each keypad button OR by keyboard input handler to append a digit
  └── clearDialed()            → Called inline by a clear/backspace button OR by Backspace key to remove the last digit or clear all
  └── initiateCall()           → Called inline to start an outgoing call; also triggered by Enter key
  └── endCall()                → Called inline to end an active call; also triggered by Escape key

js/app.js
  └── State management         → Tracks mute state, connectivity state, network info, preferred network type
                                  (wifi vs. mobile/cellular), call state, dialed number string,
                                  callerIdName string (custom caller ID name for outgoing calls)
  └── Clock rendering          → Generates DOM elements for the three fixed clock cards on page load
  └── Tick loop                → setInterval (every 1000ms) updates all three clocks
  └── toggleTheme()            → Toggles dark-theme class on <body>
  └── toggleMute()             → Toggles muted state; updates mute button appearance
  └── toggleConnectivityPanel()→ Expands/collapses the connectivity panel
  └── selectMobileNetwork()    → Sets preferredNetwork state to 'cellular'; updates UI to reflect mobile network
                                  selection; call audio will be routed using the mobile connection
  └── setCallerIdName()        → Reads value from #callerIdNameInput; saves to callerIdName state variable;
                                  updates #callerIdNameDisplay to confirm the active name to the user;
                                  the name is passed as caller identity when initiateCall() is invoked
  └── dialDigit(digit)         → Appends a digit character to the dialedNumber state string; updates #dialerDisplay and #dialedNumberReadout
  └── clearDialed()            → Removes last character (backspace) or clears full dialedNumber string; updates display elements
  └── initKeyboardInput()      → Attaches document-level keydown listener; maps digit/symbol keys to dialDigit(),
                                  Backspace to clearDialed(), Enter to initiateCall(), Escape to endCall();
                                  guards against intercepting focus on text input elements
  └── initConnectivity()       → Registers online/offline event listeners, sets initial state, starts probe,
                                  detects mobile network availability via navigator.connection.type
  └── updateConnectivityUI()   → Updates connectivity panel classes and text to reflect online/offline;
                                  surfaces mobile network option if cellular is detected
  └── probeConnectivity()      → Fetch-based probe to verify actual internet access beyond navigator.onLine
  └── updateNetworkInfo()      → Reads navigator.connection and updates network detail display;
                                  detects type === 'cellular' and effectiveType for mobile network indication
  └── detectMobileNetwork()    → Checks navigator.connection.type for 'cellular' value; updates
                                  #mobileNetworkOption availability and #networkTypeIndicator display
  └── scanNetworks()           → Attempts to enumerate available networks (where browser API permits)
  └── initiateCall()           → Reads preferredNetwork state and callerIdName state; requests microphone
                                  permission; sets up audio output routed through selected network; begins
                                  outgoing call audio using dialedNumber with callerIdName as caller identity;
                                  displays active network type in #networkTypeIndicator
  └── endCall()                → Stops call audio, releases microphone stream, updates call UI state,
                                  resets network type indicator
  └── requestMicPermission()   → Calls navigator.mediaDevices.getUserMedia() and handles permission grant/deny
  └── updateCallUI()           → Updates #callPanel, #callStatus, #micPermissionStatus, #dialerDisplay,
                                  #networkTypeIndicator, #callerIdNameDisplay classes and text
  └── updateDialerDisplay()    → Syncs #dialerDisplay and #dialedNumberReadout DOM content with dialedNumber state

Css/Style.css
  └── .container               → Page wrapper, centered layout
  └── .clocks-grid             → CSS Grid layout for the three fixed clock cards
  └── .clock-card              → Individual clock card styles (digital display only, no alarm/tick UI, no neon glow)
  └── .controls                → Button styling (no add-clock input)
  └── .dark-theme              → Dark background with orange accent keypad/controls; flat styling, no neon effects
  └── .mute-btn                → Mute button base styles
  └── .mute-btn.muted          → Visual state for muted/active mute
  └── .connectivity-panel      → Enhanced connectivity panel container styles
  └── .connectivity-panel.expanded → Expanded/visible state of the panel
  └── .wifi-status             → Connectivity indicator base styles
  └── .wifi-status.online      → Visual state for online/connected
  └── .wifi-status.offline     → Visual state for offline/disconnected
  └── .network-list            → Styles for the list of available/detected networks
  └── .network-list-item       → Individual network entry styles
  └── .network-