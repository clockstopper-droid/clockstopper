package com.clockstopper.app

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity

/**
 * OverlayPermissionManager
 * ────────────────────────
 * Manages the lifecycle of the `SYSTEM_ALERT_WINDOW` (overlay) permission —
 * the special Android permission that allows this app to draw a floating HUD
 * (e.g. an always-on call status overlay or incoming-call screen) over other
 * running applications.
 *
 * Why this class is necessary
 * ───────────────────────────
 * Unlike normal "dangerous" permissions, `SYSTEM_ALERT_WINDOW` cannot be
 * granted through the standard `requestPermissions()` / `onRequestPermissionsResult()`
 * flow.  On API 23+ the user must navigate to the system "Display over other
 * apps" settings page and toggle the switch manually.  This class:
 *
 *   1. Checks whether the permission is already granted via
 *      `Settings.canDrawOverlays()`.
 *   2. Shows a plain-language rationale dialog explaining WHY the app needs
 *      the permission and what it will be used for, before redirecting the
 *      user to the system settings screen.
 *   3. Launches `Settings.ACTION_MANAGE_OVERLAY_PERMISSION` and observes the
 *      result via an `ActivityResultLauncher`.
 *   4. Reports the final grant / deny state back to the caller via
 *      [OverlayPermissionCallback].
 *   5. Remembers whether the user has already permanently declined so that the
 *      rationale dialog is not shown repeatedly (stored in SharedPreferences).
 *   6. Degrades gracefully: if the permission is denied, all overlay-dependent
 *      features are simply skipped — the core dialer and clock functions
 *      continue to work normally.
 *
 * Usage
 * ─────
 *   // In your AppCompatActivity.onCreate():
 *   val overlayMgr = OverlayPermissionManager(this, object : OverlayPermissionManager.OverlayPermissionCallback {
 *       override fun onOverlayGranted()  { enableOverlayFeatures() }
 *       override fun onOverlayDenied(permanent: Boolean) { disableOverlayFeatures() }
 *   })
 *
 *   // To kick off the flow (e.g. on first launch or when a feature that
 *   // requires overlay is triggered):
 *   overlayMgr.requestOverlayPermission()
 *
 *   // To check current state without prompting:
 *   val granted = overlayMgr.isGranted()
 *
 * Platform behaviour
 * ──────────────────
 *  • API < 23 : `SYSTEM_ALERT_WINDOW` is granted at install time — no runtime
 *    check needed.  [isGranted] always returns `true`.
 *  • API 23–28: `Settings.canDrawOverlays()` reflects actual state.  The system
 *    settings page is opened via `ACTION_MANAGE_OVERLAY_PERMISSION`.
 *  • API 29+  : Same as above.  On some OEM skins the settings page may look
 *    slightly different but the flow is identical.
 */
