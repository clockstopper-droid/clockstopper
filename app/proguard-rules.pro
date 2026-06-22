# ProGuard / R8 rules for clockstopper-droid
# ─────────────────────────────────────────────────────────────────────────────

# ── Keep application entry-points ────────────────────────────────────────────

-keep public class com.clockstopper.app.MainActivity { *; }

# ── JavaScript interface bridge ───────────────────────────────────────────────
# Methods annotated @JavascriptInterface must not be renamed or removed;
# the WebView calls them by their exact name from JavaScript.

-keepclassmembers class com.clockstopper.app.MainActivity$AudioBridge {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep the outer class so the inner class reference is valid
-keep class com.clockstopper.app.MainActivity$AudioBridge { *; }

# ── Audio routing ─────────────────────────────────────────────────────────────

-keep class com.clockstopper.app.AudioRoutingManager { *; }
-keep interface com.clockstopper.app.AudioRoutingManager$AudioRoutingCallback { *; }

# ── AndroidX Media / MediaSession ─────────────────────────────────────────────

-keep class androidx.media.** { *; }
-keep class android.support.v4.media.** { *; }

# MediaButtonReceiver must survive shrinking so headset button intents are received
-keep class androidx.media.session.MediaButtonReceiver { *; }

# ── Navigation component ──────────────────────────────────────────────────────

-keep class androidx.navigation.** { *; }

# ── ViewModel / LiveData ──────────────────────────────────────────────────────

-keep class * extends androidx.lifecycle.ViewModel { *; }
-keepclassmembers class * extends androidx.lifecycle.ViewModel {
    <init>(...);
}

# ── RecyclerView adapter ──────────────────────────────────────────────────────

-keep class com.clockstopper.app.LapAdapter { *; }

# ── Domain layer ──────────────────────────────────────────────────────────────

-keep class com.clockstopper.app.domain.** { *; }

# ── General Android rules ─────────────────────────────────────────────────────

# Preserve all Parcelable implementations
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Preserve Serializable classes (used by some Jetpack internals)
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# Kotlin metadata — keep for reflection
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes SourceFile,LineNumberTable

# Kotlin coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
