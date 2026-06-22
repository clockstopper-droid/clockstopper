package com.clockstopper.app

import android.os.Build
import android.os.Bundle
import android.util.Log
import android.webkit.WebView
import androidx.appcompat.app.AppCompatActivity
import com.clockstopper.app.databinding.ActivityMainBinding

/**
 * MainActivity
 * ────────────
 * Single-Activity host for the Global Time Clock (clockstopper) app.
 *
 * Responsibilities
 * ────────────────
 *  • Inflate the root layout and set up Jetpack Navigation.
 *  • Initialise [AudioRoutingManager] for Bluetooth / wired headset routing.
 *  • Initialise [OverlayPermissionManager] and request the overlay permission
 *    on first launch so that the optional call-status HUD overlay can be
 *    shown over other apps.
 *  • Bridge overlay permission state changes to the WebView JS layer via
 *    [WebAppFragment.evaluateJs], so the web UI can reflect whether overlay
 *    features are available.
 *  • Delegate audio-routing callbacks to [AudioRoutingManager].
 *
 * Overlay permission flow
 * ───────────────────────
 * `SYSTEM_ALERT_WINDOW` is a *special* Android permission that cannot be
 * granted via `requestPermissions()`.  [OverlayPermissionManager] handles the
 * entire flow:
 *
 *   1. Check `Settings.canDrawOverlays()`.
 *   2. If not yet granted, show a plain-language rationale dialog.
 *   3. Open `Settings.ACTION_MANAGE_OVERLAY_PERMISSION` and observe the result.
 *   4. Call back here with granted / denied, which is forwarded to JS.
 *   5. If denied (including permanently), all overlay-dependent features are
 *      silently disabled — the core dialer and clock functions keep working.
 */
class MainActivity : AppCompatActivity(), AudioRoutingManager.AudioRoutingCallback {

    // ------------------------------------------------------------------
    // View binding
    // ------------------------------------------------------------------

    private lateinit var binding: ActivityMainBinding

    // ------------------------------------------------------------------
    // Managers
    // ------------------------------------------------------------------

    /**
     * Overlay permission manager.
     *
     * `internal` visibility so [WebAppFragment]'s JS bridge can call
     * [OverlayPermissionManager.isGranted] directly for synchronous checks.
     *
     * Instantiated as a lazy field property so that the [ActivityResultLauncher]
     * inside it is registered during Activity construction (before onStart),
     * satisfying the Jetpack Activity Result API contract.
     */
    internal val overlayPermissionManager: OverlayPermissionManager by lazy {
        OverlayPermissionManager(
            activity = this,
            callback = object : OverlayPermissionManager.OverlayPermissionCallback {

                override fun onOverlayGranted() {
                    Log.d(TAG, "Overlay permission granted — enabling overlay features")
                    notifyJsOverlayState(granted = true, permanent = false)
                }

                override fun onOverlayDenied(permanent: Boolean) {
                    Log.d(TAG, "Overlay permission denied (permanent=$permanent) — degrading gracefully")
                    notifyJsOverlayState(granted = false, permanent = permanent)
                }
            }
        )
    }

    private lateinit var audioRoutingManager: AudioRoutingManager

    // ------------------------------------------------------------------
    // Activity lifecycle
    // ------------------------------------------------------------------

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Enable WebView debugging in debug builds
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Initialise audio routing (registers BroadcastReceivers & callbacks)
        audioRoutingManager = AudioRoutingManager(this, this)
        audioRoutingManager.initialize()

        // Touch the lazy property so the ActivityResultLauncher is registered
        // before onStart, satisfying the Jetpack Activity Result API contract.
        // The actual permission flow is deferred to onWebViewReady().
        @Suppress("UNUSED_EXPRESSION")
        overlayPermissionManager
    }

    override fun onResume() {
        super.onResume()
        // Re-check overlay state every time the app comes to foreground —
        // the user may have toggled the setting in system settings.
        refreshOverlayState()
    }

    override fun onDestroy() {
        super.onDestroy()
        audioRoutingManager.release()
    }

    // ------------------------------------------------------------------
    // Overlay helpers
    // ------------------------------------------------------------------

    /**
     * Called by [WebAppFragment] once the WebView page has finished loading
     * and the JS runtime is ready to receive messages.
     *
     * Pushes the current overlay state to JS immediately, then starts the
     * permission request flow if overlay is not yet granted.
     */
    fun onWebViewReady() {
        refreshOverlayState()

        if (!overlayPermissionManager.isGranted()) {
            overlayPermissionManager.requestOverlayPermission()
        }
    }

    /**
     * Called by [WebAppFragment]'s JS interface when the user taps
     * "Enable overlay" in the web UI.
     *
     * Opens the system settings page directly — the user has already made an
     * explicit choice, so no rationale dialog is shown.
     */
    fun onJsRequestOverlaySettings() {
        overlayPermissionManager.openOverlaySettings()
    }

    /**
     * Re-read the current overlay permission state and push it to JS.
     * Safe to call at any time; no-ops quietly if the WebView is unavailable.
     */
    private fun refreshOverlayState() {
        val granted = overlayPermissionManager.isGranted()
        Log.d(TAG, "Refreshing overlay state: granted=$granted")
        notifyJsOverlayState(granted = granted, permanent = false)
    }

    /**
     * Dispatch a `overlayPermissionChanged` custom event into the WebView so
     * the JS layer can enable or disable overlay-dependent UI without polling.
     *
     * Event shape (TypeScript notation):
     * ```
     * interface OverlayPermissionChangedEvent extends CustomEvent {
     *   detail: {
     *     granted: boolean;   // true = permission held, false = denied
     *     permanent: boolean; // true = user has permanently declined
     *   }
     * }
     * ```
     */
    private fun notifyJsOverlayState(granted: Boolean, permanent: Boolean) {
        evaluateJs(
            "window.dispatchEvent(new CustomEvent('overlayPermissionChanged'," +
            "{detail:{granted:$granted,permanent:$permanent}}));"
        )
    }

    // ------------------------------------------------------------------
    // AudioRoutingManager.AudioRoutingCallback implementation
    // ------------------------------------------------------------------

    override fun onAudioDeviceChanged(deviceName: String, connected: Boolean) {
        Log.d(TAG, "Audio device changed: $deviceName connected=$connected")
        // JS is notified directly inside AudioRoutingManager via evaluateJs()
    }

    override fun onAudioFocusLost() {
        Log.d(TAG, "Audio focus lost")
    }

    override fun onAudioFocusGained() {
        Log.d(TAG, "Audio focus gained")
    }

    /**
     * Evaluate a JS expression in the currently active [WebAppFragment].
     *
     * Routes through [WebAppFragment] if it is visible; logs a warning
     * otherwise (the script is dropped — not queued).
     */
    override fun evaluateJs(script: String) {
        val fragment = supportFragmentManager.fragments
            .filterIsInstance<WebAppFragment>()
            .firstOrNull()
        fragment?.evaluateJs(script)
            ?: Log.w(TAG, "evaluateJs: WebAppFragment not found — script dropped: $script")
    }

    // ------------------------------------------------------------------
    // Call routing delegation (called by WebAppFragment JS interface)
    // ------------------------------------------------------------------

    /** Forward call-started notification from the JS layer. */
    fun onCallStarted() = audioRoutingManager.onCallStarted()

    /** Forward call-ended notification from the JS layer. */
    fun onCallEnded() = audioRoutingManager.onCallEnded()

    // ------------------------------------------------------------------
    // Companion
    // ------------------------------------------------------------------

    companion object {
        private const val TAG = "MainActivity"
    }
}
