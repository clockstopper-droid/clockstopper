# Clockstopper Android – Developer & Agent Guide

## Project Summary
Clockstopper is a single-Activity Android app that displays a stopwatch UI served
from bundled web assets (HTML/CSS/JS) inside a `WebView`.  The app is written in
Kotlin and follows a layered architecture that cleanly separates business logic from
Android-specific code.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Web Assets  (assets/index.html + css/style.css + js/)  │  ← Rendering layer only
│  No timing logic – calls NativeBridge.* for actions,    │
│  receives updateDisplay() calls for state changes.      │
└────────────────────────┬────────────────────────────────┘
                         │  JavascriptInterface (JsBridge)
┌────────────────────────▼────────────────────────────────┐
│  WebAppFragment                                         │  ← Android UI layer
│  • Owns WebView lifecycle                               │
│  • Observes StopwatchViewModel LiveData                 │
│  • Forwards JS calls → ViewModel actions                │
└────────────────────────┬────────────────────────────────┘
                         │  method calls / LiveData
┌────────────────────────▼────────────────────────────────┐
│  StopwatchViewModel  (androidx.lifecycle.ViewModel)     │  ← Android adapter layer
│  • Survives configuration changes                       │
│  • Drives coroutine tick loop                           │
│  • Exposes LiveData<String> displayTime, laps, etc.     │
└────────────────────────┬────────────────────────────────┘
                         │  pure Kotlin function calls
┌────────────────────────▼────────────────────────────────┐
│  domain/  (platform-agnostic, zero Android imports)     │  ← Domain / business layer
│  ├── StopwatchState    – immutable state snapshot       │
│  ├── StopwatchEngine   – state-transition functions     │
│  ├── TimeFormatter     – ms ↔ display-string conversion │
│  ├── LapAnalyzer       – lap statistics                 │
│  └── LapSummary        – derived statistics value obj   │
└─────────────────────────────────────────────────────────┘
```

---

## Domain Layer (`com.clockstopper.app.domain`)

All classes in this package are **pure Kotlin with no Android, web, or framework
dependencies**.  They can be unit-tested on the JVM without a device.

| Class / Object | Responsibility |
|---|---|
| `StopwatchState` | Immutable data class holding all stopwatch state. |
| `StopwatchEngine` | Pure functions: `start`, `stop`, `reset`, `lap`, `tick`. |
| `StopwatchEngine.Clock` | Minimal time-source abstraction; inject a `FakeClock` in tests. |
| `TimeFormatter` | `format(ms)` → `"MM:SS.cc"` or `"HH:MM:SS.cc"`, plus `parse()` and `formatLap()`. |
| `LapAnalyzer` | `summarise(laps)` → `LapSummary`; `fastestIndex` / `slowestIndex` helpers. |
| `LapSummary` | Value object: count, fastestMs, slowestMs, averageMs, totalMs. |

### Adding New Business Logic
- All new timing / formatting / calculation logic **must** live in `domain/`.
- Domain classes must not import `android.*`, `androidx.*`, or any UI framework.
- Cover new logic with a corresponding unit test in
  `src/test/java/com/clockstopper/app/domain/`.

---

## Android Adapter Layer

### `StopwatchViewModel`
- Holds a `StopwatchEngine` instance and a `StopwatchState` field.
- Launches a coroutine that calls `engine.tick(state)` every **10 ms** while running.
- Exposes `LiveData<String> displayTime`, `LiveData<List<String>> laps`,
  `LiveData<Boolean> isRunning`, `LiveData<LapSummary> lapSummary`.
- Action handlers: `onStartStop()`, `onLap()`, `onReset()`.

### `WebAppFragment`
- Configures the `WebView` (JavaScript enabled, DOM storage, no mixed content).
- Exposes `window.NativeBridge` with `startStop()`, `lap()`, `reset()`, `formatTime(ms)`.
- Observes `viewModel.displayTime` and calls `javascript:updateDisplay(time, lapsJson)`
  on every tick to refresh the web UI.

---

## Web Assets (`src/main/assets/`)

The web front-end is a pure **rendering / input layer**.

| File | Role |
|---|---|
| `index.html` | App shell; contains display elements and calls `NativeBridge.*`. |
| `css/style.css` | Visual styling only. |
| `js/app.js` | DOM manipulation + event wiring.  Must **not** contain timing logic. |

**Expected JavaScript contract:**

```javascript
// Called by the fragment on every tick:
function updateDisplay(timeString, lapsJson) { /* update DOM */ }

// Buttons call native:
NativeBridge.startStop();
NativeBridge.lap();
NativeBridge.reset();

// Optional: use native formatter:
const formatted = NativeBridge.formatTime(12345);  // → "00:12.34"
```

---

## Running Tests

```bash
# All JVM unit tests (domain layer + ExampleUnitTest)
./gradlew test

# Instrumentation tests (requires connected device / emulator)
./gradlew connectedAndroidTest

# Single test class
./gradlew test --tests "com.clockstopper.app.domain.StopwatchEngineTest"
```

---

## Conventions

- **Branch naming:** `feat/<kebab-case-description>-<short-id>-queued`
- **Language:** Kotlin only (no Java).
- **UI pattern:** Single-Activity + Fragment navigation (Jetpack NavComponent).
- **New screens:** Implement as `Fragment` destinations in the nav graph.
- **No Compose:** XML layouts are used throughout.
- **Proguard:** `proguard-rules.pro` – add rules if new reflection-heavy dependencies are added.
