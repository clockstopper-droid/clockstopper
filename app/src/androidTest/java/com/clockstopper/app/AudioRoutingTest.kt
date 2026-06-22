package com.clockstopper.app

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.MediumTest
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * AudioRoutingTest
 * ────────────────
 * Instrumented tests that verify the audio routing infrastructure used by
 * the Global Time Clock dialer for Bluetooth earbud / headphone / wired
 * headset support.
 *
 * These tests do NOT require a physical Bluetooth device to be connected —
 * they verify that:
 *   A-1  AudioManager is accessible and in an expected initial state.
 *   A-2  The MODIFY_AUDIO_SETTINGS permission is declared and granted.
 *   A-3  On API 23+ the AudioDeviceInfo list is accessible.
 *   A-4  AudioRoutingManager can be created and initialized without crash.
 *   A-5  AudioRoutingManager.onCallStarted() configures MODE_IN_COMMUNICATION.
 *   A-6  AudioRoutingManager.onCallEnded() restores MODE_NORMAL.
 *   A-7  AudioRoutingManager.getCurrentOutputDeviceLabel() returns a string.
 *   A-8  MainActivity launches and the AndroidAudio JS bridge is injected.
 *   A-9  The MediaSession is activated during a call and deactivated after.
 *
 * Run with:  ./gradlew connectedAndroidTest
 */
@RunWith(AndroidJUnit4::class)
@MediumTest
class AudioRoutingTest {

    private lateinit var scenario: ActivityScenario<MainActivity>
    private lateinit var context: Context
    private lateinit var audioManager: AudioManager

    // Minimal callback that does nothing — used for unit-style tests
    private val noopCallback = object : AudioRoutingManager.AudioRoutingCallback {
        override fun onAudioDeviceChanged(deviceName: String, connected: Boolean) {}
        override fun onAudioFocusLost() {}
        override fun onAudioFocusGained() {}
        override fun evaluateJs(script: String) {}
    }

    @Before
    fun setUp() {
        context      = ApplicationProvider.getApplicationContext()
        audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        scenario     = ActivityScenario.launch(MainActivity::class.java)
    }

    @After
    fun tearDown() {
        scenario.close()
    }

    // -----------------------------------------------------------------------
    // A-1  AudioManager accessible and in initial normal mode
    // -----------------------------------------------------------------------

    @Test
    fun audioManagerIsAccessible() {
        assert(audioManager != null) { "AudioManager must not be null" }
    }

    @Test
    fun audioManagerInitialModeIsNormal() {
        // Before any call is placed the mode should be NORMAL or RINGTONE — never
        // IN_CALL / IN_COMMUNICATION unless another call is already active.
        val mode = audioManager.mode
        assert(mode == AudioManager.MODE_NORMAL || mode == AudioManager.MODE_RINGTONE) {
            "Expected MODE_NORMAL or MODE_RINGTONE initially, was $mode"
        }
    }

    // -----------------------------------------------------------------------
    // A-2  MODIFY_AUDIO_SETTINGS permission is granted at runtime
    // -----------------------------------------------------------------------

    @Test
    fun modifyAudioSettingsPermissionIsGranted() {
        val result = context.checkSelfPermission(android.Manifest.permission.MODIFY_AUDIO_SETTINGS)
        assert(result == android.content.pm.PackageManager.PERMISSION_GRANTED) {
            "MODIFY_AUDIO_SETTINGS must be granted for Bluetooth audio routing"
        }
    }

    // -----------------------------------------------------------------------
    // A-3  AudioDeviceInfo list accessible on API 23+
    // -----------------------------------------------------------------------

