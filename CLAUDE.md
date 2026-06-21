# Clockstopper Android Project Context

## Project Overview
Android application project ("Clockstopper") with a structured Gradle build configuration.

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
│   │   │   ├── java/         # Application source code
│   │   │   ├── res/          # Android resources
│   │   │   └── AndroidManifest.xml
│   │   ├── test/             # Unit tests
│   │   └── androidTest/      # Instrumentation tests
│   ├── build.gradle          # App-level Gradle config
│   └── proguard-rules.pro
├── gradle/
│   └── wrapper/
│       ├── gradle-wrapper.jar
│       └── gradle-wrapper.properties
├── build.gradle              # Project-level Gradle config
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

## Conventions & Patterns
- **Total files committed in setup:** 23 files
- **PR workflow:** Tasks create feature branches, commit changes, and open PRs against `main_queued`
- **Branch naming:** `feat/<kebab-case-description>-<short-id>-queued`

## Android Configuration (to be confirmed from actual build files)
- Standard Android project layout following AOSP/Gradle conventions
- Separate `app` module as the primary application module
- ProGuard/R8 rules file present (`proguard-rules.pro`)

## Notes
- `local.properties` is typically gitignored and contains the local Android SDK path
- The project follows standard Android Studio project generation conventions
- 23 files were committed in the initial Gradle setup, suggesting a complete standard Android project scaffold