package com.clockstopper.app

import android.os.Bundle
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.fragment.app.commit
import com.clockstopper.app.databinding.ActivityMainBinding

/**
 * Single-Activity shell that owns the Fragment back-stack and fulfils the
 * [NavigationHost] contract so that any hosted Fragment can request navigation
 * transitions without coupling itself to [MainActivity] directly.
 *
 * Navigation flow
 * ───────────────
 *  Launch  →  [WebAppFragment]  (root — never added to back-stack)
 *                ↕  navigateTo(…, addToBackStack = true)
 *             [future detail / settings Fragments …]
 *
 * The root destination ([WebAppFragment]) is only committed once — on the very
 * first `onCreate` call.  On subsequent recreations (e.g. configuration changes
 * or system-initiated process-death restore) the FragmentManager restores its
 * own state automatically, so the commit is guarded behind a null-check on
 * `savedInstanceState`.
 *
 * Back-press priority
 * ───────────────────
 *  1. Current Fragment handles it in-page (e.g. WebView history).
 *  2. Fragment back-stack is popped.
 *  3. Activity finishes.
 */
class MainActivity : AppCompatActivity(), NavigationHost {

    private lateinit var binding: ActivityMainBinding

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Keep the screen on for as long as this Activity is in the foreground
        // (mirrors the WAKE_LOCK permission declared in the manifest).
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Only set the root Fragment on a fresh launch — the FragmentManager
        // will restore the correct Fragment stack on configuration changes and
        // process-death restores.
        if (savedInstanceState == null) {
            navigateTo(
                fragment       = WebAppFragment.newInstance(),
                addToBackStack = false,  // root destination — never back-stackable
            )
        }
    }

    // -------------------------------------------------------------------------
    // NavigationHost — public API for Fragments
    // -------------------------------------------------------------------------

    /**
     * Replace [R.id.fragmentContainer] with [fragment].
     *
     * Uses the `androidx.fragment.app.commit` DSL which performs
     * `commitAllowingStateLoss` only when necessary (it is safe to call from
     * `onCreate`).
     */
    override fun navigateTo(
        fragment: Fragment,
        addToBackStack: Boolean,
        tag: String,
    ) {
        supportFragmentManager.commit {
            setReorderingAllowed(true)
            replace(R.id.fragmentContainer, fragment, tag)
            if (addToBackStack) {
                addToBackStack(tag)
            }
        }
    }

    /**
     * Pop the top Fragment back-stack entry.
     *
     * @return `true` if an entry was popped; `false` if the stack was empty.
     */
    override fun navigateBack(): Boolean =
        if (supportFragmentManager.backStackEntryCount > 0) {
            supportFragmentManager.popBackStack()
            true
        } else {
            false
        }

    // -------------------------------------------------------------------------
    // Back navigation
    // -------------------------------------------------------------------------

    /**
     * Back-press handling in priority order:
     *  1. Give the currently visible Fragment a chance to handle it
     *     (e.g. [WebAppFragment] navigating back through WebView history).
     *  2. Pop the Fragment back-stack.
     *  3. Delegate to the system (finishes the Activity).
     */
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        // 1. Fragment-level back handling (e.g. in-page WebView history)
        val currentFragment = supportFragmentManager
            .findFragmentById(R.id.fragmentContainer)

        if (currentFragment is WebAppFragment && currentFragment.handleBackPress()) {
            return
        }

        // 2. Fragment back-stack
        if (navigateBack()) {
            return
        }

        // 3. System default (finish)
        @Suppress("DEPRECATION")
        super.onBackPressed()
    }
}
