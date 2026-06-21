# Clockstopper Project Context

## Project Overview
An Android application called "Clockstopper" being built with modern Android development practices.

## Repository
- **Repo**: clockstopper-droid/clockstopper
- **Main branch**: `main_queued`
- **Working branch pattern**: `feat/<feature-name>` branches created from `main_queued_queued`

## Build System
- **Gradle** with Kotlin DSL (`.kts` files)
- Standard Android project structure with `app/` module
- Build configuration files committed: 6 files in the gradle setup task

### Key Build Files
- `build.gradle.kts` (root)
- `app/build.gradle.kts` (app module)
- `settings.gradle.kts`
- `gradle/wrapper/gradle-wrapper.properties`
- `gradlew` / `gradlew.bat`

## Project Structure
```
clockstopper/
├── build.gradle.kts
├── settings.gradle.kts
├── gradlew
├── gradlew.bat
├── gradle/
│   └── wrapper/
│       └── gradle-wrapper.properties
└── app/
    ├── build.gradle.kts
    └── src/
        └── main/
            ├── AndroidManifest.xml
            ├── java/          (or kotlin/)
            └── res/
```

## Architecture & Conventions
- Modern Android development with Kotlin
- Gradle Kotlin DSL preferred over Groovy DSL
- Standard Android single-module project structure (`app/` module)
- Standard Android source set layout: `app/src/main/` containing manifest, source, and resources

## Android Manifest
- `AndroidManifest.xml` located at `app/src/main/AndroidManifest.xml`
- Standard Android manifest structure established as part of directory scaffolding

## Branching Strategy
- Feature branches follow `feat/<description>` naming convention
- Branches are created from `main_queued_queued` (synced from `main_queued`)
- Changes are committed to feature branches for review/merge

## Development Status
- [x] Gradle build configuration and project structure set up
- [x] Android manifest and directory structure created (`app/src/main/` layout)
- [ ] Source code / application logic (pending)