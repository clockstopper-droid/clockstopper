# Clockstopper — App Launch & Runtime Validation Runbook

This document describes every validation step required to verify that the
Clockstopper Android app installs and runs correctly on an API 26+ emulator
or physical device.  It covers the automated test suite, manual spot-checks,
and a structured issue log for recording any runtime problems discovered
during validation.

---

## 1. Prerequisites

| Requirement | Notes |
|---|---|
| Android SDK installed | `local.properties` → `sdk.dir` must be set |
| API 26+ AVD or device | Minimum SDK is 26 (Android 8.0 Oreo) |
| ADB connection verified | `adb devices` should list the target device |
| Gradle wrapper present | `./gradlew --version` should print the Gradle version |
| Internet connectivity | Not required for core app functionality; required if WebView assets are remote |

### Recommended AVD Configuration

```
API Level   : 26 (minimum) → 34 (recommended for latest validation)
ABI         : x86_64
RAM         : 2048 MB
VM heap     : 512 MB
Screen      : Pixel 4 skin (1080 × 2280, 440 dpi) or equivalent
```

---

## 2. Build Verification

Run the following commands from the repository root before executing any tests.
All commands must exit with code `0`.

```bash
# 1. Clean prior build artefacts
./gradlew clean

# 2. Compile sources (no tests yet) — catches syntax / classpath errors
./gradlew :app:compileDebugKotlin

# 3. Run the full JVM unit-test suite
./gradlew :app:testDebugUnitTest

# 4. Assemble the debug APK
./gradlew :app:assembleDebug
```

Expected output for step 3:
```
BUILD SUCCESSFUL
  X tests completed, 0 failures, 0 skipped
```

If any build step fails, consult **Section 7 — Known Issues & Resolutions**
before proceeding.

---

## 3. Unit-Test Suite (JVM — no device required)

Test classes live under `app/src/test/`.

### 3.1 How to Run

```bash
./gradlew :app:testDebugUnitTest
# HTML report: app/build/reports/tests/testDebugUnitTest/index.html
```

### 3.2 Test Inventory

| Class | Area | Scenarios |
|---|---|---|
| `ExampleUnitTest` | Build sanity | Arithmetic baseline |
| `domain/LapAnalyzerTest` | `LapAnalyzer` | Empty list, single lap, two laps, multiple laps, identical durations, large N, LapSummary fields |
| `domain/StopwatchEngineTest` | `StopwatchEngine` | Initial state, start/stop/reset lifecycle, elapsed-time accumulation, lap splits, state invariants |
| `domain/TimeFormatterTest` | `TimeFormatter` | Zero, sub-second, 1-minute, 1-hour, 10-hour, structural consistency |

### 3.3 Pass Criteria

- Zero test failures.
- Zero test errors (exceptions thrown in test methods).
- All 3 domain test classes must execute (not skipped).

---

## 4. Instrumented Test Suite (device / emulator required)

Test classes live under `app/src/androidTest/`.

### 4.1 How to Run

```bash
# Ensure a device is connected and listed by adb
adb devices

./gradlew :app:connectedDebugAndroidTest
# HTML report: app/build/reports/androidTests/connected/index.html
```

### 4.2 Test Inventory

| Class | Area | Key Scenarios |
|---|---|---|
| `ExampleInstrumentedTest` | Package name | Confirms correct app context |
| `AppLaunchTest` | Launch & UI presence | Activity launch; NavHost visible; all 4 core buttons present; initial zeroed state |
| `NavigationSmokeTest` | Jetpack Navigation | NavController attached; start destination reached; nav graph inflates in isolation via `TestNavHostController` |
| `StopwatchWorkflowTest` | Core user workflows | Timer display changes (W-1); single lap (W-2); 3 laps (W-3); Start→Stop→Reset (W-4); rapid cycles (W-5); Lap button enable/disable (W-6) |
| `RuntimeDependencyTest` | Runtime deps | API level ≥ 26; PowerManager accessible; NavHostFragment inflates; RecyclerView adapter attached; ViewModel survives config-change; running stopwatch survives rotation |

### 4.3 Pass Criteria

