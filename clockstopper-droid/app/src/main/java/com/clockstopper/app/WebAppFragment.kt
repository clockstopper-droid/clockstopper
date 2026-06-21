package com.clockstopper.app

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import com.clockstopper.app.databinding.FragmentWebAppBinding
import com.clockstopper.app.domain.TimeFormatter

/**
 * Fragment that hosts the Clockstopper WebView UI.
 *
 * ## Architecture
 * All timing business logic lives in the platform-agnostic domain layer
 * ([com.clockstopper.app.domain]).  This Fragment owns only two concerns:
 *
 * 1. **Android lifecycle** – inflate the layout, configure the [WebView], and
 *    observe [StopwatchViewModel] LiveData to keep the web front-end in sync.
 * 2. **JavaScript bridge** – expose a `NativeBridge` object to the web page so
 *    that button taps inside the WebView invoke the ViewModel's action handlers
 *    rather than duplicating timing logic in JavaScript.
 *
 * The web page (`assets/index.html`) therefore becomes a **pure rendering layer**:
 * it displays whatever the native domain layer tells it and forwards user gestures
 * back to Kotlin.
 *
 * ### JS → Native (JavaScript calls Kotlin)
 * ```javascript
 * NativeBridge.startStop();
 * NativeBridge.lap();
 * NativeBridge.reset();
 * ```
 *
 * ### Native → JS (Kotlin pushes display updates)
 * ```javascript
 * // Called by the fragment when the ViewModel emits a new display string:
 * updateDisplay(timeString, lapsJson);
 * ```
 */
class WebAppFragment : Fragment() {

    // -----------------------------------------------------------------------
    // ViewModel & View Binding
    // -----------------------------------------------------------------------

    private val viewModel: StopwatchViewModel by viewModels()

    private var _binding: FragmentWebAppBinding? = null
    private val binding get() = _binding!!

    // -----------------------------------------------------------------------
    // Fragment lifecycle
    // -----------------------------------------------------------------------

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View {
        _binding = FragmentWebAppBinding.inflate(inflater, container, false)
        return binding.root
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        configureWebView(binding.webView)
        observeViewModel()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    // -----------------------------------------------------------------------
    // WebView configuration
    // -----------------------------------------------------------------------

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView(webView: WebView) {
        webView.webViewClient = WebViewClient()

        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            // Restrict mixed-content; assets are served from file:// so this is safe.
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            // Disable unnecessary features that increase attack surface.
            allowFileAccessFromFileURLs = false
            allowUniversalAccessFromFileURLs = false
        }

        // Expose the bridge under the name "NativeBridge" so the web page can call
        // NativeBridge.startStop() etc. without knowing anything about Android.
        webView.addJavascriptInterface(JsBridge(), "NativeBridge")

        // Load the bundled web front-end from assets.
        webView.loadUrl("file:///android_asset/index.html")
    }

    // -----------------------------------------------------------------------
    // ViewModel observation
    // -----------------------------------------------------------------------

    private fun observeViewModel() {
        // Push display-time updates into the WebView whenever the domain layer emits.
        viewModel.displayTime.observe(viewLifecycleOwner) { timeString ->
            val lapsJson = buildLapsJson()
            pushDisplayUpdate(timeString, lapsJson)
        }
    }

    // -----------------------------------------------------------------------
    // Native → JS bridge
    // -----------------------------------------------------------------------

    /**
     * Serialise the current lap list to a JSON array string so it can be passed
     * into JavaScript without pulling in a JSON library.
     *
     * Example output: `["Lap 1  00:05.00","Lap 2  00:03.21"]`
     */
    private fun buildLapsJson(): String {
        val laps = viewModel.laps.value ?: emptyList()
        return "[" + laps.joinToString(",") { "\"${it.replace("\"", "\\\"")}\"" } + "]"
    }

    /**
     * Call the web page's `updateDisplay` function on the UI thread.
     *
     * The function signature expected in `assets/js/app.js`:
     * ```javascript
     * function updateDisplay(timeString, lapsJson) { … }
     * ```
     */
    private fun pushDisplayUpdate(timeString: String, lapsJson: String) {
        val js = "javascript:updateDisplay('$timeString', $lapsJson)"
        binding.webView.post {
            binding.webView.loadUrl(js)
        }
    }

    // -----------------------------------------------------------------------
    // JS → Native bridge
    // -----------------------------------------------------------------------

    /**
     * Object exposed to JavaScript as `window.NativeBridge`.
     *
     * Each method is annotated with [@JavascriptInterface] so the WebView's
     * JavaScript engine is aware it is a safe cross-layer call.
     *
     * **All methods are called on a background thread by the WebView engine**;
     * they delegate immediately to the ViewModel (which is thread-safe via
     * `viewModelScope` / `LiveData`) rather than touching any View directly.
     */
    private inner class JsBridge {

        /** Toggle start/stop on the domain-layer stopwatch. */
        @JavascriptInterface
        fun startStop() {
            requireActivity().runOnUiThread { viewModel.onStartStop() }
        }

        /** Record a lap split. */
        @JavascriptInterface
        fun lap() {
            requireActivity().runOnUiThread { viewModel.onLap() }
        }

        /** Reset the stopwatch to zero. */
        @JavascriptInterface
        fun reset() {
            requireActivity().runOnUiThread { viewModel.onReset() }
        }

        /**
         * Format a raw millisecond value using [TimeFormatter] from the domain layer.
         *
         * Exposed so the web page can format arbitrary durations (e.g. lap rows)
         * consistently with the native display, without duplicating the formatting
         * logic in JavaScript.
         *
         * @param ms Raw millisecond value to format.
         * @return Formatted string, e.g. `"01:23.45"`.
         */
        @JavascriptInterface
        fun formatTime(ms: Long): String = TimeFormatter.format(ms)
    }
}
