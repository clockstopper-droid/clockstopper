# Project Context Document: Global Time Clock (clockstopper)

## Project Overview

**Global Time Clock** is a lightweight, client-side web application that displays three fixed world clocks: **Eastern Time**, **Central Time**, and **Western (Pacific) Time**. It is a pure frontend application with no backend dependencies, build tools, or frameworks — designed to run directly in a browser by opening `Index.html`.

The app updates all displayed clocks every second. The three time zone clocks are **fixed and hardcoded** — users cannot add or remove clocks. A **dark theme with orange accent keypad/controls** is supported via a CSS class toggle. A **mute button** allows users to silence any audio alerts without removing clocks. There are **no alarm, ticking, or audio clock sounds** — the clocks are purely digital display only. An **enhanced connectivity panel** displays WiFi/network status, detects available networks, and allows network selection — all using native browser APIs where possible, supplemented by a fetch-based connectivity probe. An **outgoing call audio system** provides call audio output and requests microphone permissions using the native browser MediaDevices API.

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
| Audio Output | Native Web Audio API (`AudioContext`) + `HTMLAudioElement` (call audio only) |
| Microphone Input | `navigator.mediaDevices.getUserMedia()` (MediaDevices API) |
| Runtime | Browser only — no Node.js, no build step |

---

## Repository Structure

```
clockstopper/
├── Index.html          # Entry point — main HTML shell
├── Css/
│   └── Style.css       # Global styles, responsive layout, dark theme, connectivity panel, call UI
├── js/
│   └── app.js          # All application logic, theme toggle, mute toggle, connectivity detection, call audio
├── README.md           # Project documentation
└── .gitignore          # Android/IntelliJ artifacts excluded
```

> **Note:** The `.gitignore` file contains Android/Gradle/IntelliJ patterns, suggesting this repository may have been initialized from an Android project template or the developer reused an existing `.gitignore`. These entries are irrelevant to the web app itself.

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

## Architecture

This is a **single-page, no-framework, pure JavaScript application**. There is no module system, no bundler, and no package manager involved.

### Component Breakdown

```
Index.html
  └── #clocksGrid              → Static container holding the three fixed clock cards (Eastern, Central, Western)
  └── #connectivityPanel       → Enhanced connectivity panel container
  └── #wifiStatus              → Status indicator element within the connectivity panel
  └── #networkList             → Dynamic list of detected/available networks within the panel
  └── #connectivityProbeStatus → Displays result of fetch-based internet probe
  └── #callPanel               → Outgoing call UI panel container
  └── #callStatus              → Text/icon display of current call state
  └── #micPermissionStatus     → Displays microphone permission state
  └── toggleTheme()            → Called inline via theme toggle button onclick
  └── toggleMute()             → Called inline via mute button onclick
  └── toggleConnectivityPanel()→ Called inline to expand/collapse the connectivity panel
  └── initiateCall()           → Called inline to start an outgoing call with audio
  └── endCall()                → Called inline to end an active call and release audio/mic resources

js/app.js
  └── State management         → Tracks mute state, connectivity state, network info, call state
  └── Clock rendering          → Generates DOM elements for the three fixed clock cards on page load
  └── Tick loop                → setInterval (every 1000ms) updates all three clocks
  └── toggleTheme()            → Toggles dark-theme class on <body>
  └── toggleMute()             → Toggles muted state; updates mute button appearance
  └── toggleConnectivityPanel()→ Expands/collapses the connectivity panel
  └── initConnectivity()       → Registers online/offline event listeners, sets initial state, starts probe
  └── updateConnectivityUI()   → Updates connectivity panel classes and text to reflect online/offline
  └── probeConnectivity()      → Fetch-based probe to verify actual internet access beyond navigator.onLine
  └── updateNetworkInfo()      → Reads navigator.connection and updates network detail display
  └── scanNetworks()           → Attempts to enumerate available networks (where browser API permits)
  └── initiateCall()           → Requests microphone permission, sets up audio output, begins outgoing call audio
  └── endCall()                → Stops call audio, releases microphone stream, updates call UI state
  └── requestMicPermission()   → Calls navigator.mediaDevices.getUserMedia() and handles permission grant/deny
  └── updateCallUI()           → Updates #callPanel, #callStatus, #micPermissionStatus classes and text

Css/Style.css
  └── .container               → Page wrapper, centered layout
  └── .clocks-grid             → CSS Grid layout for the three fixed clock cards
  └── .clock-card              → Individual clock card styles (digital display only, no alarm/tick UI)
  └── .controls                → Button styling (no add-clock input)
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
  └── .call-panel              → Outgoing call UI panel container styles
  └── .call-panel.active       → Visual state when a call is in progress
  └── .call-status             → Call state indicator base styles
  └── .call-status.calling     → Visual state while call is being established / ringing
  └── .call-status.connected   → Visual state when call audio is active
  └── .call-status.ended       → Visual state when call has ended
  └── .mic-permission-status   → Microphone permission indicator base styles
  └── .mic-permission-status.granted  → Visual state when mic permission is granted
  └── .mic-permission-status.denied   → Visual state when mic permission is denied
  └── .mic-permission-status.pending  → Visual state while permission is being requested
  └── Responsive rules         → Mobile-friendly breakpoints
```