- Zero test failures.
- `deviceMeetsMinimumApiLevel` must pass — if it fails, switch to an API 26+ AVD.
- `navGraphInflatesWithoutError` must pass — if it fails, inspect `res/navigation/nav_graph.xml`.
- `recyclerViewDependencyPresentAndAdapterAttached` must pass — confirms `LapAdapter` is wired in `onViewCreated`.

---

## 5. Manual Spot-Check Checklist

Perform these checks after all automated tests pass.  Use the checkboxes
as a sign-off record.

### 5.1 App Launch

- [ ] App installs from `app-debug.apk` without "Failure [INSTALL_FAILED_*]" errors.
- [ ] App launches to the Stopwatch screen within 3 seconds (cold start).
- [ ] No `FATAL EXCEPTION` in `adb logcat` during or after launch.
- [ ] Elapsed-time display shows "00:00.00" (or equivalent zeroed state).
- [ ] Start/Stop button labelled "Start" (or equivalent initial label).
- [ ] Lap button is **disabled** before the stopwatch is started.
- [ ] Reset button is present.
- [ ] Lap list RecyclerView is empty and visible.

### 5.2 Core Stopwatch Workflow

- [ ] Tap **Start** → timer begins counting up; button label changes to "Stop".
- [ ] Timer display updates at least once per second visually.
- [ ] Tap **Lap** while running → a lap row appears in the list with a lap number, split time, and cumulative time.
- [ ] Record 3 more laps → list shows 4 rows; lap numbers are sequential (1, 2, 3, 4).
- [ ] Best lap row is visually highlighted differently from worst lap row (if implemented).
- [ ] Tap **Stop** → timer freezes; button label changes back to "Start".
- [ ] Tap **Start** again → timer resumes from frozen value (not reset to zero).
- [ ] Tap **Stop** → timer freezes again.
- [ ] Tap **Reset** → timer returns to "00:00.00"; lap list is empty; Lap button is disabled.

### 5.3 Orientation / Configuration Change

- [ ] Rotate device to landscape while stopwatch is **stopped** → UI re-renders; state preserved (same elapsed time as before rotation).
- [ ] Rotate device to landscape while stopwatch is **running** → timer continues running after rotation; no crash; elapsed time is sensible.
- [ ] Rotate back to portrait → no crash; stopwatch state consistent.

### 5.4 Background / Foreground

- [ ] Press Home while stopwatch is **running** → app goes to background.
- [ ] Return to app within 30 s → stopwatch is still running; elapsed time has advanced.
- [ ] Press Home while stopwatch is **running** → wait > 1 min → return → elapsed time reflects actual elapsed time (ViewModel or engine accounts for background time).
- [ ] Press Back from the stopwatch screen → app exits cleanly (or navigates up if back-stack has entries).

### 5.5 Edge Cases

- [ ] Tap **Reset** without ever starting → no crash; display remains zeroed.
- [ ] Tap **Lap** without starting (if button is somehow enabled) → no crash; no phantom lap added.
- [ ] Tap **Start** / **Stop** very rapidly (5+ times per second) → no crash; final state is internally consistent.
- [ ] Record 50+ laps → RecyclerView scrolls smoothly; no OOM or lag.

---

## 6. Performance Spot-Checks

These checks do not have automated assertions; they rely on human observation
and `adb` tooling.

### 6.1 Startup Time

```bash
adb shell am start-activity -W -n com.clockstopper.app/.MainActivity
```

Observe `TotalTime` in the output.  Target: < 1500 ms (cold start on a mid-range device).

### 6.2 Memory

```bash
adb shell dumpsys meminfo com.clockstopper.app
```

After 5 minutes of running with 20 laps recorded, `TOTAL PSS` should be < 100 MB.

### 6.3 CPU While Idle (stopwatch stopped)

```bash
adb shell top -p $(adb shell pidof com.clockstopper.app)
```

While the stopwatch is **stopped**, CPU usage must be ≈ 0% — there should be
no active background work.

### 6.4 UI Thread Jank

Enable GPU rendering profiling on the device:
`Settings → Developer options → Profile GPU rendering → On screen as bars`

