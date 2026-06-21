package com.clockstopper.app

import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import com.clockstopper.app.databinding.ActivityMainBinding

/**
 * Single-activity shell that hosts the ClockStopper web app inside a WebView.
 *
 * The web app lives in src/main/assets/ and is loaded via the
 * asset:// URI scheme, so no network access is required.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        configureWebView(binding.webView)

        // Load the bundled web application from assets/
        binding.webView.loadUrl("file:///android_asset/index.html")
    }

    private fun configureWebView(webView: WebView) {
        webView.webViewClient   = WebViewClient()          // stay inside the WebView
        webView.webChromeClient = WebChromeClient()        // enable JS dialogs / console

        with(webView.settings) {
            javaScriptEnabled       = true
            domStorageEnabled       = true                 // localStorage for lap data
            allowFileAccess         = true                 // read assets
            cacheMode               = WebSettings.LOAD_DEFAULT
            setSupportZoom(false)
            builtInZoomControls     = false
            displayZoomControls     = false
        }

        // Enable remote debugging via chrome://inspect in debug builds
        if (BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true)
        }
    }

    /** Forward the hardware back-button to the WebView history if possible. */
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (binding.webView.canGoBack()) {
            binding.webView.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }
}
