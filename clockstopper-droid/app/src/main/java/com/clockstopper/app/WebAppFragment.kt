package com.clockstopper.app

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.fragment.app.Fragment
import com.clockstopper.app.databinding.FragmentWebAppBinding

/**
 * Root Fragment that hosts the ClockStopper web application inside a [WebView].
 *
 * The web app is bundled under `src/main/assets/` and loaded via the
 * `file:///android_asset/` URI scheme, so no network access is required at
 * runtime.
 *
 * WebView state preservation
 * ──────────────────────────
 * [WebView.saveState] / [WebView.restoreState] are called during the Fragment's
 * own save/restore cycle so the current page and scroll position survive
 * configuration changes.  Note: WebView history cannot be fully serialised
 * across process death — users will be returned to the asset index in that
 * rare case, which is acceptable for a single-page stopwatch app.
 *
 * Back navigation
 * ───────────────
 * When the WebView has history (the user navigated within the SPA), the
 * hardware/gesture back action moves through that history before popping the
 * Fragment back-stack.  This is coordinated via [NavigationHost.navigateBack]
 * in [MainActivity].  Fragments that embed a WebView should override
 * [handleBackPress] if they need custom in-page back handling.
 */
class WebAppFragment : Fragment() {

    // View-binding reference — nullable because the View can be destroyed while
    // the Fragment is on the back-stack.
    private var _binding: FragmentWebAppBinding? = null
    private val binding get() = _binding!!

    // Saved WebView state bundle — populated in onSaveInstanceState and consumed
    // in onViewCreated so the WebView survives configuration changes.
    private var webViewBundle: Bundle? = null

    // -------------------------------------------------------------------------
    // Factory
    // -------------------------------------------------------------------------

    companion object {
        /** URL of the bundled asset loaded on a fresh launch. */
        private const val ASSET_URL = "file:///android_asset/index.html"

        /** Tag used when this Fragment is added to the back-stack. */
        const val TAG = "WebAppFragment"

        fun newInstance(): WebAppFragment = WebAppFragment()
    }

    // -------------------------------------------------------------------------
    // Lifecycle — View creation / teardown
    // -------------------------------------------------------------------------

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View {
        _binding = FragmentWebAppBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        configureWebView(binding.webView)

        // Restore WebView history if we have a saved state (configuration change),
        // otherwise perform a fresh load of the bundled asset.
        val stateToRestore = webViewBundle ?: savedInstanceState?.getBundle(KEY_WEB_STATE)
        if (stateToRestore != null) {
            binding.webView.restoreState(stateToRestore)
        } else {
            binding.webView.loadUrl(ASSET_URL)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        _binding?.let { b ->
            val state = Bundle()
            b.webView.saveState(state)
            outState.putBundle(KEY_WEB_STATE, state)
        }
    }

    override fun onDestroyView() {
        // Capture WebView state before the View hierarchy is torn down so we
        // can restore it the next time onViewCreated is called (e.g. after the
        // Fragment returns from the back-stack).
        _binding?.let { b ->
            webViewBundle = Bundle().also { b.webView.saveState(it) }
        }
        _binding = null
        super.onDestroyView()
    }

    // -------------------------------------------------------------------------
    // Back navigation — in-page WebView history
    // -------------------------------------------------------------------------

    /**
     * Called by [MainActivity] before it pops the Fragment back-stack.
     *
     * @return `true` if the WebView consumed the back event (navigated within
     *         the SPA history), `false` if the Fragment back-stack should be popped.
     */
    fun handleBackPress(): Boolean {
        val wv = _binding?.webView ?: return false
        return if (wv.canGoBack()) {
            wv.goBack()
            true
        } else {
            false
        }
    }

    // -------------------------------------------------------------------------
    // WebView configuration
    // -------------------------------------------------------------------------

    private fun configureWebView(webView: WebView) {
        // Stay inside the WebView — no browser intent for asset:// links.
        webView.webViewClient = WebViewClient()

        // Enable JS dialogs, console logging, and progress events.
        webView.webChromeClient = WebChromeClient()

        with(webView.settings) {
            javaScriptEnabled   = true
            domStorageEnabled   = true          // localStorage for lap data
            allowFileAccess     = true          // read bundled assets
            cacheMode           = WebSettings.LOAD_DEFAULT
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
        }

        // Enable remote debugging via chrome://inspect in debug builds only.
        if (BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true)
        }
    }

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    private companion object {
        const val KEY_WEB_STATE = "webViewState"
    }
}
