# Global Time Clock — Mobile Dialer Edition

A lightweight, client-side Android-optimised web app that combines three fixed world clocks with a full phone dialer, network monitor, and outgoing call audio — all built with pure HTML5, CSS3, and Vanilla JavaScript.

---

## Features

| Feature | Details |
|---|---|
| **World Clocks** | Eastern, Central & Western (Pacific) Time — fixed, always on |
| **Dial Pad** | 3 × 4 keypad (0–9, *, #) with live number display and formatted readout |
| **Dialer Display** | Primary display box above keypad + secondary live readout; US number auto-formatting (7-, 10-, +1-11-digit) |
| **Outgoing Call Audio** | Web Audio API ringback tone (440 Hz + 480 Hz, 2 s / 4 s cadence) |
| **Microphone** | `navigator.mediaDevices.getUserMedia()` — permission requested on call start |
| **Call Overlay** | Full-screen overlay while a call is active, showing number + network badge |
| **Mute** | Silences ringback gain in real-time without ending call |
| **Dark Theme** | Default; orange accent keypad. Toggle via top-bar button |
| **Network Monitor** | Online/offline indicator + fetch-based connectivity probe |
| **Network Information** | Type, effectiveType, downlink, RTT via `NetworkInformation` API |
| **Network Mode** | Radio-button selector: Auto / Wi-Fi / Mobile (cellular) preference for calls |
| **Mobile Network Detection** | Detects `type === 'cellular'` and `effectiveType` (4G/3G/2G) |
| **Bottom Navigation** | Android-style tab bar: Clocks · Dialer · Network |
| **Keyboard Support** | 0–9, *, # dial; Backspace; Escape to clear; Enter to call |
| **No build step** | Open `Index.html` directly in any modern browser |

---

## Repository Structure

```
clockstopper-droid/
├── Index.html        ← Entry point
├── Css/
│   └── Style.css     ← All styles (mobile-first, dark theme, dialer, network)
├── js/
│   └── app.js        ← All application logic
└── README.md
```

---

## Running the App

```bash
# Option A — open directly
open clockstopper-droid/Index.html

# Option B — serve locally (avoids any browser fetch restrictions)
npx serve clockstopper-droid
# or
python3 -m http.server 8080 --directory clockstopper-droid
```

---

## Architecture

### Tab Layout (Bottom Nav)

| Tab | Content |
|---|---|
| **Clocks** | Three live clock cards — Eastern / Central / Western |
| **Dialer** | Display box, live readout, 3×4 keypad, Call / End / ⌫ buttons |
| **Network** | Online status + probe chip, connection details, mode selector, detected networks |

### Call Flow

```
dialPadPress(char)
  → dialedNumber += char
  → renderDialerDisplay()      ← syncs display box + readout
  → flashDisplay()             ← brief animation

initiateCall()
  → checkNetworkForCall()      ← pre-flight: online? mode satisfied?
  → isCallActive = true
  → showCallOverlay()          ← full-screen overlay
  → requestMicPermission()     ← navigator.mediaDevices.getUserMedia()
      → granted → startRingbackTone()   ← Web Audio 440+480 Hz cadence
      → denied  → abort, hideCallOverlay()

endCall()
  → stopRingbackTone()
  → activeStream.getTracks().forEach(t => t.stop())
  → hideCallOverlay()
```

### Network Mode

Selected via radio buttons on the **Network** tab. The chosen mode (`auto` / `wifi` / `mobile`) is stored in `networkMode` and:

- Shown in the **Network Mode badge** on the Network tab
- Shown in the **call overlay badge** during an active call
- Used in `checkNetworkForCall()` to generate a pre-flight warning if the active connection doesn't match the preferred mode (call is never blocked except when fully offline)

---

## Browser Compatibility

| API | Chrome Android | Firefox Android | Samsung Internet | Safari iOS |
|---|---|---|---|---|
| `Intl.DateTimeFormat` | ✅ | ✅ | ✅ | ✅ |
| `AudioContext` | ✅ | ✅ | ✅ | ✅ |
| `getUserMedia` | ✅ (HTTPS) | ✅ (HTTPS) | ✅ | ✅ |
| `NetworkInformation` | ✅ | ⚠ partial | ✅ | ❌ |

> **Note:** `getUserMedia` and `AudioContext` require a **secure context (HTTPS or localhost)** in most modern browsers.

---

## Design Tokens (CSS custom properties)

All colours and sizes are controlled via `--` variables in `:root` (light theme) and overridden in `.dark-theme`. Key tokens:

| Token | Purpose |
|---|---|
| `--accent` | Orange accent (#ff8c3a dark / #e86f1c light) |
| `--green` / `--red` | Call / End button colours |
| `--pad-key-bg` | Dial pad key background |
| `--app-bar-bg` | Top app bar |
| `--nav-active` | Active tab colour |
| `--tab-bar-h` | Bottom nav height (64 px) |
| `--app-bar-h` | Top bar height (56 px) |
| `--safe-bottom` | `env(safe-area-inset-bottom)` for notched phones |