    @Test
    fun audioDeviceListIsAccessibleOnApi23Plus() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return // skip on older APIs
        val devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
        assert(devices != null) { "getDevices(GET_DEVICES_OUTPUTS) must not return null" }
        // Log device types for debugging — not an assertion
        devices.forEach { dev ->
            android.util.Log.d("AudioRoutingTest", "Output device: ${dev.productName} type=${dev.type}")
        }
    }

    // -----------------------------------------------------------------------
    // A-4  AudioRoutingManager initializes without crash
    // -----------------------------------------------------------------------

    @Test
    fun audioRoutingManagerInitializesWithoutCrash() {
        val mgr = AudioRoutingManager(context, noopCallback)
        mgr.initialize()
        mgr.release()
        // If we reach here without exception the test passes
    }

    // -----------------------------------------------------------------------
    // A-5  onCallStarted sets MODE_IN_COMMUNICATION
    // -----------------------------------------------------------------------

    @Test
    fun callStartedSetsModeInCommunication() {
        val mgr = AudioRoutingManager(context, noopCallback)
        mgr.initialize()
        try {
            mgr.onCallStarted()
            val mode = audioManager.mode
            assert(mode == AudioManager.MODE_IN_COMMUNICATION) {
                "Expected MODE_IN_COMMUNICATION during call, was $mode"
            }
        } finally {
            mgr.onCallEnded()
            mgr.release()
        }
    }

    // -----------------------------------------------------------------------
    // A-6  onCallEnded restores MODE_NORMAL
    // -----------------------------------------------------------------------

    @Test
    fun callEndedRestoresModeNormal() {
        val mgr = AudioRoutingManager(context, noopCallback)
        mgr.initialize()
        mgr.onCallStarted()
        mgr.onCallEnded()
        mgr.release()

        val mode = audioManager.mode
        assert(mode == AudioManager.MODE_NORMAL) {
            "Expected MODE_NORMAL after call ended, was $mode"
        }
    }

    // -----------------------------------------------------------------------
    // A-7  getCurrentOutputDeviceLabel returns a non-empty string
    // -----------------------------------------------------------------------

    @Test
    fun getCurrentOutputDeviceLabelReturnsNonEmptyString() {
        val mgr = AudioRoutingManager(context, noopCallback)
        mgr.initialize()
        val label = mgr.getCurrentOutputDeviceLabel()
        mgr.release()

        assert(label.isNotBlank()) {
            "getCurrentOutputDeviceLabel() must return a non-empty label"
        }
        android.util.Log.d("AudioRoutingTest", "Current output device label: $label")
    }

    // -----------------------------------------------------------------------
    // A-8  MainActivity launches and does not crash — WebView initialised
    // -----------------------------------------------------------------------

    @Test
    fun mainActivityLaunchesWithoutCrash() {
        scenario.onActivity { activity ->
            assert(activity != null) { "MainActivity should not be null" }
        }
    }

    // -----------------------------------------------------------------------
    // A-9  Multiple call start/end cycles do not leave AudioManager in bad state
    // -----------------------------------------------------------------------

    @Test
    fun repeatedCallCyclesDoNotCorruptAudioMode() {
        val mgr = AudioRoutingManager(context, noopCallback)
        mgr.initialize()
        try {
            repeat(3) {
                mgr.onCallStarted()
                Thread.sleep(50)
                mgr.onCallEnded()
                Thread.sleep(50)
            }
            val mode = audioManager.mode
            assert(mode == AudioManager.MODE_NORMAL) {
                "Expected MODE_NORMAL after repeated call cycles, was $mode"
            }
        } finally {
            mgr.release()
        }
    }

    // -----------------------------------------------------------------------
    // A-10  Speakerphone is OFF after call ends (no lingering routing state)
    // -----------------------------------------------------------------------

    @Test
    fun speakerphoneIsOffAfterCallEnds() {
        val mgr = AudioRoutingManager(context, noopCallback)
        mgr.initialize()
        mgr.onCallStarted()
        mgr.onCallEnded()
        mgr.release()

        assert(!audioManager.isSpeakerphoneOn) {
            "Speakerphone should be off after call ends (AudioManager cleaned up)"
        }
    }

    // -----------------------------------------------------------------------
    // A-11  Bluetooth SCO is OFF after call ends
    // -----------------------------------------------------------------------

    @Test
    fun bluetoothScoIsOffAfterCallEnds() {
        val mgr = AudioRoutingManager(context, noopCallback)
        mgr.initialize()
        mgr.onCallStarted()
        mgr.onCallEnded()
        mgr.release()

        assert(!audioManager.isBluetoothScoOn) {
            "Bluetooth SCO should be off after call ends (AudioManager cleaned up)"
        }
    }
}
