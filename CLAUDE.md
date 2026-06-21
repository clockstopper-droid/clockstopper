# Project Context Document: Global Time Clock (clockstopper)

## Project Overview

**Global Time Clock** is a lightweight, client-side web application that displays three fixed world clocks: **Eastern Time**, **Central Time**, and **Western (Pacific) Time**. It is a pure frontend application with no backend dependencies, build tools, or frameworks — designed to run directly in a browser by opening `Index.html`.

The app updates all displayed clocks every second. The three time zone clocks are **fixed and hardcoded** — users cannot add or remove clocks. A **dark theme with orange accent keypad/controls** is supported via a CSS class toggle. A **mute button** allows users to silence any audio alerts without removing clocks. There are **no alarm, ticking, or audio clock sounds** — the clocks are purely digital display only. An **enhanced connectivity panel** displays WiFi/network status, detects available networks, and allows network selection — all using native browser APIs where possible, supplemented by a fetch-based connectivity probe. A **mobile network option** is supported within the connectivity panel, allowing the user to select and use a mobile/cellular network connection when available; the app detects and surfaces mobile network types (e.g., `cellular`, `4g`, `3g`, `2g`) via the `NetworkInformation` API and allows the user to prefer mobile network for call audio routing. An **outgoing call audio system** provides call audio output and requests microphone permissions using the native browser MediaDevices API, with call audio routed through the **currently selected network** (WiFi or mobile). A **dialer UI** displays the number being dialed with a dedicated number display box above the keypad and a live "number being dialed" readout beneath it, updating as digits are entered.

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
| Runtime | Browser only — no Node.js, no build step |

---

## Repository Structure

