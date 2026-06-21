package com.clockstopper.app

import androidx.fragment.app.Fragment

/**
 * Contract implemented by [MainActivity] that allows any hosted [Fragment] to
 * request navigation actions without holding a direct reference to the Activity.
 *
 * Usage from a Fragment:
 * ```kotlin
 * (requireActivity() as NavigationHost).navigateTo(SomeFragment(), addToBackStack = true)
 * ```
 */
interface NavigationHost {

    /**
     * Replace the current Fragment in the primary container with [fragment].
     *
     * @param fragment      The destination [Fragment] to display.
     * @param addToBackStack When `true` the current Fragment is pushed onto the
     *                       back-stack so the user can navigate back to it with
     *                       the hardware/gesture back action.  Pass `false` for
     *                       root-level destinations that should not be back-stackable.
     * @param tag            Optional back-stack / fragment tag.  Defaults to the
     *                       simple class name of [fragment].
     */
    fun navigateTo(
        fragment: Fragment,
        addToBackStack: Boolean = true,
        tag: String = fragment::class.java.simpleName,
    )

    /**
     * Pop the most-recent entry off the Fragment back-stack.
     *
     * @return `true` if a back-stack entry was popped, `false` if the stack
     *         was already empty (caller should finish the Activity).
     */
    fun navigateBack(): Boolean
}
