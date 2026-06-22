package com.clockstopper.app

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothProfile
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.support.v4.media.session.MediaSessionCompat
import android.util.Log
import androidx.annotation.RequiresApi

/**
 * AudioRoutingManager
 * ───────────────────
 * Central manager for all audio routing concerns in the Global Time Clock
 * (clockstopper) dialer app.  Responsibilities:
 *
 *  • Request and abandon audio focus with the correct stream type and mode.
 *  • Configure AudioManager for Bluetooth SCO (HFP) and A2DP / wired headset
 *    output so call audio plays through the connected output device rather than
 *    the handset earpiece or loudspeaker.
 *  • Register an AudioDeviceCallback (API 23+) to detect hot-plug events for
 *    Bluetooth earbuds, over-ear headphones, and wired 3.5 mm jacks, and
 *    automatically re-route audio when devices connect or disconnect.
 *  • Register a BroadcastReceiver for legacy Bluetooth headset state changes
 *    (API < 23 fallback and for SCO state tracking on all API levels).
 *  • Maintain a MediaSessionCompat so Bluetooth headset hardware buttons
 *    (play, pause, end-call) are forwarded to the WebView JS layer via a
 *    JavaScript bridge call.
 *  • Expose a simple start/stop call-session API used by MainActivity /
 *    WebAppFragment.
 *
 * Usage
 * ─────
 *   val mgr = AudioRoutingManager(context, webView)
 *   mgr.initialize()                // call once from Activity.onCreate()
 *   mgr.onCallStarted()             // call when JS fires "callStarted"
 *   mgr.onCallEnded()               // call when JS fires "callEnded"
 *   mgr.release()                   // call from Activity.onDestroy()
 */