```
clockstopper/
├── Index.html          # Entry point — main HTML shell
├── Css/
│   └── Style.css       # Global styles, responsive layout, dark theme, connectivity panel, call UI, dialer UI, mobile network UI
├── js/
│   └── app.js          # All application logic, theme toggle, mute toggle, connectivity detection, mobile network selection, call audio, dialer
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
  └── #mobileNetworkOption     → Selectable option within connectivity panel to use mobile/cellular network
  └── #connectivityProbeStatus → Displays result of fetch-based internet probe
  └── #callPanel               → Outgoing call UI panel container
  └── #dialerDisplay           → Primary number display box showing the outgoing number being dialed
  └── #dialedNumberReadout     → Secondary label/readout beneath the dialer display showing live digit entry
  └── #callStatus              → Text/icon display of current call state
  └── #micPermissionStatus     → Displays microphone permission state
  └── #networkTypeIndicator    → Displays current active network type (WiFi, 4G, 3G, etc.) during a call
  └── toggleTheme()            → Called inline via theme toggle button onclick
  └── toggleMute()             → Called inline via mute button onclick
  └── toggleConnectivityPanel()→ Called inline to expand/collapse the connectivity panel
  └── selectMobileNetwork()    → Called inline to set mobile/cellular as the preferred network for calls
  └── dialDigit(digit)         → Called inline by each keypad button to append a digit to the dialed number
  └── clearDialed()            → Called inline by a clear/backspace button to remove the last digit or clear all
  └── initiateCall()           → Called inline to start an outgoing call with audio using the dialed number
  └── endCall()                → Called inline to end an active call and release audio/mic resources

js/app.js
  └── State management         → Tracks mute state, connectivity state, network info, preferred network type
                                  (wifi vs. mobile/cellular), call state, dialed number string
  └── Clock rendering          → Generates DOM elements for the three fixed clock cards on page load
  └── Tick loop                → setInterval (every 1000ms) updates all three clocks
  └── toggleTheme()            → Toggles dark-theme class on <body>
  └── toggleMute()             → Toggles muted state; updates mute button appearance
  └── toggleConnectivityPanel()→ Expands/collapses the connectivity panel
  └── selectMobileNetwork()    → Sets preferredNetwork state to 'cellular'; updates UI to reflect mobile network
                                  selection; call audio will be routed using the mobile connection
  └── dialDigit(digit)         → Appends a digit character to the dialedNumber state string; updates #dialerDisplay and #dialedNumberReadout
  └── clearDialed()            → Removes last character (backspace) or clears full dialedNumber string; updates display elements
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
  └── initiateCall()           → Reads preferredNetwork state; requests microphone permission; sets up
                                  audio output routed through selected network; begins outgoing call audio
                                  using dialedNumber; displays active network type in #networkTypeIndicator
  └── endCall()                → Stops call audio, releases microphone stream, updates call UI state,
                                  resets network type indicator
  └── requestMicPermission()   → Calls navigator.mediaDevices.getUserMedia() and handles permission grant/deny
  └── updateCallUI()           → Updates #callPanel, #callStatus, #micPermissionStatus, #dialerDisplay,
                                  #networkTypeIndicator classes and text
  └── updateDialerDisplay()    → Syncs #dialerDisplay and #dialedNumberReadout DOM content with dialedNumber state

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
  └── .network-list-item.mobile   → Visual state for mobile/cellular network entries in the list
  └── .mobile-network-option   → Styles for the dedicated mobile network selection element
  └── .mobile-network-option.available  → Visual state when mobile/cellular network is detected and usable
  └── .mobile-network-option.selected   → Visual state when mobile network is the preferred/active selection
  └── .mobile-network-option.unavailable → Visual state when no cellular network is detected
  └── .probe-status            → Styles for the fetch-probe result indicator
  └── .probe-status.verified   → Visual state when internet access is confirmed via probe
  └── .probe-status.unverified → Visual state when probe fails despite navigator.onLine = true
  └── .call-panel              → Outgoing call UI panel container styles
  └── .call-panel.active       → Visual state when a call is in progress
  └── .network-type-indicator  → Displays the active network type (WiFi/4G/3G/2G) during a call
  └── .network-type-indicator.wifi     → Visual state when call is using WiFi
  └── .network-type-indicator.cellular → Visual state when call is using mobile/cellular network
  └── .network-type-indicator.fourG    → Visual state for 4G LTE mobile connection
  └── .network-type-indicator.threeG   → Visual state for 3G mobile connection
  └── .dialer-display          → Primary number display box above the keypad; shows the full outgoing number
  └── .dialer-display.has-number → Visual state when at least one digit has been entered
  └── .dialed-number-readout   → Secondary label beneath the dialer display; live readout of digits as they are entered
  └── .dialed-number-readout.active → Visual state when readout contains digits
  └── .keypad                  → Grid layout container for the digit buttons (0–9, *, #)
  └── .keypad-btn              → Individual keypad digit button styles; orange accent in dark theme
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
    → initDialer()
        → Initialize dialedNumber state to empty string
        → Render #dialerDisplay and #dialedNumberReadout with empty/placeholder state
    → initConnectivity()
        → Detect navigator.connection.type for cellular/WiFi
        → Call detectMobileNetwork() to surface mobile network option if available

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
        → Keypad buttons (#keypad .keypad-btn) adopt orange accent in dark theme

Mute Button
    → toggleMute()
        → Toggle isMuted boolean state variable in app.js
        → Update mute button label/icon/class to reflect current state
        → Only affects call audio output; no clock sounds exist to mute

Keypad Button Press
    → dialDigit(digit)
        → Append digit character to dialedNumber string in app.js state
        → Call updateDialerDisplay()
            → Set #dialerDisplay text content to current dialedNumber value
            → Set #dialedNumberReadout text content to current dialedNumber value
            → Toggle .has-number on #dialerDisplay and .active on #dialedNumberReadout
              based on whether dialedNumber is non-empty

Clear / Backspace Button
    → clearDialed()
        → Remove last character from dialedNumber (backspace behavior)
          or clear entire string (long-press / dedicated clear)
        → Call updateDialerDisplay() to sync DOM

Window online/offline events + navigator.onLine
    → updateConnectivityUI()
        → Add/remove .online / .offline CSS classes on #wifiStatus element
        → Update indicator text/icon to reflect current connectivity state
        → Trigger probeConnectivity() to verify actual internet access
        → Trigger detectMobileNetwork() to refresh mobile network availability

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
    → detectMobileNetwork()
        → Check navigator.connection.type === 'cellular'
        → Check navigator.connection.effectiveType ('4g', '3g', '2g')
        → Enable/disable #mobileNetworkOption and apply .available/.unavailable class
        → Update #networkTypeIndicator with detected mobile network type label

Connectivity Panel Toggle
    → toggleConnectivityPanel()
        → Toggle .expanded class on #connectivityPanel
        → On expand: trigger updateNetworkInfo(), scanNetworks(), detectMobileNetwork()
        → CSS handles show/hide and animation via class-scoped rules

Mobile Network Selection
    → selectMobileNetwork()
        → Set preferredNetwork state variable to 'cellular' in app.js
        → Apply .selected class to #mobileNetworkOption
        → Remove .selected from any WiFi network list items
        → Update #networkTypeIndicator to reflect mobile network choice
        → Chosen network type will be used when initiateCall() is next invoked

Call Button (initiateCall)
    → initiateCall()
        → Read current dialedNumber from state (number to be called)
        → Read preferredNetwork state ('cellular' or 'wifi') to determine call routing context
        → Call requestMicPermission()
            → navigator.mediaDevices.getUserMedia({ audio: true })
                → On grant: store MediaStream, mark #