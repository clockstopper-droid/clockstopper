# Clockstopper Android Project Context

## Project Overview
Android application project ("Clockstopper") with a structured Gradle build configuration and a functional Activity entry point with navigation scaffolding. A domain layer has been extracted to encapsulate core business logic independently of the Android platform. UI components have been migrated to Android-compatible equivalents (Fragments, Views, etc.) wired into the navigation architecture. App launch and runtime behavior have been validated on an Android emulator. Core business logic has been extracted and ported into the domain layer with full use case coverage.

## Repository
- **Org/Repo:** `clockstopper-droid/clockstopper`
- **Primary Branch:** `main`
- **Queue Branch:** `main_queued`
- **Feature Branch Convention:** `feat/<description>-<id>-queued`

## Project Structure
```
clockstopper/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/
│   │   │   │   └── [package]/
│   │   │   │       ├── MainActivity.kt         # Application entry point Activity; NavHostFragment host
│   │   │   │       ├── domain/                 # Platform-independent business logic
│   │   │   │       │   ├── model/              # Domain model/data classes
│   │   │   │       │   ├── repository/         # Repository interfaces (abstractions)
│   │   │   │       │   └── usecase/            # Use case classes (business operations)
│   │   │   │       ├── ui/                     # UI layer: Fragments and related Android UI components
│   │   │   │       │   └── [screen]/           # Per-screen Fragment classes
│   │   │   │       └── ...
│   │   │   ├── res/
│   │   │   │   ├── layout/                     # XML layout files (per-Fragment and activity layouts)
│   │   │   │   ├── navigation/                 # Navigation graph (NavController destinations = Fragments)
│   │   │   │   └── values/                     # strings, colors, themes, etc.
│   │   │   └── AndroidManifest.xml             # App manifest, declares MainActivity as launcher
│   │   ├── test/                               # Unit tests (domain logic tested here)
│   │   └── androidTest/                        # Instrumentation tests
│   ├── build.gradle                            # App-level Gradle config
│   └── proguard-rules.pro
├── gradle/
│   └── wrapper/
│       ├── gradle-wrapper.jar
│       └── gradle-wrapper.properties
├── build.gradle                                # Project-level Gradle config
├── settings.gradle
├── gradle.properties
└── local.properties
```

## Build System
- **Build Tool:** Gradle with Android Gradle Plugin (AGP)
- **Wrapper:** Gradle Wrapper included in repo
- **Configuration Files:**
  - `build.gradle` (project-level): Top-level build configuration, dependency repositories
  - `app/build.gradle` (app-level): App-specific config including `compileSdk`, `minSdk`, `targetSdk`, dependencies
  - `settings.gradle`: Module inclusion
  - `gradle.properties`: Project-wide Gradle settings
  - `local.properties`: Local environment settings (not committed, contains SDK path)

## Architecture & Components

### Entry Point
- **`AndroidManifest.xml`**: Declares `MainActivity` as the launcher Activity with `MAIN`/`LAUNCHER` intent filters; this file is the authoritative declaration of the app's entry point and must remain consistent with `MainActivity.kt`
- **`MainActivity.kt`**: Primary Activity entry point; hosts the navigation host fragment; minimal logic — delegates all screen content to Fragments via NavController

### Navigation
- Uses **Android Jetpack Navigation Component** (`NavController` / `NavHostFragment`)
- Navigation graph defined in `res/navigation/`; all destinations are **Fragments**
- `MainActivity` acts as the single-Activity host for fragment-based navigation
- Screen transitions and back-stack management handled entirely by the NavController

### UI Layer
- Located at `[package]/ui/`
- UI components are **Android Fragments** with corresponding XML layouts in `res/layout/`
- Fragments are registered as destinations in the navigation graph
- UI components observe or interact with domain use cases (directly or via ViewModels)
- **No Jetpack Compose** — UI is XML-layout-based throughout

