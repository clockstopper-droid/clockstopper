# proguard-rules.pro
# ───────────────────
# Custom ProGuard / R8 rules for the Clockstopper release build.
#
# The default rules applied via getDefaultProguardFile('proguard-android-optimize.txt')
# handle the vast majority of AndroidX / Jetpack shrinking correctly.  These
# project-specific rules cover cases not addressed by the defaults.

# ── Kotlin serialisation / reflection ────────────────────────────────────────
# Keep Kotlin Metadata so reflection-based libraries (e.g. Moshi, Gson) can
# introspect data classes at runtime.
-keep class kotlin.Metadata { *; }

# ── Domain model data classes ─────────────────────────────────────────────────
# If domain models are ever serialised (e.g. saved to disk or sent over the
# network) their field names must not be obfuscated.
-keepclassmembers class com.clockstopper.app.domain.** {
    public <fields>;
    public <methods>;
}

# ── Jetpack Navigation ────────────────────────────────────────────────────────
# Fragment subclasses are instantiated reflectively by the navigation runtime;
# their constructors must be kept.
-keepclassmembers class * extends androidx.fragment.app.Fragment {
    public <init>(...);
}

# ── ViewBinding ───────────────────────────────────────────────────────────────
# Generated ViewBinding classes must not be renamed; the runtime looks them up
# by a predictable naming convention derived from the layout file name.
-keep class com.clockstopper.app.databinding.** { *; }

# ── Suppress warnings for missing classes in optional dependencies ────────────
-dontwarn org.bouncycastle.**
-dontwarn org.conscrypt.**
-dontwarn org.openjsse.**
