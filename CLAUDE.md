# Clockstopper Android Project Context

## Project Overview
Android application project ("Clockstopper") with a structured Gradle build configuration and a functional Activity entry point with navigation scaffolding. A domain layer has been extracted to encapsulate core business logic independently of the Android platform.

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
│   │   │   │       ├── MainActivity.kt         # Application entry point Activity
│   │   │   │       ├── domain/                 # Platform-independent business logic
│   │   │   │       │   ├── model/              # Domain model/data classes
│   │   │   │       │   ├── repository/         # Repository interfaces (abstractions)
│   │   │   │       │   └── usecase/            # Use case classes (business operations)
│   │   │   │       └── ...
│   │   │   ├── res/
│   │   │   │   ├── layout/                     # XML layout files
│   │   │   │   ├── navigation/                 # Navigation graph (NavController)
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
- **`AndroidManifest.xml`**: Declares `MainActivity` as the launcher Activity with `MAIN`/`LAUNCHER` intent filters
- **`MainActivity.kt`**: Primary Activity entry point; hosts the navigation host fragment

### Navigation
- Uses **Android Jetpack Navigation Component** (`NavController` / `NavHostFragment`)
- Navigation graph defined in `res/navigation/`
- `MainActivity` acts as the single-Activity host for fragment-based navigation

### Domain Layer
- Located at `[package]/domain/`
- **Platform-independent**: No Android framework imports; pure Kotlin
- **`model/`**: Domain data classes and entities representing core business concepts
- **`repository/`**: Abstract repository interfaces defining data access contracts; concrete implementations live outside the domain layer
- **`usecase/`**: Use case classes encapsulating discrete business operations; each use case has a single responsibility
- Designed to be testable via standard JUnit unit tests (no Android instrumentation required)
- Acts as the authoritative source of business rules; UI and data layers depend on the domain, not the other way around

## Conventions & Patterns
- **Total files committed in setup:** 23 files (initial scaffold) + 7 files (manifest/activity/navigation scaffolding) + 12 files (domain layer extraction)
- **PR workflow:** Tasks create feature branches, commit changes, and open PRs against `main_queued`
- **Branch naming:** `feat/<kebab-case-description>-<short-id>-queued`
- **Language:** Kotlin (confirmed by `MainActivity.kt`)
- **UI Pattern:** Single-Activity architecture with Jetpack Navigation Component managing fragment destinations
- **Layout:** XML-based layouts (not Jetpack Compose, based on navigation graph + layout directory presence)
- **Architecture Pattern:** Clean Architecture — domain layer is decoupled from platform; UI and data layers reference domain interfaces and models
- **Dependency Rule:** Dependencies point inward toward the domain; the domain layer has no dependencies on Android framework classes or outer layers
- **Repository Pattern:** Data access is abstracted behind interfaces defined in the domain layer; implementations are provided by the data layer
- **Use Cases:** Business operations are encapsulated in dedicated use case classes rather than embedded in ViewModels or Fragments

## Android Configuration (to be confirmed from actual build files)
- Standard Android project layout following AOSP/Gradle conventions
- Separate `app` module as the primary application module
- ProGuard/R8 rules file present (`proguard-rules.pro`)
- Jetpack Navigation Component dependency included in `app/build.gradle`

## Notes
- `local.properties` is typically gitignored and contains the local Android SDK path
- The project follows standard Android Studio project generation conventions
- Single-Activity architecture is established; new screens should be implemented as Fragments navigated via the NavController
- 23 files were committed in the initial Gradle setup, suggesting a complete standard Android project scaffold
- New business logic should be placed in the `domain/` layer as models, repository interfaces, or use cases before wiring up platform-specific implementations
- Domain layer unit tests should live in `app/src/test/` and require no Android instrumentation