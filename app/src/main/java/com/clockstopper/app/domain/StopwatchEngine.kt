package com.clockstopper.app.domain

/**
 * Pure-Kotlin stopwatch engine.
 *
 * Tracks elapsed time and lap splits without any Android framework
 * dependency.  Time is measured using a pluggable [clock] function so
 * that unit tests can inject a deterministic time source.
 *
 * The engine is **not** thread-safe; all calls must be made from the
 * same thread (e.g. the main thread via a ViewModel + coroutine scope).
 *
 * ### State machine
 * ```
 * IDLE ──start()──► RUNNING ──stop()──► PAUSED ──start()──► RUNNING
 *                      │                   │
 *                    lap()              reset()
 *                      │                   ▼
 *                      ▼                 IDLE
 *                 (lap recorded)
 * ```
 *
 * @param clock  Monotonic time source in milliseconds.
 *               Defaults to [System.currentTimeMillis].
 */
class StopwatchEngine(
    private val clock: () -> Long = { System.currentTimeMillis() }
) {

    // ── State ────────────────────────────────────────────────────────────────

    /** Current lifecycle state. */
    var state: StopwatchState = StopwatchState.IDLE
        private set

    /** Wall-clock ms at which the most recent start() was called. */
    private var startedAtMs: Long = 0L

    /**
     * Total elapsed ms accumulated across all previous running intervals
     * (i.e. excluding the current running interval if [state] == RUNNING).
     */
    private var accumulatedMs: Long = 0L

    /** Wall-clock ms at which the most recent lap marker was set. */
    private var lapStartMs: Long = 0L

    /**
     * Split ms accumulated in the current lap across all previous running
     * intervals (before the current running interval started).
     */
    private var lapAccumulatedMs: Long = 0L

    /** Recorded laps (immutable snapshots). */
    private val _laps: MutableList<LapSummary> = mutableListOf()

    /** Read-only view of recorded laps, most-recent first. */
    val laps: List<LapSummary> get() = _laps.toList().asReversed()

    // ── Queries ──────────────────────────────────────────────────────────────

    /**
     * Total elapsed milliseconds at the current point in time.
     * Returns 0 when [state] is [StopwatchState.IDLE].
     */
    val elapsedMs: Long
        get() = when (state) {
            StopwatchState.IDLE    -> 0L
            StopwatchState.PAUSED  -> accumulatedMs
            StopwatchState.RUNNING -> accumulatedMs + (clock() - startedAtMs)
        }

    /**
     * Elapsed milliseconds in the **current** (open) lap.
     * Returns 0 when [state] is [StopwatchState.IDLE].
     */
    val currentLapMs: Long
        get() = when (state) {
            StopwatchState.IDLE    -> 0L
            StopwatchState.PAUSED  -> lapAccumulatedMs
            StopwatchState.RUNNING -> lapAccumulatedMs + (clock() - lapStartMs)
        }

    /** 1-based number of the lap currently being timed. */
    val currentLapNumber: Int get() = _laps.size + 1

    // ── Commands ─────────────────────────────────────────────────────────────

    /**
     * Starts (or resumes) the stopwatch.
     * No-op if already [StopwatchState.RUNNING].
     */
    fun start() {
        if (state == StopwatchState.RUNNING) return
        val now = clock()
        startedAtMs = now
        lapStartMs  = now
        state = StopwatchState.RUNNING
    }

    /**
     * Pauses the stopwatch, preserving the elapsed time.
     * No-op if not [StopwatchState.RUNNING].
     */
    fun stop() {
        if (state != StopwatchState.RUNNING) return
        val now = clock()
        accumulatedMs    += now - startedAtMs
        lapAccumulatedMs += now - lapStartMs
        state = StopwatchState.PAUSED
    }

    /**
     * Records the current elapsed time as a lap split and begins a new lap.
     * Only valid while [StopwatchState.RUNNING].
     *
     * @throws IllegalStateException if the engine is not running.
     */
    fun lap() {
        check(state == StopwatchState.RUNNING) {
            "lap() can only be called while RUNNING (current state: $state)"
        }
        val now       = clock()
        val splitMs   = lapAccumulatedMs + (now - lapStartMs)
        val totalMs   = accumulatedMs    + (now - startedAtMs)

        _laps.add(
            LapSummary(
                lapNumber    = currentLapNumber,
                splitMs      = splitMs,
                cumulativeMs = totalMs
            )
        )

        // Reset lap tracking for the new lap.
        lapStartMs       = now
        lapAccumulatedMs = 0L
    }

    /**
     * Resets the stopwatch to its initial [StopwatchState.IDLE] state.
     * Clears all laps. Safe to call from any state.
     */
    fun reset() {
        state            = StopwatchState.IDLE
        accumulatedMs    = 0L
        lapAccumulatedMs = 0L
        startedAtMs      = 0L
        lapStartMs       = 0L
        _laps.clear()
    }
}
