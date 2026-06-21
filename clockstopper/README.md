# Global Time Clock 🌍

A lightweight, client-side web application that displays three fixed US time zone clocks simultaneously. No build tools, no frameworks, no backend — open `Index.html` in any modern browser and go.

---

## Features

| Feature | Detail |
|---|---|
| Three US time zone clocks | Eastern, Central, and Pacific — updating every second |
| Digital display only | Clean time + date readout; no ticking sounds or alarms |
| Dark theme | Orange-accent dark mode toggled via button; no page reload needed |
| **Network status panel** | Real-time connectivity info using native browser APIs |

---

## Clocks Displayed

| Zone | IANA Identifier |
|---|---|
| Eastern Time | `America/New_York` |
| Central Time | `America/Chicago` |
| Pacific Time | `America/Los_Angeles` |

---

## Network Status Panel

The **🌐 Network Status** panel at the bottom of the page surfaces everything the browser can tell you about the current network connection.

### What it shows

| Row | Source | Notes |
|---|---|---|
| **Overall status** (Online / Offline / Limited / Checking…) | `navigator.onLine` + fetch probe | Colour-coded: 🟢 green / 🔴 red / 🟠 orange |
| **Connection type** | `navigator.connection.type` | `wifi`, `cellular`, `ethernet`, … |
| **Speed class** | `navigator.connection.effectiveType` | `4G / LTE`, `3G`, `2G`, `Slow (2G)` |
| **Estimated speed** | `navigator.connection.downlink` | Downstream bandwidth in Mbps |
| **Estimated latency** | `navigator.connection.rtt` | Round-trip time in ms |
| **Data Saver** | `navigator.connection.saveData` | Whether Data Saver mode is enabled |
| **Internet reachable** | `fetch()` probe to `gstatic.com/generate_204` | Confirms actual WAN access |

A **🔄 Re-check** button triggers an immediate re-probe on demand.

### Browser support for Network Info API

- ✅ Chrome / Chromium (desktop & Android)
- ✅ Edge, Samsung Internet, Opera
- ⚠️ Firefox — not supported (graceful fallback shown)
- ⚠️ Safari — not supported (graceful fallback shown)

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
│   └── app.js          # All logic (clocks, theme, connectivity detection)
└── README.md
```

---

## Browser compatibility

Requires `Intl.DateTimeFormat` with `timeZone` support and `fetch` — both available in all modern browsers (Chrome, Firefox, Safari, Edge). Internet Explorer is **not** supported.
