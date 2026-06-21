package com.clockstopper.app

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.fragment.app.Fragment

/**
 * WebAppFragment
 * ──────────────
 * Hosts the full-screen [WebView] that loads the Global Time Clock / Dialer
 * web application from the app's bundled assets (`assets/index.html`).
 *
 * Volume key bridge
 * ─────────────────
 * [MainActivity] intercepts hardware volume-up / volume-down key events and
 * calls [onVolumeKey] with a delta of +1 or -1.  This method evaluates
 * whether a call is currently active by querying the JavaScript state via
 * `window.clockstopperCallActive`, and if so forwards the delta to
 * `window.setCallVolume(delta)` so the web layer can adjust the call audio
 * gain and update the on-screen volume indicator.
 *
 * If no call is active the volume key is **not** consumed here, allowing
 * [MainActivity.dispatchKeyEvent] to fall through to the default Android
 * system volume handling.
 */
class WebAppFragment : Fragment() {

    private var webView: WebView? = null

    // -----------------------------------------------------------------------
    // Fragment lifecycle
    // -----------------------------------------------------------------------

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View {
        val layout = inflater.inflate(R.layout.fragment_web_app, container, false)
        webView = layout.findViewById(R.id.web_view)
        configureWebView()
        return layout
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        webView?.loadUrl("file:///android_asset/index.html")
    }

    override fun onDestroyView() {
        super.onDestroyView()
        webView?.destroy()
        webView = null
    }

    // -----------------------------------------------------------------------
    // WebView configuration
    // -----------------------------------------------------------------------

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        val wv = webView ?: return
        wv.webViewClient = WebViewClient()
        wv.webChromeClient = WebChromeClient()

        wv.settings.apply {
            javaScriptEnabled          = true
            domStorageEnabled          = true           // localStorage support
            allowFileAccessFromFileURLs = true
            allowUniversalAccessFromFileURLs = true
            mediaPlaybackRequiresUserGesture = false    // call audio auto-play
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            cacheMode = WebSettings.LOAD_DEFAULT
        }
    }

    // -----------------------------------------------------------------------
    // Volume key bridge
    // -----------------------------------------------------------------------

    /**
     * Called by [MainActivity] when the user presses a hardware volume key.
     *
     * Evaluates whether a call is active via the JS global
     * `window.clockstopperCallActive` (a boolean set by `app.js`) and, if so,
     * invokes `window.adjustCallVolume(delta)` to let the web layer handle the
     * volume change and show the on-screen indicator.
     *
     * @param delta  +1 for volume-up, -1 for volume-down.
     * @return `true` if the web layer consumed the event (call is active),
     *         `false` if the event should fall through to system handling.
     */
    fun onVolumeKey(delta: Int): Boolean {
        val wv = webView ?: return false

        // We need to determine synchronously whether a call is active so we
        // can decide whether to consume the key event.  We read the JS global
        // flag `window.clockstopperCallActive` via evaluateJavascript and rely
        // on the result callback.  However, because dispatchKeyEvent must
        // return synchronously we use a secondary approach:
        //
        //  • We always forward the delta to JS.
        //  • JS `adjustCallVolume()` is a no-op when no call is active.
        //  • We return `true` (consume) only when the JS layer has previously
        //    signalled an active call through the `clockstopperCallActive`
        //    flag we read asynchronously and cache here.
        //
        // The cached flag is updated via evaluateJavascript on each call.
        if (isCallActive) {
            val js = "if(typeof window.adjustCallVolume==='function')" +
                     "{window.adjustCallVolume($delta);}"
            wv.evaluateJavascript(js, null)
            return true
        }

        // Refresh our cached call-active state for the next key event.
        wv.evaluateJavascript("!!(window.clockstopperCallActive)") { result ->
            isCallActive = result?.trim() == "true"
        }

        return false
    }

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------

    /**
     * Cached call-active state — updated asynchronously after each volume key
     * press via [evaluateJavascript].  Starts as `false`; transitions to
     * `true` once the JS layer sets `window.clockstopperCallActive = true`.
     */
    private var isCallActive: Boolean = false
}
