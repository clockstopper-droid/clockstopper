package com.clockstopper.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * MainActivity
 * ────────────
 * Single-Activity host for the Global Time Clock (clockstopper) web app.
 * Loads the web app assets into a WebView and manages:
 *
 *  • Runtime permissions for RECORD_AUDIO (microphone) and, on API 31+,
 *    BLUETOOTH_CONNECT.
 *  • A [AudioRoutingManager] that handles Bluetooth SCO/A2DP and wired
 *    headset routing, audio focus, and MediaSession headset button events.
 *  • A JavaScript bridge ([AudioBridge]) that the web layer calls to signal
 *    call start/end and query the current audio output device.
 *
 * The WebView loads `index.html` from the `assets/` directory so the app
 * works entirely offline.
 */
class MainActivity : AppCompatActivity(), AudioRoutingManager.AudioRoutingCallback {

    private val TAG = "MainActivity"

    private lateinit var webView: WebView
    private lateinit var audioRoutingManager: AudioRoutingManager

    // Permissions we need at runtime
    private val REQUIRED_PERMISSIONS = buildList {
        add(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            add(Manifest.permission.BLUETOOTH_CONNECT)
        }
    }.toTypedArray()

    private val PERMISSION_REQUEST_CODE = 1001

    // ------------------------------------------------------------------
    // Activity lifecycle
    // ------------------------------------------------------------------

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        audioRoutingManager = AudioRoutingManager(this, this)
        audioRoutingManager.initialize()

        requestMissingPermissions()
        setupWebView()
    }

    override fun onDestroy() {
        super.onDestroy()
        audioRoutingManager.release()
    }

    // ------------------------------------------------------------------
    // Permission handling
    // ------------------------------------------------------------------

    private fun requestMissingPermissions() {
        val missing = REQUIRED_PERMISSIONS.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }.toTypedArray()

        if (missing.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, missing, PERMISSION_REQUEST_CODE)
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERMISSION_REQUEST_CODE) {
            permissions.zip(grantResults.toTypedArray()).forEach { (perm, result) ->
                val granted = result == PackageManager.PERMISSION_GRANTED
                Log.d(TAG, "Permission $perm granted=$granted")
                // Notify the JS layer of the microphone permission result
                if (perm == Manifest.permission.RECORD_AUDIO) {
                    val jsEvent = if (granted) "micPermissionGranted" else "micPermissionDenied"
                    evaluateJs("window.dispatchEvent(new CustomEvent('$jsEvent'));")
                }
            }
        }
    }

    // ------------------------------------------------------------------
    // WebView setup
    // ------------------------------------------------------------------

    private fun setupWebView() {
        webView = findViewById(R.id.webview)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true          // for localStorage (theme persistence)
            allowFileAccessFromFileURLs = true
            allowUniversalAccessFromFileURLs = true
            mediaPlaybackRequiresUserGesture = false  // allow call audio auto-play
            cacheMode = WebSettings.LOAD_DEFAULT

            // Allow mixed content for local assets
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            }
        }

        // Inject the AudioBridge JS interface
        webView.addJavascriptInterface(AudioBridge(), "AndroidAudio")

        // Handle getUserMedia / microphone permission requests from JS
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    // Grant audio capture to the WebView origin automatically if
                    // the native RECORD_AUDIO permission is already held.
                    if (ContextCompat.checkSelfPermission(
                            this@MainActivity,
                            Manifest.permission.RECORD_AUDIO
                        ) == PackageManager.PERMISSION_GRANTED
                    ) {
                        request.grant(request.resources)
                    } else {
                        request.deny()
                        requestMissingPermissions()
                    }
                }
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                // Tell the JS layer what audio output device is active at load time
                val device = audioRoutingManager.getCurrentOutputDeviceLabel()
                evaluateJs(
                    "window.dispatchEvent(new CustomEvent('audioOutputRouted'," +
                            "{detail:{device:'${escapeJs(device)}',mode:'idle'}}));"
                )
            }
        }

        // Load the bundled web app
        webView.loadUrl("file:///android_asset/index.html")
    }

    // ------------------------------------------------------------------
    // AudioRoutingCallback implementation
    // ------------------------------------------------------------------

    override fun onAudioDeviceChanged(deviceName: String, connected: Boolean) {
        Log.d(TAG, "Audio device changed: $deviceName connected=$connected")
        // JS events are dispatched inside AudioRoutingManager via evaluateJs()
    }

    override fun onAudioFocusLost() {
        Log.d(TAG, "Audio focus lost")
    }

    override fun onAudioFocusGained() {
        Log.d(TAG, "Audio focus gained")
    }

    override fun evaluateJs(script: String) {
        runOnUiThread {
            webView.evaluateJavascript(script, null)
        }
    }

    // ------------------------------------------------------------------
    // JavaScript ↔ Native bridge
    // ------------------------------------------------------------------

    /**
     * JavaScript interface exposed as `window.AndroidAudio`.
     *
     * Methods are called from `app.js` to:
     *  - Signal call lifecycle events so the native side can configure
     *    Bluetooth / audio routing.
     *  - Query the current audio output device label for display in the
     *    network-type badge or call UI.
     *
     * Example JS usage:
     *   if (window.AndroidAudio) {
     *     window.AndroidAudio.onCallStarted();
     *   }
     */
    inner class AudioBridge {

        /**
         * Called by JS when a dialer call begins (after the MediaStream is
         * acquired and the peer connection / call audio starts).
         */
        @JavascriptInterface
        fun onCallStarted() {
            Log.d(TAG, "JS → onCallStarted")
            runOnUiThread { audioRoutingManager.onCallStarted() }
        }

        /**
         * Called by JS when a dialer call ends (peer disconnects, user hangs
         * up, or an error terminates the session).
         */
        @JavascriptInterface
        fun onCallEnded() {
            Log.d(TAG, "JS → onCallEnded")
            runOnUiThread { audioRoutingManager.onCallEnded() }
        }

        /**
         * Returns a human-readable label for the currently active audio output
         * device (e.g. "Bluetooth (HFP)", "Wired Headset", "Speaker").
         * Called from JS to populate the in-call network-type badge.
         */
        @JavascriptInterface
        fun getCurrentOutputDevice(): String {
            return audioRoutingManager.getCurrentOutputDeviceLabel()
        }

        /**
         * Returns `true` if a Bluetooth or wired headset is currently connected.
         * Can be polled from JS before placing a call to decide routing hints.
         */
        @JavascriptInterface
        fun isHeadsetConnected(): Boolean {
            return audioRoutingManager.getCurrentOutputDeviceLabel()
                .let { label ->
                    label.contains("Bluetooth", ignoreCase = true) ||
                            label.contains("Headset", ignoreCase = true) ||
                            label.contains("Headphones", ignoreCase = true) ||
                            label.contains("USB", ignoreCase = true)
                }
        }
    }

    // ------------------------------------------------------------------
    // Utility
    // ------------------------------------------------------------------

    private fun escapeJs(s: String): String =
        s.replace("\\", "\\\\").replace("'", "\\'")
}
