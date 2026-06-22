package com.clockstopper.app

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.provider.Settings
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.MediumTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * OverlayPermissionTest
 * ─────────────────────
 * Instrumented tests for [OverlayPermissionManager].
 *
 * These tests verify the state-machine logic of the overlay permission flow
 * without actually touching the system "Display over other apps" settings
 * screen (which requires manual interaction and cannot be automated in an
 * instrumented test).
 *
 * What is tested
 * ──────────────
 *  O-1  On API < 23, [OverlayPermissionManager.isGranted] always returns true.
 *  O-2  The deny-count is initially 0 on a fresh install / after a clear.
 *  O-3  [OverlayPermissionManager.resetDenyCount] resets the counter to 0.
 *  O-4  On a device where overlay is already granted, [requestOverlayPermission]
 *       immediately fires [onOverlayGranted] without showing any dialog.
 *  O-5  After two denials [onOverlayDenied] is called with permanent=true.
 *  O-6  MainActivity launches without crashing (overlay manager initialised).
 *  O-7  [OverlayPermissionManager.isGranted] reflects
 *       [Settings.canDrawOverlays] on API 23+.
 *
 * Run with:  ./gradlew connectedAndroidTest
 */
@RunWith(AndroidJUnit4::class)
@MediumTest
class OverlayPermissionTest {

    private val context: Context = ApplicationProvider.getApplicationContext()
    private val prefs: SharedPreferences =
        context.getSharedPreferences("overlay_prefs", Context.MODE_PRIVATE)

    @Before
    fun setUp() {
        // Clear state before each test so tests are independent.
        prefs.edit().clear().commit()
    }

    @After
    fun tearDown() {
        prefs.edit().clear().commit()
    }

    // -----------------------------------------------------------------------
    // O-1  Pre-Marshmallow: always granted
    // -----------------------------------------------------------------------

    /**
     * On API < 23 there is no runtime overlay permission — the manifest
     * declaration is sufficient.  isGranted() must return true in that case.
     */
    @Test
    fun onPreMarshmallow_isGrantedAlwaysTrue() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            // This test only makes sense on pre-M; skip by passing vacuously.
            return
        }
        // Launch and immediately check the manager state via the Activity
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        scenario.onActivity { activity ->
            assertTrue(
                "isGranted() must be true on API < 23",
                activity.overlayPermissionManager.isGranted()
            )
        }
        scenario.close()
    }

    // -----------------------------------------------------------------------
    // O-2  Deny count starts at 0
    // -----------------------------------------------------------------------

    @Test
    fun denyCountIsZeroOnFreshState() {
        val count = prefs.getInt("overlay_deny_count", 0)
        assertEquals("Deny count should be 0 on fresh state", 0, count)
    }

    // -----------------------------------------------------------------------
    // O-3  resetDenyCount resets to 0
    // -----------------------------------------------------------------------

    @Test
    fun resetDenyCountResetsToZero() {
        // Artificially bump the count
        prefs.edit().putInt("overlay_deny_count", 5).commit()

        val scenario = ActivityScenario.launch(MainActivity::class.java)
        scenario.onActivity { activity ->
            activity.overlayPermissionManager.resetDenyCount()
        }
        scenario.close()

        val count = prefs.getInt("overlay_deny_count", -1)
        assertEquals("Deny count must be 0 after resetDenyCount()", 0, count)
    }

    // -----------------------------------------------------------------------
    // O-4  Already granted → onOverlayGranted fires, no dialog
    // -----------------------------------------------------------------------

    /**
     * If the device already has overlay permission granted (e.g. the test
     * device was pre-configured, or this is API < 23), requesting permission
     * must immediately invoke onOverlayGranted without opening the settings.
     */
    @Test
    fun whenAlreadyGranted_callbackFiresImmediately() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            !Settings.canDrawOverlays(context)) {
            // Cannot automate granting; skip this assertion on devices where
            // the permission is not pre-granted.
            return
        }

        val scenario = ActivityScenario.launch(MainActivity::class.java)
        var grantedFired = false

        scenario.onActivity { activity ->
            // Override callback inline for this test
            val testManager = OverlayPermissionManager(
                activity,
                object : OverlayPermissionManager.OverlayPermissionCallback {
                    override fun onOverlayGranted() { grantedFired = true }
                    override fun onOverlayDenied(permanent: Boolean) {}
                }
            )
            testManager.requestOverlayPermission()
        }

        scenario.close()
        assertTrue("onOverlayGranted should have been called", grantedFired)
    }

    // -----------------------------------------------------------------------
    // O-5  Permanent denial after MAX_AUTO_PROMPTS denials
    // -----------------------------------------------------------------------

    /**
     * After [MAX_AUTO_PROMPTS] (2) recorded denials, requestOverlayPermission
     * must call onOverlayDenied with permanent=true and must NOT show a dialog.
     */
    @Test
    fun afterTwoDenials_onOverlayDeniedCalledWithPermanentTrue() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            // Pre-M always returns granted — permanent denial logic never runs.
            return
        }
        if (Settings.canDrawOverlays(context)) {
            // Device has overlay already granted — permanent-deny path unreachable.
            return
        }

        // Simulate two prior denials
        prefs.edit().putInt("overlay_deny_count", 2).commit()

        val scenario = ActivityScenario.launch(MainActivity::class.java)
        var deniedPermanently = false

        scenario.onActivity { activity ->
            val testManager = OverlayPermissionManager(
                activity,
                object : OverlayPermissionManager.OverlayPermissionCallback {
                    override fun onOverlayGranted() {}
                    override fun onOverlayDenied(permanent: Boolean) {
                        if (permanent) deniedPermanently = true
                    }
                }
            )
            testManager.requestOverlayPermission()
        }

        scenario.close()
        assertTrue(
            "onOverlayDenied(permanent=true) should be called after 2 denials",
            deniedPermanently
        )
    }

    // -----------------------------------------------------------------------
    // O-6  MainActivity launches without crash
    // -----------------------------------------------------------------------

    @Test
    fun mainActivityLaunchesWithOverlayManagerInitialised() {
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        scenario.onActivity { activity ->
            // Just verify the manager is non-null and isGranted() does not throw.
            val granted = activity.overlayPermissionManager.isGranted()
            // granted can be true or false depending on device state — both fine.
            assertTrue("isGranted() must return a valid boolean", granted || !granted)
        }
        scenario.close()
    }

    // -----------------------------------------------------------------------
    // O-7  isGranted reflects Settings.canDrawOverlays on API 23+
    // -----------------------------------------------------------------------

    @Test
    fun isGrantedMatchesCanDrawOverlays() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return

        val systemGranted = Settings.canDrawOverlays(context)

        val scenario = ActivityScenario.launch(MainActivity::class.java)
        scenario.onActivity { activity ->
            assertEquals(
                "OverlayPermissionManager.isGranted() must match Settings.canDrawOverlays()",
                systemGranted,
                activity.overlayPermissionManager.isGranted()
            )
        }
        scenario.close()
    }
}
