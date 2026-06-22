package com.clockstopper.app

import android.annotation.SuppressLint
import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.fragment.app.Fragment
import com.clockstopper.app.databinding.FragmentWebAppBinding

/**
 * WebAppFragment
 * ──────────────
 * Hosts the full-screen [WebView] that loads the Global Time Clock web app
 * from the bundled assets (`assets/index.html`).
 *
 * Responsibilities
 * ────────────────
 *  • Configure the [WebView] for the app (JavaScript enabled, DOM storage,
 *    file access to assets, viewport meta support).
 *  • Grant microphone permission requests from the web layer via
 *    [WebChromeClient.onPermissionRequest] — required for `getUserMedia()`.
 *  • Expose a [JavascriptInterface] (`Android`) so the JS layer can call
 *    native functions:
 *      - `Android.onCallStarted()`    → routes call audio via AudioRoutingManager
 *      - `Android.onCallEnded()`      → releases audio routing
 *      - `Android.requestOverlaySettings()` → opens system overlay settings
 *  • Notify [MainActivity.onWebViewReady] once the page has finished loading
 *    so that the overlay permission flow is kicked off at the right moment.
 *  • Provide [evaluateJs] for other components (MainActivity, AudioRoutingManager)
 *    to inject JS into the running page.
 */
class WebAppFragment : Fragment() {

    // ------------------------------------------------------------------
    // View binding
    // ------------------------------------------------------------------

    private var _binding: FragmentWebAppBinding? = null
    private val binding get() = _binding!!

    // ------------------------------------------------------------------
    // WebView reference
    // ------------------------------------------------------------------

    private var webView: WebView? = null

    // ------------------------------------------------------------------
    // Fragment lifecycle
    // ------------------------------------------------------------------

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentWebAppBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        webView = binding.webView
        setupWebView()
        webView?.loadUrl("file:///android_asset/index.html")
    }

    override fun onDestroyView() {
        super.onDestroyView()
        webView?.destroy()
        webView = null
        _binding = null
    }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    /**
     * Evaluate [script] in the WebView on the main thread.
     * No-ops if the WebView is null (fragment not yet visible / destroyed).
     */
    fun evaluateJs(script: String) {
        webView?.post {
            webView?.evaluateJavascript(script, null)
        }
    }

    // ------------------------------------------------------------------
    // WebView configuration
    // ------------------------------------------------------------------

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val wv = webView ?: return

        wv.settings.apply {
            javaScriptEnabled        = true
            domStorageEnabled        = true
            allowFileAccess          = true
            allowContentAccess       = true
            mediaPlaybackRequiresUserGesture = false
            cacheMode                = WebSettings.LOAD_DEFAULT
            setSupportMultipleWindows(false)
        }

        // Expose the JS → native bridge under the name "Android"
        wv.addJavascriptInterface(NativeBridge(), "Android")

        wv.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                Log.d(TAG, "WebView page finished: $url")
                // Notify MainActivity so it can kick off the overlay permission
                // flow and push initial overlay state to JS.
                (activity as? MainActivity)?.onWebViewReady()
            }
        }

        wv.webChromeClient = object : WebChromeClient() {
            /**
             * Grant microphone access to the web layer.
             * The Android-level RECORD_AUDIO permission must already be held
             * (requested via the standard runtime permission flow in MainActivity
             * or via the manifest for older API levels).
             */
            override fun onPermissionRequest(request: PermissionRequest) {
                val granted = request.resources.filter { resource ->
                    resource == PermissionRequest.RESOURCE_AUDIO_CAPTURE ||
                    resource == PermissionRequest.RESOURCE_VIDEO_CAPTURE
                }.toTypedArray()

                if (granted.isNotEmpty()) {
                    Log.d(TAG, "Granting WebView permission: ${granted.joinToString()}")
                    request.grant(granted)
                } else {
                    Log.d(TAG, "Denying unknown WebView permission request")
                    request.deny()
                }
            }
        }
    }

    // ------------------------------------------------------------------
    // JS ↔ Native bridge
    // ------------------------------------------------------------------

    /**
     * JavaScript interface exposed as `window.Android` inside the WebView.
     *
     * All methods are called on a background thread by the WebView runtime;
     * any UI or main-thread work must be `post`ed to the main looper.
     */
    inner class NativeBridge {

        /**
         * Called by JS when an outgoing call is connected.
         * Triggers audio focus request and headset routing.
         *
         * JS usage:  `Android.onCallStarted();`
         */
        @JavascriptInterface
        fun onCallStarted() {
            Log.d(TAG, "JS → onCallStarted")
            activity?.runOnUiThread {
                (activity as? MainActivity)?.onCallStarted()
            }
        }

        /**
         * Called by JS when a call ends (hang-up or remote disconnect).
         * Releases audio focus and restores normal audio mode.
         *
         * JS usage:  `Android.onCallEnded();`
         */
        @JavascriptInterface
        fun onCallEnded() {
            Log.d(TAG, "JS → onCallEnded")
            activity?.runOnUiThread {
                (activity as? MainActivity)?.onCallEnded()
            }
        }

        /**
         * Called by JS when the user taps "Enable overlay" in the web UI.
         * Opens the system "Display over other apps" settings page directly,
         * bypassing the rationale dialog (since the user has already made
         * an explicit choice to enable the feature).
         *
         * JS usage:  `Android.requestOverlaySettings();`
         */
        @JavascriptInterface
        fun requestOverlaySettings() {
            Log.d(TAG, "JS → requestOverlaySettings")
            activity?.runOnUiThread {
                (activity as? MainActivity)?.onJsRequestOverlaySettings()
            }
        }

        /**
         * Returns `true` if the app currently holds the overlay permission.
         * Useful for synchronous JS checks on page load before the async
         * `overlayPermissionChanged` event arrives.
         *
         * JS usage:  `const ok = Android.isOverlayGranted();`
         */
        @JavascriptInterface
        fun isOverlayGranted(): Boolean {
            val mainActivity = activity as? MainActivity ?: return false
            // overlayPermissionManager is accessed from a background thread here;
            // Settings.canDrawOverlays() is safe to call off the main thread.
            return mainActivity.overlayPermissionManager.isGranted()
        }
    }

    // ------------------------------------------------------------------
    // Companion
    // ------------------------------------------------------------------

    companion object {
        private const val TAG = "WebAppFragment"
    }
}
