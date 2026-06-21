# Global Time Clock 🌍

A lightweight, client-side web application that displays multiple world clocks simultaneously across different IANA time zones. No build tools, no frameworks, no backend — open `Index.html` in any modern browser and go.

---

## Features

| Feature | Detail |
|---|---|
| Multiple world clocks | Add any valid IANA time zone; clocks update every second |
| Dark theme | Orange-accent dark mode toggled via button; no page reload needed |
| Mute button | Silences audio alerts/ticking without removing clocks |
| **Network status panel** | Real-time connectivity information using native browser APIs (see below) |

---

## Network Status Panel

The **📡 Network Status** panel at the bottom of the page surfaces everything the browser can legitimately tell you about the current network connection.

### What it shows

| Row | Source | Notes |
|---|---|---|
| **Overall status** (Online / Offline / Limited / Checking…) | `navigator.onLine` + fetch probe | Colour-coded: 🟢 green / 🔴 red / 🟠 orange |
| **Connection type** | `navigator.connection.type` | `wifi`, `cellular`, `ethernet`, `bluetooth`, … |
| **Speed class** | `navigator.connection.effectiveType` | `4G / LTE`, `3G`, `2G`, `Slow (2G)` |
| **Estimated speed** | `navigator.connection.downlink` | Downstream bandwidth in Mbps (browser estimate) |
| **Estimated latency** | `navigator.connection.rtt` | Round-trip time in ms (browser estimate) |
| **Data Saver** | `navigator.connection.saveData` | Whether the user has enabled Data Saver mode |
| **Internet reachable** | `fetch()` probe to `gstatic.com/generate_204` | Confirms actual WAN access; `navigator.onLine` alone can be true on a LAN with no internet |

A **🔄 Re-check** button triggers an immediate re-probe on demand.

### Browser support

The **Network Information API** (`navigator.connection`) is available in:

- ✅ Chrome / Chromium (desktop & Android)
- ✅ Edge
- ✅ Samsung Internet
- ✅ Opera
- ⚠️ Firefox — not supported (panel shows "Network Info API not supported" note)
- ⚠️ Safari — not supported (same note)

When the API is unavailable, the panel gracefully omits connection-type rows and shows only the online/offline status and fetch-probe result, which work in all modern browsers.

### What it cannot do (and why)

**Scanning available Wi-Fi networks** and **routing traffic through a chosen interface** (e.g. forcing Wi-Fi vs. cellular) are OS-level / kernel operations. No browser API exposes them — by design, for user privacy and security. Applications that need those capabilities must be native apps (iOS, Android, desktop) or use OS-specific privileged APIs outside the browser sandbox.

---

## Supported Time Zones (examples)

| Zone | Example |
|---|---|
| UTC | `UTC` |
| US Eastern | `America/New_York` |
| US Pacific | `America/Los_Angeles` |
| UK | `Europe/London` |
| Central Europe | `Europe/Paris` |
| Japan | `Asia/Tokyo` |
| China | `Asia/Shanghai` |
| Australia Eastern | `Australia/Sydney` |

Any valid **IANA time zone identifier** supported by your browser works.

---

## Running locally

1. Clone the repo.
2. Open `Index.html` in any modern browser.
3. No install step, no build step, no server required.

---

## Repository structure

```
clockstopper/
├── Index.html          # Entry point
├── Css/
│   └── Style.css       # All styles (layout, dark theme, connectivity panel)
├── js/
│   └── app.js          # All logic (clocks, theme, mute, connectivity detection)
└── README.md
```

---

## Browser compatibility

Requires `Intl.DateTimeFormat` with `timeZone` support and `fetch` — both available in all modern browsers (Chrome, Firefox, Safari, Edge). Internet Explorer is **not** supported.