class AudioRoutingManager(
    private val context: Context,
    private val jsCallback: AudioRoutingCallback
) {

    // ------------------------------------------------------------------
    // Callback interface — implemented by MainActivity / WebAppFragment
    // ------------------------------------------------------------------

    interface AudioRoutingCallback {
        /** Invoked when a Bluetooth or wired device connects / disconnects. */
        fun onAudioDeviceChanged(deviceName: String, connected: Boolean)
        /** Invoked when audio focus is lost and the call should pause. */
        fun onAudioFocusLost()
        /** Invoked when audio focus is regained. */
        fun onAudioFocusGained()
        /** Invoked to fire a JS event string into the WebView. */
        fun evaluateJs(script: String)
    }

    // ------------------------------------------------------------------
    // Internal state
    // ------------------------------------------------------------------

    private val TAG = "AudioRoutingManager"
    private val mainHandler = Handler(Looper.getMainLooper())

    private val audioManager: AudioManager =
        context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    private var mediaSession: MediaSessionCompat? = null
    private var audioFocusRequest: AudioFocusRequest? = null  // API 26+
    private var isCallActive = false
    private var bluetoothScoConnected = false

    // ------------------------------------------------------------------
    // Audio-device callback (API 23+)
    // ------------------------------------------------------------------

    @RequiresApi(Build.VERSION_CODES.M)
    private val deviceCallback = object : AudioDeviceCallback() {
        override fun onAudioDevicesAdded(addedDevices: Array<out AudioDeviceInfo>) {
            for (device in addedDevices) {
                if (isHeadsetDevice(device)) {
                    Log.d(TAG, "Audio device connected: ${device.productName} type=${device.type}")
                    routeAudioToDevice(device)
                    jsCallback.onAudioDeviceChanged(device.productName.toString(), true)
                    jsCallback.evaluateJs(
                        "window.dispatchEvent(new CustomEvent('audioDeviceConnected'," +
                                "{detail:{name:'${escapeJs(device.productName.toString())}'," +
                                "type:${device.type}}}));"
                    )
                }
            }
        }

        override fun onAudioDevicesRemoved(removedDevices: Array<out AudioDeviceInfo>) {
            for (device in removedDevices) {
                if (isHeadsetDevice(device)) {
                    Log.d(TAG, "Audio device disconnected: ${device.productName}")
                    jsCallback.onAudioDeviceChanged(device.productName.toString(), false)
                    jsCallback.evaluateJs(
                        "window.dispatchEvent(new CustomEvent('audioDeviceDisconnected'," +
                                "{detail:{name:'${escapeJs(device.productName.toString())}'," +
                                "type:${device.type}}}));"
                    )
                    // Fall back to speaker-phone / normal earpiece as appropriate
                    if (isCallActive) {
                        setSpeakerphoneForFallback()
                    }
                }
            }
        }
    }

    // ------------------------------------------------------------------
    // BroadcastReceiver — Bluetooth SCO state & headset plug events
    // ------------------------------------------------------------------

    private val bluetoothReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context, intent: Intent) {
            when (intent.action) {
                // Bluetooth SCO audio connection state (HFP mic+speaker)
                AudioManager.ACTION_SCO_AUDIO_STATE_UPDATED -> {
                    val state = intent.getIntExtra(
                        AudioManager.EXTRA_SCO_AUDIO_STATE,
                        AudioManager.SCO_AUDIO_STATE_ERROR
                    )
                    when (state) {
                        AudioManager.SCO_AUDIO_STATE_CONNECTED -> {
                            Log.d(TAG, "BT SCO connected")
                            bluetoothScoConnected = true
                            audioManager.isBluetoothScoOn = true
                            jsCallback.evaluateJs(
                                "window.dispatchEvent(new CustomEvent('bluetoothScoConnected'));"
                            )
                        }
                        AudioManager.SCO_AUDIO_STATE_DISCONNECTED -> {
                            Log.d(TAG, "BT SCO disconnected")
                            bluetoothScoConnected = false
                            audioManager.isBluetoothScoOn = false
                            if (isCallActive) setSpeakerphoneForFallback()
                            jsCallback.evaluateJs(
                                "window.dispatchEvent(new CustomEvent('bluetoothScoDisconnected'));"
                            )
                        }
                    }
                }
                // Wired headset plug / unplug
                Intent.ACTION_HEADSET_PLUG -> {
                    val state = intent.getIntExtra("state", -1)
                    val name = intent.getStringExtra("name") ?: "Wired Headset"
                    if (state == 1) {
                        Log.d(TAG, "Wired headset plugged in: $name")
                        jsCallback.evaluateJs(
                            "window.dispatchEvent(new CustomEvent('audioDeviceConnected'," +
                                    "{detail:{name:'${escapeJs(name)}',type:'wired'}}));"
                        )
                    } else if (state == 0) {
                        Log.d(TAG, "Wired headset unplugged")
                        if (isCallActive) setSpeakerphoneForFallback()
                        jsCallback.evaluateJs(
                            "window.dispatchEvent(new CustomEvent('audioDeviceDisconnected'," +
                                    "{detail:{name:'${escapeJs(name)}',type:'wired'}}));"
                        )
                    }
                }
                // Bluetooth A2DP connection state change
                BluetoothProfile.ACTION_CONNECTION_STATE_CHANGED -> {
                    val btState = intent.getIntExtra(
                        BluetoothProfile.EXTRA_STATE, BluetoothProfile.STATE_DISCONNECTED
                    )
                    val deviceName = intent
                        .getParcelableExtra<android.bluetooth.BluetoothDevice>(
                            android.bluetooth.BluetoothDevice.EXTRA_DEVICE
                        )?.name ?: "Bluetooth Device"
                    when (btState) {
                        BluetoothProfile.STATE_CONNECTED -> {
                            Log.d(TAG, "BT A2DP connected: $deviceName")
                        }
                        BluetoothProfile.STATE_DISCONNECTED -> {
                            Log.d(TAG, "BT A2DP disconnected: $deviceName")
                            if (isCallActive) setSpeakerphoneForFallback()
                        }
                    }
                }
            }
        }
    }

    // ------------------------------------------------------------------
    // AudioFocusChange listener
    // ------------------------------------------------------------------

    private val focusChangeListener = AudioManager.OnAudioFocusChangeListener { focusChange ->
        when (focusChange) {
            AudioManager.AUDIOFOCUS_GAIN,
            AudioManager.AUDIOFOCUS_GAIN_TRANSIENT,
            AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK -> {
                Log.d(TAG, "Audio focus gained ($focusChange)")
                jsCallback.onAudioFocusGained()
                jsCallback.evaluateJs(
                    "window.dispatchEvent(new CustomEvent('audioFocusGained'));"
                )
            }
            AudioManager.AUDIOFOCUS_LOSS,
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                Log.d(TAG, "Audio focus lost ($focusChange)")
                jsCallback.onAudioFocusLost()
                jsCallback.evaluateJs(
                    "window.dispatchEvent(new CustomEvent('audioFocusLost'));"
                )
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
                // Lower volume — JS layer handles via gainNode if needed
                jsCallback.evaluateJs(
                    "window.dispatchEvent(new CustomEvent('audioFocusDuck'));"
                )
            }
        }
    }

    // ==================================================================
    // Public API
    // ==================================================================

    /**
     * Initialize the manager: register receivers, build MediaSession, and
     * register the AudioDeviceCallback.  Call once from Activity.onCreate().
     */
    fun initialize() {
        setupMediaSession()
        registerReceivers()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            audioManager.registerAudioDeviceCallback(deviceCallback, mainHandler)
        }
        Log.d(TAG, "AudioRoutingManager initialized")
    }

    /**
     * Called when the JS layer fires the "callStarted" event.
     * Requests audio focus, enables Bluetooth SCO (HFP), and configures
     * AudioManager for headset/call mode.
     */
    fun onCallStarted() {
        isCallActive = true
        Log.d(TAG, "onCallStarted — requesting audio focus and routing")
        requestAudioFocus()
        configureAudioForCall()
        mediaSession?.isActive = true
    }

    /**
     * Called when the JS layer fires the "callEnded" event.
     * Abandons audio focus, stops Bluetooth SCO, and restores AudioManager
     * to its normal (media) mode.
     */
    fun onCallEnded() {
        isCallActive = false
        Log.d(TAG, "onCallEnded — releasing audio focus and resetting routing")
        stopBluetoothSco()
        restoreAudioAfterCall()
        abandonAudioFocus()
        mediaSession?.isActive = false
    }

    /**
     * Release all resources.  Call from Activity.onDestroy().
     */
    fun release() {
        onCallEnded()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            audioManager.unregisterAudioDeviceCallback(deviceCallback)
        }
        try {
            context.unregisterReceiver(bluetoothReceiver)
        } catch (e: IllegalArgumentException) {
            // Receiver not registered — safe to ignore
        }
        mediaSession?.release()
        mediaSession = null
        Log.d(TAG, "AudioRoutingManager released")
    }

    /**
     * Return a description of the currently active audio output device,
     * suitable for display in the JS network-type badge or call UI.
     */
    fun getCurrentOutputDeviceLabel(): String {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
            // Prefer BT A2DP > BT HFP > wired headset > speaker
            val preferred = listOf(
                AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
                AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
                AudioDeviceInfo.TYPE_WIRED_HEADSET,
                AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
                AudioDeviceInfo.TYPE_USB_HEADSET
            )
            for (type in preferred) {
                val d = devices.firstOrNull { it.type == type }
                if (d != null) {
                    return d.productName.toString().ifBlank { labelForType(type) }
                }
            }
        }
        return if (audioManager.isSpeakerphoneOn) "Speaker" else "Earpiece"
    }

    // ==================================================================
    // Private helpers
    // ==================================================================

    // ---------- MediaSession ------------------------------------------

    private fun setupMediaSession() {
        mediaSession = MediaSessionCompat(context, "ClockstopperDialer").apply {
            setFlags(
                MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or
                        MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
            )
            // Forward headset hardware-button events to the JS layer
            setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlay() {
                    jsCallback.evaluateJs(
                        "window.dispatchEvent(new CustomEvent('mediaButtonPlay'));"
                    )
                }
                override fun onPause() {
                    jsCallback.evaluateJs(
                        "window.dispatchEvent(new CustomEvent('mediaButtonPause'));"
                    )
                }
                override fun onStop() {
                    // Map "stop" headset button to end-call in the dialer
                    jsCallback.evaluateJs(
                        "if(typeof endCall==='function') endCall();" +
                                "window.dispatchEvent(new CustomEvent('mediaButtonStop'));"
                    )
                }
                override fun onSkipToNext() {
                    jsCallback.evaluateJs(
                        "window.dispatchEvent(new CustomEvent('mediaButtonNext'));"
                    )
                }
                override fun onSkipToPrevious() {
                    jsCallback.evaluateJs(
                        "window.dispatchEvent(new CustomEvent('mediaButtonPrevious'));"
                    )
                }
            })
        }
    }

    // ---------- BroadcastReceiver registration ------------------------

    private fun registerReceivers() {
        val filter = IntentFilter().apply {
            addAction(AudioManager.ACTION_SCO_AUDIO_STATE_UPDATED)
            addAction(Intent.ACTION_HEADSET_PLUG)
            addAction(BluetoothProfile.ACTION_CONNECTION_STATE_CHANGED)
        }
        context.registerReceiver(bluetoothReceiver, filter)
    }

    // ---------- Audio focus -------------------------------------------

    private fun requestAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val attrs = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
            audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(attrs)
                .setAcceptsDelayedFocusGain(false)
                .setWillPauseWhenDucked(false)
                .setOnAudioFocusChangeListener(focusChangeListener, mainHandler)
                .build()
            val result = audioManager.requestAudioFocus(audioFocusRequest!!)
            Log.d(TAG, "AudioFocus request result (API 26+): $result")
        } else {
            @Suppress("DEPRECATION")
            val result = audioManager.requestAudioFocus(
                focusChangeListener,
                AudioManager.STREAM_VOICE_CALL,
                AudioManager.AUDIOFOCUS_GAIN
            )
            Log.d(TAG, "AudioFocus request result (legacy): $result")
        }
    }

    private fun abandonAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
            audioFocusRequest = null
        } else {
            @Suppress("DEPRECATION")
            audioManager.abandonAudioFocus(focusChangeListener)
        }
    }

    // ---------- Audio mode / routing configuration --------------------

    /**
     * Configure AudioManager for a voice call:
     *  1. Switch mode to MODE_IN_COMMUNICATION (best for VoIP / WebRTC).
     *  2. Try to route to the best connected headset (BT SCO → wired → speaker).
     */
    private fun configureAudioForCall() {
        audioManager.mode = AudioManager.MODE_IN_COMMUNICATION

        when {
            isBluetoothHeadsetConnected() -> {
                Log.d(TAG, "Routing to Bluetooth SCO (HFP)")
                audioManager.isSpeakerphoneOn = false
                audioManager.isBluetoothScoOn = true
                audioManager.startBluetoothSco()
            }
            isWiredHeadsetConnected() -> {
                Log.d(TAG, "Routing to wired headset")
                audioManager.isSpeakerphoneOn = false
                audioManager.isBluetoothScoOn = false
            }
            else -> {
                Log.d(TAG, "No headset detected — routing to speakerphone")
                audioManager.isSpeakerphoneOn = true
            }
        }

        // Notify JS of the active output device
        val label = getCurrentOutputDeviceLabel()
        jsCallback.evaluateJs(
            "window.dispatchEvent(new CustomEvent('audioOutputRouted'," +
                    "{detail:{device:'${escapeJs(label)}','mode':'call'}}));"
        )
    }

    private fun restoreAudioAfterCall() {
        audioManager.isSpeakerphoneOn = false
        audioManager.isBluetoothScoOn = false
        audioManager.mode = AudioManager.MODE_NORMAL
    }

    private fun stopBluetoothSco() {
        if (bluetoothScoConnected || audioManager.isBluetoothScoOn) {
            audioManager.stopBluetoothSco()
            audioManager.isBluetoothScoOn = false
            bluetoothScoConnected = false
        }
    }

    private fun setSpeakerphoneForFallback() {
        mainHandler.post {
            Log.d(TAG, "Headset disconnected during call — falling back to speakerphone")
            audioManager.isSpeakerphoneOn = true
            audioManager.isBluetoothScoOn = false
            jsCallback.evaluateJs(
                "window.dispatchEvent(new CustomEvent('audioOutputRouted'," +
                        "{detail:{device:'Speaker',mode:'call',fallback:true}}));"
            )
        }
    }

    // ---------- Device detection helpers ------------------------------

    private fun isBluetoothHeadsetConnected(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
            return devices.any {
                it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
                        it.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP
            }
        }
        @Suppress("DEPRECATION")
        return audioManager.isBluetoothA2dpOn || audioManager.isBluetoothScoOn
    }

    private fun isWiredHeadsetConnected(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
            return devices.any {
                it.type == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
                        it.type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
                        it.type == AudioDeviceInfo.TYPE_USB_HEADSET
            }
        }
        @Suppress("DEPRECATION")
        return audioManager.isWiredHeadsetOn
    }

    @RequiresApi(Build.VERSION_CODES.M)
    private fun isHeadsetDevice(device: AudioDeviceInfo): Boolean {
        return device.type in listOf(
            AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
            AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
            AudioDeviceInfo.TYPE_WIRED_HEADSET,
            AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
            AudioDeviceInfo.TYPE_USB_HEADSET
        )
    }

    @RequiresApi(Build.VERSION_CODES.M)
    private fun routeAudioToDevice(device: AudioDeviceInfo) {
        if (!isCallActive) return
        when (device.type) {
            AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> {
                audioManager.isSpeakerphoneOn = false
                audioManager.isBluetoothScoOn = true
                audioManager.startBluetoothSco()
            }
            AudioDeviceInfo.TYPE_BLUETOOTH_A2DP -> {
                // A2DP is handled automatically by AudioManager once SCO is off
                audioManager.isSpeakerphoneOn = false
                audioManager.isBluetoothScoOn = false
            }
            AudioDeviceInfo.TYPE_WIRED_HEADSET,
            AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
            AudioDeviceInfo.TYPE_USB_HEADSET -> {
                audioManager.isSpeakerphoneOn = false
                audioManager.isBluetoothScoOn = false
            }
        }
    }

    // ---------- Utility -----------------------------------------------

    @RequiresApi(Build.VERSION_CODES.M)
    private fun labelForType(type: Int): String = when (type) {
        AudioDeviceInfo.TYPE_BLUETOOTH_A2DP -> "Bluetooth (A2DP)"
        AudioDeviceInfo.TYPE_BLUETOOTH_SCO  -> "Bluetooth (HFP)"
        AudioDeviceInfo.TYPE_WIRED_HEADSET  -> "Wired Headset"
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES -> "Wired Headphones"
        AudioDeviceInfo.TYPE_USB_HEADSET    -> "USB Headset"
        AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "Speaker"
        AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> "Earpiece"
        else -> "Audio Device"
    }

    /** Escape single quotes and backslashes for inline JS string literals. */
    private fun escapeJs(s: String): String =
        s.replace("\\", "\\\\").replace("'", "\\'")
}
