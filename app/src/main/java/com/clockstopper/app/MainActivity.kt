package com.clockstopper.app

import android.os.Bundle
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import androidx.navigation.NavController
import androidx.navigation.fragment.NavHostFragment
import com.clockstopper.app.databinding.ActivityMainBinding

/**
 * MainActivity
 * ────────────
 * The single Activity that hosts the entire Clockstopper application.
 *
 * Responsibilities
 * ────────────────
 * 1. Inflate `activity_main.xml` which contains the [NavHostFragment] container.
 * 2. Obtain the [NavController] from the [NavHostFragment] and store it for any
 *    future top-level navigation needs (e.g. action-bar up-navigation).
 * 3. Apply `FLAG_KEEP_SCREEN_ON` so the display stays on while the stopwatch
 *    is actively counting — the Fragment UI does not need to manage this flag
 *    independently.
 * 4. Handle configuration changes declared in `AndroidManifest.xml`
 *    (`orientation`, `keyboard`, `screenSize`, etc.) without destroying the
 *    Activity — preserving the NavController back-stack and ViewModel state.
 *
 * What it does NOT do
 * ───────────────────
 * - Contains no stopwatch business logic (that lives in [domain]).
 * - Contains no UI state (that lives in [StopwatchViewModel]).
 * - Performs no direct Fragment transactions (NavController owns those).
 */
class MainActivity : AppCompatActivity() {

    // View binding for activity_main.xml
    private lateinit var binding: ActivityMainBinding

    // NavController resolved from the NavHostFragment; exposed so subclasses or
    // helper utilities can reach it without needing to find it themselves.
    private lateinit var navController: NavController

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Keep the screen on while this Activity is in the foreground.
        // The stopwatch is the primary use-case; losing the display mid-race
        // would be a poor experience. WAKE_LOCK permission is declared in the
        // manifest for devices that require it.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Inflate the root layout via ViewBinding.
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Resolve the NavController from the NavHostFragment declared in
        // activity_main.xml.  Using supportFragmentManager.findFragmentById
        // is the recommended approach when the NavHostFragment is defined in XML.
        val navHostFragment = supportFragmentManager
            .findFragmentById(R.id.nav_host_fragment) as NavHostFragment
        navController = navHostFragment.navController
    }

    // -----------------------------------------------------------------------
    // Up / back navigation
    // -----------------------------------------------------------------------

    /**
     * Delegate the system Back button to the [NavController] so it can manage
     * the Fragment back-stack correctly.  Falls back to the default super
     * implementation if the NavController does not consume the event (e.g. when
     * the back-stack is empty and the app should exit).
     */
    @Suppress("DEPRECATION") // onBackPressed still required for API < 33
    override fun onBackPressed() {
        if (!navController.navigateUp()) {
            super.onBackPressed()
        }
    }
}
