package com.clockstopper.app

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
 * ViewModel for the stopwatch screen.
 *
 * Bridges the platform-agnostic [StopwatchEngine] and [LapAnalyzer] domain
 * objects to the UI layer via [LiveData].  A coroutine tick loop drives
 * display updates every [TICK_INTERVAL_MS] milliseconds while the engine is
 * running; no updates are emitted while paused or idle.
 *
 * All public methods are safe to call from the main thread.
 */
class StopwatchViewModel : ViewModel() {

    // ── Domain objects ───────────────────────────────────────────────────────

    /** Authoritative stopwatch engine.  Injected-friendly via constructor for tests. */
    private val engine = StopwatchEngine()

    // ── LiveData ─────────────────────────────────────────────────────────────

    /** Formatted elapsed-time string (HH:MM:SS.mmm). */
    private val _elapsedTime = MutableLiveData("00:00:00.000")
    val elapsedTime: LiveData<String> = _elapsedTime

    /** Formatted current-lap label, e.g. "Lap 2  –  00:12.345". */
    private val _currentLapLabel = MutableLiveData<String?>(null)
    val currentLapLabel: LiveData<String?> = _currentLapLabel

    /** Lap rows ready for the RecyclerView adapter (ranked, most-recent first). */
    private val _laps = MutableLiveData<List<Pair<LapSummary, LapAnalyzer.Rank>>>(emptyList())
    val laps: LiveData<List<Pair<LapSummary, LapAnalyzer.Rank>>> = _laps

    /** Current stopwatch lifecycle state. */
    private val _state = MutableLiveData(StopwatchState.IDLE)
    val state: LiveData<StopwatchState> = _state

    // ── Coroutine tick loop ──────────────────────────────────────────────────

    private var tickJob: Job? = null

    /** Refresh interval while the stopwatch is running, in milliseconds. */
    private val TICK_INTERVAL_MS = 30L

    private fun startTicking() {
        tickJob?.cancel()
        tickJob = viewModelScope.launch {
            while (isActive) {
                publishDisplayState()
                delay(TICK_INTERVAL_MS)
            }
        }
    }

    private fun stopTicking() {
        tickJob?.cancel()
        tickJob = null
    }

    // ── Commands (called by Fragment) ────────────────────────────────────────

    /**
     * Toggles between RUNNING and PAUSED.
     * If IDLE, transitions to RUNNING.
     */
    fun onStartStop() {
        when (engine.state) {
            StopwatchState.IDLE, StopwatchState.PAUSED -> {
                engine.start()
                startTicking()
            }
            StopwatchState.RUNNING -> {
                engine.stop()
                stopTicking()
                publishDisplayState() // flush final values immediately
            }
        }
        _state.value = engine.state
    }

    /** Records a lap split (only valid while RUNNING). */
    fun onLap() {
        if (engine.state != StopwatchState.RUNNING) return
        engine.lap()
        publishDisplayState()
    }

    /** Resets the stopwatch to IDLE and clears all laps. */
    fun onReset() {
        stopTicking()
        engine.reset()
        _state.value = engine.state
        publishDisplayState()
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    /**
     * Pushes the current engine state into all LiveData streams.
     * Called both from the tick loop and immediately after any command.
     */
    private fun publishDisplayState() {
        _elapsedTime.value = TimeFormatter.formatElapsed(engine.elapsedMs)

        _currentLapLabel.value = when (engine.state) {
            StopwatchState.IDLE -> null
            else -> buildCurrentLapLabel()
        }

        // Rank the recorded laps (immutable list from engine).
        val rankedLaps = LapAnalyzer.rank(engine.laps)
        _laps.value = rankedLaps
    }

    private fun buildCurrentLapLabel(): String {
        val lapNum  = engine.currentLapNumber
        val splitFmt = TimeFormatter.formatSplit(engine.currentLapMs)
        return "Lap $lapNum  –  $splitFmt"
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────

    override fun onCleared() {
        stopTicking()
        super.onCleared()
    }
}