While the stopwatch is running and laps are being recorded, bars should remain
below the 16 ms green line for the vast majority of frames.

---

## 7. Known Issues & Resolutions

Document any runtime issues found during validation here.  Template:

| # | Severity | Symptom | Reproduction Steps | Root Cause | Status | Fix |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — |

### Severity Levels

| Level | Definition |
|---|---|
| **P0 — Blocker** | App crashes on launch or core workflow is completely broken |
| **P1 — Critical** | Core feature (start/stop/lap/reset) behaves incorrectly but app stays alive |
| **P2 — Major** | Incorrect UI state, layout glitch, data display error |
| **P3 — Minor** | Polish / cosmetic issue; does not affect functionality |

### Common Failure Modes & Resolutions

#### `ClassNotFoundException: com.clockstopper.app.StopwatchFragment`

**Cause:** Fragment class not registered in the nav graph or not reachable
from the application classpath (e.g. wrong package path in `nav_graph.xml`).

**Fix:** Verify `nav_graph.xml` destination `android:name` exactly matches the
fully-qualified class name.

---

#### `InflateException` on launch

**Cause:** XML layout references a `@style/`, `@color/`, `@drawable/`, or
`@string/` resource that does not exist.

**Fix:** Check `values/themes.xml`, `values/colors.xml`, and `values/strings.xml`
for the missing resource.  Also confirm drawable references in the layout file
actually exist under `res/drawable/`.

---

#### `NavController not found for id …`

**Cause:** The `app:navGraph` attribute in `activity_main.xml` does not match
`R.navigation.nav_graph`, or the FragmentContainerView `id` used in
`MainActivity.kt` differs from the view id targeted by
`Navigation.findNavController()`.

**Fix:** Ensure `activity_main.xml` has:
```xml
<androidx.fragment.app.FragmentContainerView
    android:id="@+id/nav_host_fragment"
    app:navGraph="@navigation/nav_graph"
    app:defaultNavHost="true" ... />
```
and that `MainActivity.kt` calls:
```kotlin
Navigation.findNavController(this, R.id.nav_host_fragment)
```

---

#### `IllegalStateException: Fragment … not associated with a fragment manager`

**Cause:** Fragment transaction executed after `onSaveInstanceState()` (e.g.
inside an async callback that fires after the Activity is backgrounded).

**Fix:** Guard all fragment transactions with `lifecycle.currentState.isAtLeast(STARTED)`.

---

#### RecyclerView adapter is `null` (test `D-5` fails)

**Cause:** `StopwatchFragment.onViewCreated` does not call
`binding.rvLaps.adapter = lapAdapter` before returning.

**Fix:** Ensure adapter assignment is unconditional in `onViewCreated`, not
deferred to a LiveData observer.

---

#### ViewModel state lost on rotation (test `D-6` fails)

**Cause:** ViewModel is constructed with `StopwatchViewModel()` (direct
constructor) rather than `by viewModels()` / `ViewModelProvider`.

**Fix:** Use:
```kotlin
private val viewModel: StopwatchViewModel by viewModels()
```
This ensures the ViewModelStore is shared across configuration changes.

---

## 8. CI Integration Notes

The instrumented tests require an emulator.  Add the following to your CI
pipeline (GitHub Actions example):

```yaml
- name: Run unit tests
  run: ./gradlew :app:testDebugUnitTest

- name: Start emulator (API 26)
  uses: reactivecircus/android-emulator-runner@v2
  with:
    api-level: 26
    arch: x86_64
    script: ./gradlew :app:connectedDebugAndroidTest
```

Artefacts to archive:
- `app/build/reports/tests/` (unit test HTML)
- `app/build/reports/androidTests/` (instrumented test HTML)

---

## 9. Sign-Off

| Step | Completed By | Date | Notes |
|---|---|---|---|
| Build verification (Section 2) | | | |
| Unit tests pass (Section 3) | | | |
| Instrumented tests pass (Section 4) | | | |
| Manual spot-check (Section 5) | | | |
| Performance spot-checks (Section 6) | | | |
| Issue log reviewed & P0/P1 closed (Section 7) | | | |
