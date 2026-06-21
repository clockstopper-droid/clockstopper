package com.clockstopper.app

import android.os.Handler
import android.os.Looper
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.clockstopper.app.domain.LapAnalyzer
import com.clockstopper.app.domain.LapSummary
import com.clockstopper.app.domain.StopwatchEngine
import com.clockstopper.app.domain.StopwatchState
import com.clockstopper.app.domain.TimeFormatter
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Android [ViewModel] that bridges the platform-agnostic [StopwatchEngine] domain
 * layer to the Android UI layer.
 *
 * ## Responsibilities
 * 1. Hold the single source-of-truth [StopwatchState] and expose it as [LiveData].
 * 2. Drive a coroutine-based tick loop while the stopwatch is running so that the
 *    display updates at ~10 ms granularity (centisecond precision, matching the web
 *    front-end).
 * 3. Expose derived [LiveData] for the formatted display string and lap summary so
 *    observers never need to import domain classes directly.
 *
 * ## Usage from a Fragment or Activity
 * ```kotlin
 * val vm: StopwatchViewModel by viewModels()
 * vm.displayTime.observe(viewLifecycleOwner) { tv_time.text = it }
 * vm.laps.observe(viewLifecycleOwner)        { adapter.submitList(it) }
 * btnStart.setOnClickListener  { vm.onStartStop() }
 * btnLap.setOnClickListener    { vm.onLap() }
 * btnReset.setOnClickListener  { vm.onReset() }
 * ```
 *
 * The ViewModel survives configuration changes (rotation etc.) automatically
 * because it extends [ViewModel]; the tick coroutine is cancelled when the
 * ViewModel is cleared via [onCleared].
 */
class StopwatchViewModel : ViewModel() {

    // -----------------------------------------------------------------------
    // Domain engine (no Android dependencies)
    // -----------------------------------------------------------------------

    private val engine = StopwatchEngine()

    // -----------------------------------------------------------------------
    // Internal mutable state
    // -----------------------------------------------------------------------

    private var _state = StopwatchState.INITIAL

    private val _stopwatchState = MutableLiveData(_state)

    /** Raw domain state; observed by derived LiveData below.  Prefer those for UI. */
    val stopwatchState: LiveData<StopwatchState> = _stopwatchState

    // -----------------------------------------------------------------------
    // Derived LiveData for the UI layer
    // -----------------------------------------------------------------------

    /**
     * Human-readable elapsed time string (e.g. `"01:23.45"` or `"01:02:03.45"`).
     * Updated every tick while running; frozen when stopped.
     */
    private val _displayTime = MutableLiveData(TimeFormatter.format(0L))
    val displayTime: LiveData<String> = _displayTime

    /**
     * Ordered list of formatted lap strings (e.g. `["Lap 1  00:05.00", …]`).
     * Empty when no laps have been recorded.
     */
    private val _laps = MutableLiveData<List<String>>(emptyList())
    val laps: LiveData<List<String>> = _laps

    /**
     * Derived statistics over the recorded laps.  Null fields when no laps exist.
     * See [LapSummary] for field documentation.
     */
    private val _lapSummary = MutableLiveData(LapAnalyzer.summarise(emptyList()))
    val lapSummary: LiveData<LapSummary> = _lapSummary

    /**
     * `true` while the stopwatch is counting up; `false` when paused/reset.
     * Convenience alias so UI elements (e.g. a Start/Stop button label) don't need
     * to observe the full [stopwatchState].
     */
    private val _isRunning = MutableLiveData(false)
    val isRunning: LiveData<Boolean> = _isRunning

    // -----------------------------------------------------------------------
    // Tick loop
    // -----------------------------------------------------------------------

    private var tickJob: Job? = null

    private fun startTicking() {
        tickJob?.cancel()
        tickJob = viewModelScope.launch {
            while (isActive) {
                delay(TICK_INTERVAL_MS)
                _state = engine.tick(_state)
                publishState()
            }
        }
    }

    private fun stopTicking() {
        tickJob?.cancel()
        tickJob = null
    }

    // -----------------------------------------------------------------------
    // Public user-action handlers
    // -----------------------------------------------------------------------

    /**
     * Toggle start/stop.  If the stopwatch is currently running it is paused;
     * if it is stopped/paused it resumes (or starts fresh if never started).
     */
    fun onStartStop() {
        _state = if (_state.isRunning) {
            stopTicking()
            engine.stop(_state)
        } else {
            val started = engine.start(_state)
            startTicking()
            started
        }
        publishState()
    }

    /**
     * Record a lap while the stopwatch is running.  No-op when stopped.
     */
    fun onLap() {
        _state = engine.lap(_state)
        publishState()
    }

    /**
     * Reset the stopwatch to zero, clearing all laps.
     */
    fun onReset() {
        stopTicking()
        _state = engine.reset(_state)
        publishState()
    }

    // -----------------------------------------------------------------------
    // State propagation
    // -----------------------------------------------------------------------

    private fun publishState() {
        _stopwatchState.value = _state
        _displayTime.value    = TimeFormatter.format(_state.totalElapsedMs)
        _isRunning.value      = _state.isRunning
        _laps.value           = _state.laps.mapIndexed { index, lapMs ->
            TimeFormatter.formatLap(lapMs, lapNumber = index + 1)
        }
        _lapSummary.value = LapAnalyzer.summarise(_state.laps)
    }

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    override fun onCleared() {
        super.onCleared()
        stopTicking()
    }

    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------

    companion object {
        /** Tick interval in ms; 10 ms gives centisecond (1/100 s) display precision. */
        private const val TICK_INTERVAL_MS = 10L
    }
}
