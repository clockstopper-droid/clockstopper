package com.clockstopper.app

import android.os.Bundle
import android.view.KeyEvent
import androidx.appcompat.app.AppCompatActivity
import androidx.navigation.NavController
import androidx.navigation.fragment.NavHostFragment

/**
 * MainActivity
 * ────────────
 * Single-Activity host for the WebView-based dialer UI.
 *
 * Volume key interception
 * ───────────────────────
 * When the user presses the hardware volume-up or volume-down key while the
 * app is in the foreground, we intercept those events and forward them to the
 * WebView via the JavaScript bridge instead of letting Android adjust the
 * system media/ring volume.  The WebView fragment exposes
 * `WebAppFragment.onVolumeKey(delta)` for this purpose.
 *
 * Volume keys are only forwarded during an active call; outside of a call the
 * default Android volume behaviour is preserved so the user can still adjust
 * system volumes normally.  The WebView's JS layer (`app.js`) decides whether
 * the current state warrants volume adjustment and ignores the event if not
 * in a call.
 */
class MainActivity : AppCompatActivity(), NavigationHost {

    // -----------------------------------------------------------------------
    // NavigationHost
    // -----------------------------------------------------------------------

    override val navController: NavController
        get() {
            val host = supportFragmentManager
                .findFragmentById(R.id.nav_host_fragment) as NavHostFragment
            return host.navController
        }

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
    }

    // -----------------------------------------------------------------------
    // Volume key interception
    // -----------------------------------------------------------------------

    /**
     * Intercept hardware volume-up / volume-down key presses.
     *
     * We pass a delta of **+1** for volume-up and **-1** for volume-down to
     * the currently attached [WebAppFragment].  If the fragment is not yet
     * attached or does not handle the event we fall back to the default
     * system behaviour so the user is never left without volume control.
     *
     * Only [KeyEvent.ACTION_DOWN] is forwarded; we ignore [KeyEvent.ACTION_UP]
     * to avoid double-firing on a single physical key press.
     */
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN) {
            val delta = when (event.keyCode) {
                KeyEvent.KEYCODE_VOLUME_UP   ->  1
                KeyEvent.KEYCODE_VOLUME_DOWN -> -1
                else                         ->  0
            }

            if (delta != 0) {
                val handled = forwardVolumeKeyToWebView(delta)
                if (handled) return true
                // If the web layer did not handle it fall through to system.
            }
        }
        return super.dispatchKeyEvent(event)
    }

    /**
     * Locate the [WebAppFragment] in the back-stack and delegate the volume
     * delta to it.
     *
     * @return `true` if the fragment accepted the event, `false` otherwise.
     */
    private fun forwardVolumeKeyToWebView(delta: Int): Boolean {
        val host = supportFragmentManager
            .findFragmentById(R.id.nav_host_fragment) as? NavHostFragment
            ?: return false

        val webFragment = host.childFragmentManager
            .fragments
            .filterIsInstance<WebAppFragment>()
            .firstOrNull()
            ?: return false

        return webFragment.onVolumeKey(delta)
    }
}
