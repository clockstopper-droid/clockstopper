# Add project-specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified in the
# Android SDK tools/proguard/proguard-android.txt file.

# Keep WebView JavaScript interface methods
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep the app's main classes
-keep class com.clockstopper.app.** { *; }