class OverlayPermissionManager(
    private val activity: AppCompatActivity,
    private val callback: OverlayPermissionCallback
) {

    // ------------------------------------------------------------------
    // Callback interface
    // ------------------------------------------------------------------

    /**
     * Receives the result of the overlay permission flow.
     * Both methods are always called on the main thread.
     */
    interface OverlayPermissionCallback {
        /** The user has granted overlay permission (or it was already granted). */
        fun onOverlayGranted()

        /**
         * The user declined to grant overlay permission.
         * [permanent] is `true` when the user has previously declined and the
         * manager will no longer show the rationale dialog automatically.
         */
        fun onOverlayDenied(permanent: Boolean = false)
    }

    // ------------------------------------------------------------------
    // Constants
    // ------------------------------------------------------------------

    companion object {
        private const val TAG = "OverlayPermissionMgr"

        /** SharedPreferences file name. */
        private const val PREFS_NAME = "overlay_prefs"

        /** Key: number of times the user has dismissed / denied the rationale. */
        private const val KEY_DENY_COUNT = "overlay_deny_count"

        /**
         * After this many explicit dismissals / denials stop showing the
         * rationale dialog automatically.  The feature remains available via
         * a manual "Enable overlay" option in settings within the app.
         */
        private const val MAX_AUTO_PROMPTS = 2

        /** Request code used to identify our overlay settings result. */
        const val REQUEST_CODE_OVERLAY = 1001
    }

    // ------------------------------------------------------------------
    // Internal state
    // ------------------------------------------------------------------

    private val prefs: SharedPreferences =
        activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /**
     * ActivityResultLauncher registered with the Activity for the
     * Settings.ACTION_MANAGE_OVERLAY_PERMISSION result.
     *
     * Must be registered (called) during Activity creation — before
     * `onStart()`.  Register this in your Activity with:
     *
     *   private val overlayMgr = OverlayPermissionManager(this, callback)
     *
     * The launcher is stored here so it can be used from
     * [requestOverlayPermission].
     */
    val settingsLauncher: ActivityResultLauncher<Intent> =
        activity.registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { _ ->
            // The system settings screen has been closed — re-check state.
            handleSettingsResult()
        }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    /**
     * Returns `true` if the app currently holds the overlay permission.
     *
     * On API < 23 this always returns `true` (granted at install time).
     */
    fun isGranted(): Boolean {
        return if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            true
        } else {
            Settings.canDrawOverlays(activity)
        }
    }

    /**
     * Begin the overlay permission request flow.
     *
     *  • If already granted   → [OverlayPermissionCallback.onOverlayGranted] is
     *                           called immediately; no UI is shown.
     *  • If API < 23          → same as already-granted path.
     *  • If user has permanently declined → [OverlayPermissionCallback.onOverlayDenied]
     *                           is called with `permanent = true`; the rationale
     *                           dialog is suppressed.
     *  • Otherwise            → the rationale dialog is shown, then the system
     *                           settings screen is opened on confirmation.
     */
    fun requestOverlayPermission() {
        if (isGranted()) {
            Log.d(TAG, "Overlay permission already granted")
            callback.onOverlayGranted()
            return
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            Log.d(TAG, "Pre-API 23: overlay always granted")
            callback.onOverlayGranted()
            return
        }

        val denyCount = prefs.getInt(KEY_DENY_COUNT, 0)
        if (denyCount >= MAX_AUTO_PROMPTS) {
            Log.d(TAG, "User has declined $denyCount times — skipping rationale dialog")
            callback.onOverlayDenied(permanent = true)
            return
        }

        showRationaleDialog()
    }

    /**
     * Directly open the system "Display over other apps" settings page for
     * this app without showing the rationale dialog first.
     *
     * Use this for a "Grant overlay permission" button in the app's own
     * Settings screen, giving users a way to re-enable the feature after a
     * previous denial.
     */
    fun openOverlaySettings() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            callback.onOverlayGranted()
            return
        }
        Log.d(TAG, "Opening system overlay settings")
        val intent = buildSettingsIntent()
        try {
            settingsLauncher.launch(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open overlay settings: ${e.message}")
            callback.onOverlayDenied(permanent = false)
        }
    }

    /**
     * Reset the "permanent deny" counter so the rationale dialog will appear
     * again on the next call to [requestOverlayPermission].
     */
    fun resetDenyCount() {
        prefs.edit().putInt(KEY_DENY_COUNT, 0).apply()
        Log.d(TAG, "Deny count reset")
    }

    // ------------------------------------------------------------------
    // Private helpers
    // ------------------------------------------------------------------

    /**
     * Show a plain-language rationale dialog that explains:
     *  - what the overlay feature does,
     *  - why this app benefits from it,
     *  - that it is optional and the core app works without it.
     *
     * "Open settings" → opens the system settings page.
     * "Not now"       → records a denial and calls onOverlayDenied.
     */
    private fun showRationaleDialog() {
        AlertDialog.Builder(activity)
            .setTitle("Show over other apps?")
            .setMessage(
                "Global Time Clock can display a small call-status overlay " +
                "while you're using other apps — so you can see your active call " +
                "duration and hang up without switching back to the dialer.\n\n" +
                "To enable this, Android requires you to grant \"Display over " +
                "other apps\" permission in system settings.\n\n" +
                "This is optional. The dialer and clocks work perfectly without it."
            )
            .setPositiveButton("Open settings") { dialog, _ ->
                dialog.dismiss()
                Log.d(TAG, "User tapped 'Open settings' — launching overlay settings")
                openOverlaySettings()
            }
            .setNegativeButton("Not now") { dialog, _ ->
                dialog.dismiss()
                incrementDenyCount()
                val newCount = prefs.getInt(KEY_DENY_COUNT, 0)
                Log.d(TAG, "User tapped 'Not now' (deny count=$newCount)")
                callback.onOverlayDenied(permanent = newCount >= MAX_AUTO_PROMPTS)
            }
            .setCancelable(true)
            .setOnCancelListener {
                incrementDenyCount()
                val newCount = prefs.getInt(KEY_DENY_COUNT, 0)
                Log.d(TAG, "Rationale dialog cancelled (deny count=$newCount)")
                callback.onOverlayDenied(permanent = newCount >= MAX_AUTO_PROMPTS)
            }
            .show()
    }

    /**
     * Called after returning from the system settings screen.
     * Re-checks [isGranted] and dispatches the appropriate callback.
     */
    private fun handleSettingsResult() {
        if (isGranted()) {
            Log.d(TAG, "Overlay permission granted after settings")
            resetDenyCount()
            callback.onOverlayGranted()
        } else {
            Log.d(TAG, "Overlay permission still denied after settings")
            incrementDenyCount()
            val denyCount = prefs.getInt(KEY_DENY_COUNT, 0)
            callback.onOverlayDenied(permanent = denyCount >= MAX_AUTO_PROMPTS)
        }
    }

    private fun incrementDenyCount() {
        val current = prefs.getInt(KEY_DENY_COUNT, 0)
        prefs.edit().putInt(KEY_DENY_COUNT, current + 1).apply()
    }

    /**
     * Build the `Settings.ACTION_MANAGE_OVERLAY_PERMISSION` Intent scoped to
     * this app's package.
     */
    private fun buildSettingsIntent(): Intent =
        Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${activity.packageName}")
        )
}
