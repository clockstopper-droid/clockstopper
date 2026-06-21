package com.clockstopper.app.domain

/**
 * StopwatchEngine
 * ───────────────
 * Pure-Kotlin, platform-independent core of the stopwatch.
 *
 * The engine is a simple state machine with three operations:
 *   - [startStop]  — toggles between running and paused.
 *   - [lap]        — records the current elapsed time as a lap split.
 *   - [reset]      — returns the engine to the initial zeroed state.
 *
 * All state mutations are expressed as pure functions that return a new
 * [StopwatchState]; the engine itself holds **no** mutable state — callers
 * (typically [StopwatchViewModel]) own and store the current state.
 *
 * Time source
 * ───────────
 * The engine accepts a `nowMs: () -> Long` lambda so that the time source can
 * be injected in tests (deterministic fake clock) while defaulting to
 * `System.currentTimeMillis()` in production.
 *
 * Lap semantics
 * ─────────────
 * Each lap stores the **split** time — the duration since the previous lap
 * (or since start if it is the first lap), not the cumulative elapsed time.
 * [LapAnalyzer] can derive cumulative totals from the split list.
 */
class StopwatchEngine(
    private val nowMs: () -> Long = { System.currentTimeMillis() },
) {

    /**
     * Wall-clock timestamp (ms) at which the stopwatch was most recently
     * started.  `null` when the stopwatch is in the paused / reset state.
     */
    private var startTimestamp: Long? = null

    /**
     * Milliseconds accumulated during previous start/stop intervals.
     * When the stopwatch is paused this holds the *total* elapsed time.
     */
    private var accumulatedMs: Long = 0L

    /**
     * Elapsed ms at the time of the most recently recorded lap.  Used to
     * compute the split for the *next* lap.
     */
    private var lastLapMs: Long = 0L

    /** Mutable backing list of lap splits (ms). */
    private val lapSplits: MutableList<Long> = mutableListOf()

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /**
     * Toggle the running state.
     *
     * - If the stopwatch is currently **paused** (or has never been started),
     *   it resumes / starts and records the current wall-clock time as the
     *   new start timestamp.
     * - If the stopwatch is currently **running**, it pauses and adds the
     *   elapsed interval to [accumulatedMs].
     *
     * @return The new [StopwatchState] after the toggle.
     */
    fun startStop(): StopwatchState {
        return if (startTimestamp == null) {
            // ── Start / Resume ──────────────────────────────────────────────
            startTimestamp = nowMs()
            buildState(isRunning = true)
        } else {
            // ── Pause ───────────────────────────────────────────────────────
            val now = nowMs()
            accumulatedMs += now - (startTimestamp ?: now)
            startTimestamp = null
            buildState(isRunning = false)
        }
    }

    /**
     * Record the current elapsed time as a new lap split.
     *
     * A lap is only meaningful while the stopwatch is running; callers should
     * guard against invoking this method in the paused / reset state, but the
     * engine handles it gracefully (the split will be zero or the time since
     * the last lap while paused).
     *
     * @return The new [StopwatchState] after the lap is recorded.
     */
    fun lap(): StopwatchState {
        val currentElapsed = currentElapsedMs()
        val split = currentElapsed - lastLapMs
        lastLapMs = currentElapsed
        lapSplits.add(split)
        return buildState(isRunning = startTimestamp != null)
    }

    /**
     * Reset the stopwatch to its initial zeroed state.
     *
     * Clears the accumulated time, lap list, and start timestamp.
     *
     * @return [StopwatchState.INITIAL].
     */
    fun reset(): StopwatchState {
        startTimestamp = null
        accumulatedMs = 0L
        lastLapMs = 0L
        lapSplits.clear()
        return StopwatchState.INITIAL
    }

    /**
     * Return the current state without mutating anything.
     * Useful for ViewModels that need to reconstruct the UI after a config change.
     */
    fun currentState(): StopwatchState =
        buildState(isRunning = startTimestamp != null)

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    /** Total elapsed milliseconds including any currently-running interval. */
    private fun currentElapsedMs(): Long {
        val now = nowMs()
        val runningInterval = startTimestamp?.let { now - it } ?: 0L
        return accumulatedMs + runningInterval
    }

    private fun buildState(isRunning: Boolean): StopwatchState =
        StopwatchState(
            elapsedMs = currentElapsedMs(),
            isRunning = isRunning,
            laps = lapSplits.toList(),
        )
}
