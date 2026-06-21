package com.clockstopper.app

import androidx.navigation.NavController

/**
 * Contract implemented by Activities that host a [NavController].
 *
 * Fragments that need to trigger navigation actions (e.g. deep-links,
 * global actions) can obtain the [NavController] from their host Activity
 * by casting `requireActivity()` to [NavigationHost], keeping navigation
 * logic out of the Fragment's direct dependencies.
 *
 * Usage from a Fragment:
 * ```kotlin
 * (requireActivity() as NavigationHost).navController
 *     .navigate(R.id.action_stopwatch_to_settings)
 * ```
 *
 * [MainActivity] is the only current implementor.
 */
interface NavigationHost {
    val navController: NavController
}
