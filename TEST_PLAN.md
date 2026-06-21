# Clockstopper — Test Plan & Execution Runbook

## Table of Contents
1. [Overview](#overview)
2. [Feature Inventory](#feature-inventory)
3. [Test Suite Structure](#test-suite-structure)
4. [Coverage Threshold](#coverage-threshold)
5. [Test File Reference](#test-file-reference)
6. [Running the Tests](#running-the-tests)
7. [Coverage Report Generation](#coverage-report-generation)
8. [CI / Automated Enforcement](#ci--automated-enforcement)
9. [Adding New Tests](#adding-new-tests)
10. [Known Limitations](#known-limitations)

---

## Overview

This document defines the **complete test strategy for the Clockstopper Android application**.
It maps every critical user-facing feature to a concrete test, specifies the minimum acceptable
coverage threshold, and describes step-by-step procedures for running all tests and generating
coverage reports.

The test suite is divided into three tiers:

| Tier | Type | Location | Runner |
|---|---|---|---|
| **L1** | JVM Unit Tests | `app/src/test/` | JVM (`./gradlew test`) |
| **L2** | ViewModel Integration Tests | `app/src/test/` | JVM (`./gradlew test`) |
| **L3** | Instrumented / E2E Tests | `app/src/androidTest/` | Device/Emulator (`./gradlew connectedAndroidTest`) |

---

## Feature Inventory

The table below lists every critical user-facing feature identified from the project context
document and maps each to its test class(es).

| # | Feature | Description | Test Class(es) | Tier |
|---|---|---|---|---|
| F-01 | **Stopwatch Start** | Tapping Start begins timing; display updates | `StopwatchEngineTest`, `StopwatchViewModelTest`, `AppLaunchTest`, `StopwatchWorkflowTest` | L1, L2, L3 |
| F-02 | **Stopwatch Stop** | Tapping Stop pauses timing; elapsed time preserved | `StopwatchEngineTest`, `StopwatchViewModelTest`, `StopwatchWorkflowTest` | L1, L2, L3 |
| F-03 | **Stopwatch Reset** | Tapping Reset clears elapsed time and laps | `StopwatchEngineTest`, `StopwatchViewModelTest`, `StopwatchWorkflowTest` | L1, L2, L3 |
| F-04 | **Lap Recording** | Tapping Lap records split time; list updates | `StopwatchEngineTest`, `StopwatchViewModelTest`, `StopwatchWorkflowTest` | L1, L2, L3 |
| F-05 | **Elapsed-time display** | Timer shows MM:SS.cc / HH:MM:SS.cc correctly | `TimeFormatterTest`, `TimeFormatterEdgeCaseTest`, `StopwatchWorkflowTest` | L1, L3 |
| F-06 | **Lap list UI** | RecyclerView shows one row per lap | `StopwatchWorkflowTest`, `AppLaunchTest`, `RuntimeDependencyTest` | L3 |
| F-07 | **Lap analysis** | Best/worst/average lap statistics correct | `LapAnalyzerTest`, `LapAnalyzerEdgeCaseTest` | L1 |
| F-08 | **Multi-segment timing** | Elapsed time accumulates across Start/Stop cycles | `StopwatchEngineTest`, `StopwatchViewModelTest` | L1, L2 |
| F-09 | **Lap button state** | Lap disabled before start; enabled during run; disabled after reset | `StopwatchWorkflowTest` | L3 |
| F-10 | **Rapid Start/Stop** | No crash on rapid toggle cycles | `StopwatchWorkflowTest` | L3 |
| F-11 | **Configuration change** | ViewModel retains state across rotation | `RuntimeDependencyTest`, `StopwatchViewModelTest` | L2, L3 |
| F-12 | **Navigation graph** | NavHostFragment inflates; start destination reached | `NavigationSmokeTest`, `AppLaunchTest` | L3 |
| F-13 | **Call Duration Timer formatting** | MM:SS and HH:MM:SS format branches covered | `TimeFormatterTest`, `TimeFormatterEdgeCaseTest` | L1 |
| F-14 | **State model correctness** | StopwatchState invariants and copy semantics | `StopwatchStateTest` | L1 |
| F-15 | **Engine immutability** | Every engine method returns new state; no mutation | `StopwatchEngineConcurrencyTest` | L1 |
| F-16 | **Minimum API level** | App declares and enforces minSdk 26 | `RuntimeDependencyTest` | L3 |
| F-17 | **Platform services** | PowerManager, RecyclerView, ViewBinding available | `RuntimeDependencyTest` | L3 |

---

## Test Suite Structure

```
app/src/
├── test/java/com/clockstopper/app/
│   │
│   │── ExampleUnitTest.kt                          # Gradle task smoke check
│   │── StopwatchViewModelTest.kt                   # L2: ViewModel integration
│   │
│   └── domain/
│       ├── TimeFormatterTest.kt                    # L1: core formatting rules
│       ├── TimeFormatterEdgeCaseTest.kt            # L1: boundary/edge values
│       ├── StopwatchEngineTest.kt                  # L1: state machine logic
│       ├── StopwatchEngineConcurrencyTest.kt       # L1: immutability contracts
│       ├── StopwatchStateTest.kt                   # L1: value-object invariants
│       ├── LapAnalyzerTest.kt                      # L1: lap statistics
│       └── LapAnalyzerEdgeCaseTest.kt              # L1: lap statistics edge cases
│
└── androidTest/java/com/clockstopper/app/
    ├── ExampleInstrumentedTest.kt                  # Package name smoke check
    ├── AppLaunchTest.kt                            # L3: activity launch / UI smoke
    ├── StopwatchWorkflowTest.kt                    # L3: end-to-end workflows
    ├── NavigationSmokeTest.kt                      # L3: navigation graph
    └── RuntimeDependencyTest.kt                    # L3: runtime platform deps
```

### Test count summary

| Layer | File | Tests |
|---|---|---|
| L1 | `TimeFormatterTest` | 20 |
| L1 | `TimeFormatterEdgeCaseTest` | 9 |
| L1 | `StopwatchEngineTest` | 28 |
| L1 | `StopwatchEngineConcurrencyTest` | 6 |
| L1 | `StopwatchStateTest` | 11 |
| L1 | `LapAnalyzerTest` | 16 |
| L1 | `LapAnalyzerEdgeCaseTest` | 13 |
| L2 | `StopwatchViewModelTest` | 15 |
| L3 | `ExampleInstrumentedTest` | 1 |
| L3 | `AppLaunchTest` | 11 |
| L3 | `StopwatchWorkflowTest` | 10 |
| L3 | `NavigationSmokeTest` | 4 |
| L3 | `RuntimeDependencyTest` | 7 |
| **Total** | | **≈ 151** |

---

## Coverage Threshold

**Minimum required: 70 % instruction coverage** on the domain + ViewModel layer.

This threshold is enforced at two scopes:

| Scope | Rule | Threshold |
|---|---|---|
| **Per-class** | Every class in `com.clockstopper.app.domain.*` and `StopwatchViewModel` | ≥ 70 % instructions |
| **Bundle (overall)** | All non-generated, non-test application classes combined | ≥ 70 % instructions |

### Rationale

70 % was chosen as the minimum because:
- The domain layer (`StopwatchEngine`, `TimeFormatter`, `LapAnalyzer`, `StopwatchState`) is
  pure Kotlin with no Android dependencies — it is straightforward to achieve and maintain
  high coverage here (tests already drive it above 90 %).
- The UI layer (Fragment, Adapter) relies heavily on Android framework callbacks which are
  difficult to cover without instrumented tests running on a real device; the 70 % bundle
  threshold accommodates this lower-coverage UI layer while still requiring the domain to
  be well-tested.
- The threshold is enforced automatically by `./gradlew check` via the
  `jacocoCoverageVerification` task (see below), so it gates every CI build.

### Excluded from coverage

The following generated/framework artefacts are excluded from all coverage calculations:

- `R.class` / `R$*.class` (resource IDs)
- `BuildConfig.*`
- `Manifest*.*`
- All `*Test*.*` files
- Navigation `*Directions*.*` / `*Args*.*` generated classes
- Data-binding generated classes

---

## Test File Reference

### L1 — JVM Unit Tests

#### `TimeFormatterTest`
Tests the `format()`, `formatLap()`, and `parse()` methods of `TimeFormatter`.

Key scenarios:
- Zero / sub-second values
- Exact minute and hour boundary transitions
- Absence of the hours segment for sub-hour durations
- Correct centisecond truncation
- `formatLap()` with and without lap number
- `parse()` round-trips (MM:SS.cc ↔ Long; HH:MM:SS.cc ↔ Long)
- `parse()` throws `IllegalArgumentException` for invalid input

#### `TimeFormatterEdgeCaseTest`
Boundary and stress tests for `TimeFormatter`:

- 9 ms → `"00:00.00"` (centisecond floor, not round)
- `3_599_990` ms still sub-hour
- `3_600_000` ms (exact 1-hour boundary)
- 24-hour and `Long.MAX_VALUE` do not throw

#### `StopwatchEngineTest`
Full state-machine coverage for `StopwatchEngine` using a `FakeClock`:

- `start()`: transitions to running, records `startedAtMs`, no-op if already running, preserves accumulated elapsed
- `stop()`: accumulates `elapsedMs`, resets sentinel fields, no-op when stopped, multi-segment accumulation
- `reset()`: always returns `INITIAL`, clears laps
- `tick()`: updates `currentSegmentMs` while running, no-op when stopped, `totalElapsedMs` correctness
- `lap()`: first lap, delta laps, 20-lap list, no-op when stopped, engine keeps running

#### `StopwatchEngineConcurrencyTest`
Immutability / value-semantics contracts:

- 8 concurrent `tick()` calls on the same state snapshot — no exception
- Sequential state chain produces deterministic results
- Every engine method returns a **new** instance (verified with `assertNotSame`)

#### `StopwatchStateTest`
Data class invariants for `StopwatchState.INITIAL`:

- All zero/sentinel initial values
- `copy()` semantics and field independence
- `totalElapsedMs` computed property
- Laps list isolation between copies

#### `LapAnalyzerTest`
Happy-path analysis of lap lists:

- Empty list → `null`
- Single lap: best = worst = average = that lap
- Two laps: best/worst/index selection, mean
- Three laps: correct identification of best, worst, average
- 100-lap list: boundary best at index 0, worst at index 99
- `totalElapsedMs` = sum of all laps

#### `LapAnalyzerEdgeCaseTest`
Tie-breaking, zero-duration laps, integer truncation, and count correctness.

---

### L2 — ViewModel Integration Tests

#### `StopwatchViewModelTest`
Exercises `StopwatchViewModel` with `FakeClock` injection and `InstantTaskExecutorRule`:

- Initial `INITIAL` state emitted on `observeForever`
- `onStartStop()`: transitions to/from running, accumulates time, notifies observer
- `onReset()`: returns to `INITIAL`, clears laps
- `onLap()`: records correct deltas, ignored when stopped
- `tick()`: updates `currentSegmentMs`, no-op when stopped
- State retained across observer re-subscription (simulates config change)

---

### L3 — Instrumented / Espresso Tests

#### `AppLaunchTest`
Smoke tests on a real device:

- `MainActivity` reaches `RESUMED` without crash
- `nav_host_fragment` displayed
- All four controls (`tv_elapsed_time`, `btn_start_stop`, `btn_lap`, `btn_reset`, `rv_laps`) visible
- Initial display is non-empty
- Start, Start+Stop, Start+Lap, Start+Stop+Reset — none crash

#### `StopwatchWorkflowTest`
End-to-end user workflows:

| ID | Workflow |
|---|---|
| W-1 | Start → wait 350 ms → display has changed |
| W-2 | Start → Lap → RecyclerView has ≥ 1 item |
| W-3 | Start → 3 Laps → RecyclerView has exactly 3 items |
| W-4 | Start → Lap → Stop → Reset → list empty, display zeroed |
| W-5 | 5 rapid Start/Stop cycles → no crash |
| W-6 | Lap button disabled before start |
| W-7 (W-6b) | Lap button enabled after start |
| W-7 | Lap button disabled after Reset |
| W-8 | Reset button visible before/during/after run |
| W-9 | 10 laps → RecyclerView has exactly 10 items |

#### `NavigationSmokeTest`
- NavController attached to host
- `currentDestination` non-null after launch
- `currentDestination.id == graph.startDestinationId`
- Graph inflates via `TestNavHostController` in isolation

#### `RuntimeDependencyTest`
- Device API ≥ 26
- `PowerManager` accessible
- `NavHostFragment` inflated
- `activity_main` layout inflated without `InflateException`
- `RecyclerView.adapter` non-null
- ViewModel survives `scenario.recreate()` (config change)
- Running stopwatch still ticks after `recreate()`

---

## Running the Tests

### Prerequisites

| Requirement | Notes |
|---|---|
| JDK 11+ | Required by Gradle |
| Android SDK 34 | `compileSdk` target |
| Android SDK 26+ device/emulator | Required for L3 tests only |
| Gradle wrapper | Use `./gradlew` (Unix) or `gradlew.bat` (Windows) |

All commands below are run from the **`clockstopper-droid/clockstopper/`** directory.

---

### Run L1 + L2 (JVM Unit Tests only)

```bash
./gradlew test
```

Runs all tests in `app/src/test/`.  
**No device required.**  
Results: `app/build/reports/tests/testDebugUnitTest/index.html`

To run a single test class:

```bash
./gradlew testDebugUnitTest --tests "com.clockstopper.app.domain.TimeFormatterTest"
```

To run a single test method:

```bash
./gradlew testDebugUnitTest \
  --tests "com.clockstopper.app.domain.StopwatchEngineTest.start transitions to running state"
```

---

### Run L3 (Instrumented / Espresso Tests)

Connect an API 26+ device or start an emulator, then:

```bash
./gradlew connectedAndroidTest
```

Runs all tests in `app/src/androidTest/`.  
Results: `app/build/reports/androidTests/connected/index.html`

To run a specific instrumented test class:

```bash
./gradlew connectedAndroidTest \
  -Pandroid.testInstrumentationRunnerArguments.class=com.clockstopper.app.StopwatchWorkflowTest
```

---

### Run All Tests (L1 + L2 + L3)

```bash
./gradlew test connectedAndroidTest
```

---

### Run with Coverage Enforcement

The following command runs all JVM unit tests **and** fails the build if coverage
drops below the 70 % threshold:

```bash
./gradlew check
```

`check` depends on `jacocoCoverageVerification`, which depends on `jacocoTestReport`,
which depends on `testDebugUnitTest`.

---

## Coverage Report Generation

### Generate the HTML + XML Jacoco report

```bash
./gradlew jacocoTestReport
```

Open the report:

```
app/build/reports/jacoco/jacocoTestReport/html/index.html
```

The XML report (consumed by CI tools) is at:

```
app/build/reports/jacoco/jacocoTestReport/jacocoTestReport.xml
```

### Verify the 70 % threshold without failing on other checks

```bash
./gradlew jacocoCoverageVerification
```

If coverage is below threshold the task fails with a message like:

```
Rule violated for bundle app: instructions covered ratio is 0.68,
but expected minimum is 0.70
```

---

## CI / Automated Enforcement

Add the following steps to your CI pipeline (GitHub Actions example):

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17
      - name: Run unit tests + coverage enforcement
        working-directory: clockstopper-droid/clockstopper
        run: ./gradlew check
      - name: Upload coverage report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: clockstopper-droid/clockstopper/app/build/reports/jacoco/

  instrumented-tests:
    runs-on: macos-latest         # macOS runners have hardware acceleration for AVDs
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17
      - name: Run instrumented tests (API 29 AVD)
        uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: 29
          working-directory: clockstopper-droid/clockstopper
          script: ./gradlew connectedAndroidTest
      - name: Upload instrumented test report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: instrumented-test-report
          path: clockstopper-droid/clockstopper/app/build/reports/androidTests/
```

---

## Adding New Tests

### When to add a test

Add a new test whenever:
- A new user-facing feature is introduced (add a row to the Feature Inventory table above)
- A bug is fixed (add a regression test reproducing the original failure)
- A refactor changes the public API of a domain class

### Choosing the right tier

| Scenario | Tier to use |
|---|---|
| Pure logic / computation (no Android APIs) | **L1** — `app/src/test/` |
| ViewModel / LiveData behaviour | **L2** — `app/src/test/` using `InstantTaskExecutorRule` |
| UI interaction, navigation, layout | **L3** — `app/src/androidTest/` using Espresso |

### Naming convention

- Test classes: `<SubjectClass>Test.kt` for happy path, `<SubjectClass>EdgeCaseTest.kt` for
  boundary/error cases
- Test methods: backtick-quoted descriptive sentences
  ```kotlin
  @Test
  fun `format exactly one second`() { ... }
  ```

### Keeping coverage above 70 %

After adding new production code:

1. Run `./gradlew jacocoTestReport` to see the current coverage.
2. Add tests for any new class/method that causes the per-class or bundle threshold to drop.
3. Confirm `./gradlew check` passes before opening a PR.

---

## Known Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| `StopwatchViewModelTest` requires `StopwatchViewModel(clock)` constructor | If the production ViewModel uses a default no-arg constructor without clock injection, the L2 tests must be adapted or a test-only factory added | Prefer constructor injection with a default `SystemClock` implementation |
| L3 tests require a physical device or emulator | Cannot run on plain CI without AVD setup | Use `reactivecircus/android-emulator-runner` on macOS CI runners |
| Jacoco does not collect coverage from instrumented tests by default | L3 test coverage is not included in the Jacoco HTML report | For combined coverage, use `createDebugCoverageReport` and merge `.ec` files — this is an advanced setup and not required for the 70 % gate |
| `TimeFormatter.format(Long.MAX_VALUE)` overflow behaviour is implementation-dependent | Edge case test documents the contract (must not throw) but the exact output string is not asserted | Acceptable — the contract is "no crash", not a specific display value |
| Web-layer JS tests (`app.js`, `Style.css`) are outside the Android test scope | The JavaScript dialer, connectivity panel, and clock logic are not covered by this test suite | Supplement with Jest or Playwright browser tests targeting `Index.html` for web-layer coverage |