### Data Flow

```
Page Load
    → renderClocks()
        → Iterate over hardcoded FIXED_ZONES array [Eastern, Central, Western]
        → Render clock card DOM elements into #clocksGrid
        → No user input required or accepted for adding/removing clocks

setInterval (1000ms)
    → updateClocks()
        → For each of the three fixed time zones
            → Format current time using Intl.DateTimeFormat
            → Update the DOM element for that clock
            → No audio ticking or alarm sounds are triggered

Theme Toggle Button
    → toggleTheme()
        → Toggle .dark-theme class on document.body
        → CSS handles all visual changes via class-scoped rules

Mute Button
    → toggleMute()
        → Toggle isMuted boolean state variable in app.js
        → Update mute button label/icon/class to reflect current state
        → Only affects call audio output; no clock sounds exist to mute

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

Call Button (initiateCall)
    → initiateCall()
        → Call requestMicPermission()
            → navigator.mediaDevices.getUserMedia({ audio: true })
                → On grant: store MediaStream, mark #micPermissionStatus as .granted
                → On deny: mark #micPermissionStatus as .denied, abort call setup
        → On mic granted: set up outgoing call audio (ringback tone via AudioContext or HTMLAudioElement)
        → Update #callStatus to .calling, mark #callPanel as .active
        → On audio connected: update #callStatus to .connected
        → Respect isMuted flag for audio output

End Call Button (endCall)
    → endCall()
        → Stop all audio output (AudioContext / HTMLAudioElement)
        → Stop all tracks on the active MediaStream (release microphone)
        → Update #callStatus to .ended
        → Remove .active from #callPanel
        → Reset call state variables in app.js
```

---

## Key Files

### `Index.html`
- The **sole HTML file** and application entry point.
- Defines the page structure: a heading, the `#clocksGrid` div (statically holds the three rendered clock cards), the controls section with a **theme toggle button** and a **mute button** (no add-clock input or button), an **enhanced `#connectivityPanel`** containing the `#wifiStatus` indicator, `#networkList`, and `#connectivityProbeStatus` elements, and a **`#callPanel`** containing `#callStatus` and `#micPermissionStatus` for outgoing call audio and microphone permission UI.
- Loads `css/style.css` and `js/app.js` via relative paths.
- Uses inline `onclick="toggleTheme()"` on the theme toggle button, `onclick="toggleMute()"` on the mute button, `onclick="toggleConnectivityPanel()"` on the connectivity panel trigger, `onclick="initiateCall()"` on the call button, and `onclick="endCall()"` on the end call button — all functions must be globally scoped in `app.js`.
- **No `#tzInput` text field** and **no "Add Clock" button** exist in the HTML — clock management UI has been removed entirely.
- The `#wifiStatus`, `#networkList`, `#connectivityProbeStatus`, `#callStatus`, and `#micPermissionStatus` elements are updated programmatically — they do not use `onclick` handlers.
- **Case sensitivity note:** The file is named `Index.html` (capital I). On case-sensitive file systems (Linux servers, some CI environments), references must match exactly.

