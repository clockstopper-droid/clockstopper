# Clockstopper — Android

A stopwatch / lap-timer Android application built with Kotlin and the Android
View system.  The UI is rendered inside a `WebView` from a bundled HTML/CSS/JS
front-end; all timing logic lives in a platform-agnostic Kotlin domain layer.

> **Legacy web/desktop entry points removed.**
> `Index.html`, `Css/Style.css`, and `js/app.js` at the repository root are
> **stub tombstones** and contain no functional code.  The only live web assets
> are those bundled for in-app use:
> ```
> app/src/main/assets/
> ├── index.html
> ├── css/style.css
> └── js/app.js
> ```

---

## Project structure

```
clockstopper-droid/
├── app/
│   ├── build.gradle
│   └── src/
│       └── main/
│           ├── AndroidManifest.xml
│           ├── assets/              ← bundled web front-end (in-app only)
│           │   ├── index.html
│           │   ├── css/style.css
│           │   └── js/app.js
│           ├── java/com/clockstopper/app/
│           │   ├── MainActivity.kt
│           │   ├── NavigationHost.kt
│           │   ├── StopwatchViewModel.kt
│           │   ├── WebAppFragment.kt
│           │   └── domain/
│           │       ├── LapAnalyzer.kt
│           │       ├── LapSummary.kt
│           │       ├── StopwatchEngine.kt
│           │       ├── StopwatchState.kt
│           │       └── TimeFormatter.kt
│           └── res/
│               ├── layout/
│               │   ├── activity_main.xml
│               │   └── fragment_web_app.xml
│               └── values/
│                   ├── colors.xml
│                   ├── strings.xml
│                   └── themes.xml
├── build.gradle
├── settings.gradle
├── gradle.properties
└── gradlew / gradlew.bat
```

---

## Build & run

### Prerequisites
- Android Studio Hedgehog (2023.1.1) or newer **or** a standalone JDK 17+
- Android SDK with API 34 platform and build-tools installed

### Quick start

```bash
# Assemble a debug APK
./gradlew assembleDebug

# Run unit tests (no device needed)
./gradlew test

# Run instrumented tests (device or emulator required)
./gradlew connectedAndroidTest

# Install on a connected device
./gradlew installDebug
```

### Output APK location
```
app/build/outputs/apk/debug/app-debug.apk
```

---

## Architecture overview

| Layer | Location | Responsibility |
|-------|----------|----------------|
| **Domain** | `domain/` | Stopwatch engine, lap logic, time formatting — pure Kotlin, no Android deps |
| **ViewModel** | `StopwatchViewModel.kt` | Bridges domain ↔ UI; exposes `LiveData` |
| **Fragment** | `WebAppFragment.kt` | Hosts `WebView`, observes ViewModel, owns JS bridge |
| **Web front-end** | `assets/` | Rendering only; calls `NativeBridge.*` for all actions |

---

## Key design decisions

- **WebView as rendering layer** — the HTML/CSS/JS front-end is a pure display
  surface; it never owns timing state.
- **JS ↔ Native bridge** — `NativeBridge` (exposed via
  `WebView.addJavascriptInterface`) is the single seam between JavaScript and
  Kotlin.
- **No orientation recreation** — `android:configChanges` on the Activity
  prevents a full WebView reload on rotation.
