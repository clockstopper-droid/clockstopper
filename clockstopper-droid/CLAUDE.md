# Android Project – clockstopper-droid

## Build Commands
```bash
# From the clockstopper-droid/ directory:
./gradlew assembleDebug        # compile debug APK
./gradlew assembleRelease      # compile release APK
./gradlew test                 # run unit tests
./gradlew connectedAndroidTest # run instrumented tests (needs emulator/device)
./gradlew lint                 # run lint checks
./gradlew clean                # clean build outputs
```

## Project Layout
```
clockstopper-droid/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/clockstopper/app/   ← Kotlin/Java source
│   │   │   ├── res/                          ← Android resources
│   │   │   │   ├── layout/
│   │   │   │   ├── values/
│   │   │   │   └── drawable/
│   │   │   └── assets/                       ← Web assets (HTML/CSS/JS)
│   │   ├── test/                             ← JVM unit tests
│   │   └── androidTest/                      ← Instrumented tests
│   └── build.gradle
├── build.gradle
├── settings.gradle
├── gradle.properties
└── gradle/wrapper/
    ├── gradle-wrapper.jar
    └── gradle-wrapper.properties
```

## SDK Versions
- compileSdk  : 34
- minSdk      : 24  (Android 7.0, ~96 % device coverage)
- targetSdk   : 34

## Key Dependencies
- AndroidX AppCompat
- AndroidX WebView (loads the existing HTML/CSS/JS app)
- Material Components
- AndroidX Core KTX

## Architecture Notes
The app shell is a thin **WebView** wrapper that loads the existing
`clockstopper` web application from the `assets/` directory.
All stopwatch logic lives in `assets/js/app.js`.