### `js/app.js`
- Contains **all application logic** including theme toggling, mute toggling, connectivity/network detection, and the full outgoing call audio and microphone permission system.
- Defines a **`FIXED_ZONES` constant array** (or equivalent hardcoded structure) containing the three time zone entries: Eastern (`America/New_York`), Central (`America/Chicago`), and Western (`America/Los_Angeles`).
- Manages mute state (`isMuted` boolean), connectivity state, network info state, and call state (`isCallActive` boolean, active `MediaStream` reference, active `AudioContext`/audio element reference).
- **No dynamic add/remove timezone functions** — `addTimezone()` and `removeTimezone()` have been removed.
- Clock cards are rendered once on page load by iterating `FIXED_ZONES`; the `setInterval` tick loop updates only these three clocks.
- **No alarm or ticking audio** is produced by the clock system. The `isMuted` flag applies exclusively to call audio.
- Uses the `Intl.DateTimeFormat` API for locale-aware, time-zone-aware formatting — no external date libraries needed.
- Uses `navigator.onLine` for the initial connectivity state on page load.
- Uses `navigator.connection` (NetworkInformation API) where available to surface network type, effective type, downlink speed, and RTT.
- Implements `probeConnectivity()` using `fetch()` to a known lightweight endpoint to verify actual internet access, supplementing the unreliable `navigator.onLine` value.
- Registers `window` event listeners for `'online'` and `'offline'` events to reactively update the connectivity panel.
- Implements `requestMicPermission()` using `navigator.mediaDevices.getUserMedia({ audio: true })` — gracefully handles permission denial; updates `#micPermissionStatus` accordingly.
- Implements `initiateCall()` which triggers mic permission request, sets up outgoing call audio (ringback/call tone via `AudioContext` or `HTMLAudioElement`), and manages call state.
- Implements `endCall()` which stops all audio tracks, releases the `MediaStream`, tears down the `AudioContext` or audio element, and resets call UI state.
- `toggleTheme()`, `toggleMute()`, `toggleConnectivityPanel()`, `initiateCall()`, and `endCall()` must remain globally scoped as they are referenced via HTML `onclick` attributes.
- `initConnectivity()` is called on page load (e.g., `DOMContentLoaded` or at script execution time) to set up listeners, render initial state, and run the initial probe.

### `Css/Style.css`
- Handles all visual presentation including the **dark theme**, **mute button states**, **enhanced connectivity panel**, and **call panel with mic permission indicator**.
- Implements a **CSS Grid** layout for the three fixed clock cards (`#clocksGrid`).
- Clock cards display **digital time only** — no alarm controls, no tick-sound toggle, no audio-related UI within the clock card itself.
- Dark theme is implemented via a `.dark-theme` class on `<body>`, using **orange as the primary accent color** for buttons (keypad/controls area).
- Mute button uses a `.muted` class (toggled on the button element) to visually indicate the muted state.
- Connectivity panel uses `.expanded` class for show/hide toggling and animation; `.online`/`.offline` on `#wifiStatus`; `.verified`/`.unverified` on `#connectivityProbeStatus`; `.selected` on active network list items.
- Call panel uses `.active` class on `#callPanel`; `.calling`/`.connected`/`.ended` on `#callStatus`; `.granted`/`.denied`/`.pending` on `#micPermissionStatus`.
- Dark theme styles for the connectivity panel and call panel are scoped under `.dark-theme` for consistency with the theming system.
- Includes responsive/mobile-friendly rules.
- **Case sensitivity note:** The folder is `Css/` and file is `Style.css` (both capitalized). References in HTML must match.

---

## Theming System

### Dark Theme with Orange Keypad

- Activated by toggling the `.dark-theme` CSS class on `document.body`.
- All dark theme