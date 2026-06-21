package com.clockstopper.app

import androidx.navigation.NavController

/**
 * NavigationHost
 * ──────────────
 * Marker interface implemented by any Activity that acts as a host for a
 * Jetpack Navigation graph.
 *
 * Fragments that need to trigger navigation actions can retrieve the host
 * Activity, cast it to [NavigationHost], and obtain the [NavController]
 * without coupling themselves to a concrete Activity class.
 *
 * Usage from a Fragment
 * ─────────────────────
 * ```kotlin
 * val navController = (requireActivity() as NavigationHost).navController
 * navController.navigate(R.id.action_stopwatch_to_settings)
 * ```
 *
 * In practice Fragments should prefer
 * `findNavController()` (the Navigation KTX extension) for navigation within
 * their own back-stack; this interface is provided for edge cases where the
 * Activity-level controller is explicitly required.
 */
interface NavigationHost {
    /** The [NavController] that drives the navigation graph hosted by this Activity. */
    val navController: NavController
}
