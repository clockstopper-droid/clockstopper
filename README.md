# Clockstopper

> **Note:** The legacy web/desktop entry points (`Index.html`, `Css/Style.css`,
> `js/app.js`) have been removed from this directory. The project is
> **Android-only**; all active source lives under
> [`clockstopper-droid/`](../clockstopper-droid/).

## Android project

See [`clockstopper-droid/README.md`](../clockstopper-droid/README.md) for full
build and development instructions.

### Quick start

```bash
cd clockstopper-droid
./gradlew assembleDebug          # build debug APK
./gradlew test                   # run unit tests
./gradlew connectedAndroidTest   # run instrumented tests (device/emulator required)
```