### Domain Layer
- Located at `[package]/domain/`
- **Platform-independent**: No Android framework imports; pure Kotlin
- **`model/`**: Domain data classes and entities representing core business concepts
- **`repository/`**: Abstract repository interfaces defining data access contracts; concrete implementations live outside the domain layer
- **`usecase/`**: Use case classes encapsulating discrete business operations; each use case has a single responsibility
- Designed to be testable via standard JUnit unit tests (no Android instrumentation required)
- Acts as the authoritative source of business rules; UI and data layers depend on the domain, not the other way around
- Core business logic has been fully extracted and ported into this layer (as of PR #7); domain use cases represent the canonical implementation of all business operations

### Runtime Validation
- App launch and runtime behavior have been validated on an Android emulator (as of PR #5)
- The navigation graph, Fragment destinations, and NavController wiring have been confirmed to function correctly at runtime
- MainActivity successfully hosts the NavHostFragment and the initial Fragment destination renders as expected
- No runtime crashes or navigation failures observed during emulator validation

## Conventions & Patterns
- **Total files committed in setup:** 23 files (initial scaffold) + 7 files (manifest/activity/navigation scaffolding) + 12 files (domain layer extraction) + 24 files (UI component migration) + 10 files (emulator validation) + 1 file (AndroidManifest.xml launcher activity update, PR #6) + 8 files (core business logic extraction and porting, PR #7)
- **PR workflow:** Tasks create feature branches, commit changes, and open PRs against `main_queued`
- **Branch naming:** `feat/<kebab-case-description>-<short-id>-queued`
- **Language:** Kotlin
- **UI Pattern:** Single-Activity architecture with Jetpack Navigation Component managing Fragment destinations
- **UI Implementation:** XML-based layouts; each screen is a Fragment with a paired layout file in `res/layout/`
- **Architecture Pattern:** Clean Architecture — domain layer is decoupled from platform; UI and data layers reference domain interfaces and models
- **Dependency Rule:** Dependencies point inward toward the domain; the domain layer has no dependencies on Android framework classes or outer layers
- **Repository Pattern:** Data access is abstracted behind interfaces defined in the domain layer; implementations are provided by the data layer
- **Use Cases:** Business operations are encapsulated in dedicated use case classes rather than embedded in ViewModels or Fragments; all core business logic should be expressed as use cases in `domain/usecase/`
- **Business Logic Convention:** All core business logic must live in the domain layer; no business rules should be embedded in Fragments, Activities, or ViewModels — these layers only coordinate and delegate to domain use cases
- **Fragment Convention:** New screens should be implemented as Fragments registered as destinations in the navigation graph; navigation between screens uses NavController actions
- **Manifest Convention:** `AndroidManifest.xml` must declare `MainActivity` with both `android.intent.action.MAIN` and `android.intent.category.LAUNCHER` intent filters to ensure correct app launch behavior; any new Activities must be explicitly declared in the manifest
- **Validation Convention:** Runtime behavior should be validated on an Android emulator after significant structural changes (navigation wiring, Fragment migration, architecture changes)
- **Domain Completeness Convention:** Before wiring up new UI features, ensure the corresponding domain models, repository interfaces, and use cases are defined first; the domain layer drives the design of outer layers

## Android Configuration (to be confirmed from actual build files)
- Standard Android project layout following AOSP/Gradle conventions
- Separate `app` module as the primary application module
- ProGuard/R8 rules file present (`proguard-rules.pro`)
- Jetpack Navigation Component dependency included in `app/build.gradle`

## Notes
- `local.properties` is typically gitignored and contains the local Android SDK path
- The project follows standard Android Studio project generation conventions
- Single-Activity architecture is established; new screens should be implemented as Fragments navigated via the NavController
- New business logic should be placed in the `domain/` layer as models, repository interfaces, or use cases before wiring up platform-specific implementations
- Domain layer unit tests should live in `app/src/test/` and require no Android instrumentation
- UI components have been migrated to Android-compatible equivalents; all screen content lives in Fragments under `ui/`, not in `MainActivity`
- When adding new UI features, create a Fragment + XML layout pair, register it in the navigation graph, and wire it to the domain layer via use cases
- App launch and end-to-end navigation have been verified at runtime on an emulator; the current state of the codebase is considered runtime-stable
- `AndroidManifest.xml` is the single source of truth for Activity declarations and app entry point configuration; changes to Activity class names or package structure must be reflected here
- Core business logic extraction and porting is complete as of PR #7; the domain layer is the authoritative home for all business rules and operations; future features should extend the domain layer first before implementing platform-specific code