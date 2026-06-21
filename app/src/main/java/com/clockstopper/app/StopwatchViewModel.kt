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

/**
 * StopwatchViewModel
 * ──────────────────
 * Jetpack [ViewModel] that bridges the domain layer ([StopwatchEngine]) and the
 * UI layer ([StopwatchFragment]).
 *
 * Responsibilities
 * ────────────────
 * 1. Own a [StopwatchEngine] instance that survives configuration changes.
 * 2. Drive a periodic ticker (16 ms ≈ 60 fps) that polls the engine's elapsed
 *    time and posts updated [LiveData] values to the Fragment.
 * 3. Expose [LiveData] streams for the formatted elapsed time, the running
 *    state, and the derived lap list — so the Fragment is purely reactive and
 *    contains zero business logic.
 * 4. Translate user-intent commands (start/stop/lap/reset) into engine calls.
 *
 * Threading model
 * ───────────────
 * All mutations happen on the main thread.  The ticker is a [Handler] posting
 * to the main looper; it is cancelled in [onCleared] to avoid leaks.
 *
 * The ViewModel does NOT use coroutines for the ticker intentionally — a
 * Handler is simpler, has no allocation overhead on each tick, and keeps the
 * domain layer free of coroutine dependencies.
 */
class StopwatchViewModel : ViewModel() {

    // -----------------------------------------------------------------------
    // Domain engine
    // -----------------------------------------------------------------------

    private val engine = StopwatchEngine()

    // -----------------------------------------------------------------------
    // LiveData streams exposed to the Fragment
    // -----------------------------------------------------------------------

    /** Formatted elapsed time string, e.g. `"01:23.45"`. */
    private val _elapsedTime = MutableLiveData(TimeFormatter.ZERO)
    val elapsedTime: LiveData<String> = _elapsedTime

    /** `true` while the stopwatch is actively counting. */
    private val _isRunning = MutableLiveData(false)
    val isRunning: LiveData<Boolean> = _isRunning

    /** Derived lap summary list — newest lap first, ready for RecyclerView. */
    private val _laps = MutableLiveData<List<LapSummary>>(emptyList())
    val laps: LiveData<List<LapSummary>> = _laps

    // -----------------------------------------------------------------------
    // Ticker
    // -----------------------------------------------------------------------

    private val mainHandler = Handler(Looper.getMainLooper())

    /**
     * Tick interval in milliseconds.  At ~16 ms the display updates at ≈60 fps,
     * which is smooth enough for a centisecond-resolution display.
     */
    private val tickIntervalMs = 16L

    private val tickRunnable: Runnable = object : Runnable {
        override fun run() {
            if (_isRunning.value == true) {
                publishState(engine.currentState())
                mainHandler.postDelayed(this, tickIntervalMs)
            }
        }
    }

    // -----------------------------------------------------------------------
    // User-intent commands
    // -----------------------------------------------------------------------

    /**
     * Toggle start / pause.  Starts the ticker when transitioning to running;
     * cancels it when pausing.
     */
    fun onStartStop() {
        val state = engine.startStop()
        publishState(state)
        if (state.isRunning) {
            mainHandler.postDelayed(tickRunnable, tickIntervalMs)
        } else {
            mainHandler.removeCallbacks(tickRunnable)
        }
    }

    /**
     * Record a lap split.  Only meaningful while the stopwatch is running;
     * the Fragment is responsible for guarding the button state.
     */
    fun onLap() {
        val state = engine.lap()
        publishState(state)
    }

    /**
     * Reset the stopwatch to the zeroed state.  Cancels any active ticker.
     */
    fun onReset() {
        mainHandler.removeCallbacks(tickRunnable)
        val state = engine.reset()
        publishState(state)
    }

    // -----------------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------------

    /**
     * Push a [StopwatchState] snapshot to all LiveData streams.
     */
    private fun publishState(state: StopwatchState) {
        _elapsedTime.value = TimeFormatter.format(state.elapsedMs)
        _isRunning.value = state.isRunning
        _laps.value = LapAnalyzer.analyze(state.laps)
    }

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    /**
     * Cancel the ticker when the ViewModel is cleared to prevent memory leaks.
     */
    override fun onCleared() {
        super.onCleared()
        mainHandler.removeCallbacks(tickRunnable)
    }
}
