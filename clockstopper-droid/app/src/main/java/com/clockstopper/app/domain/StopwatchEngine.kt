package com.clockstopper.app.domain

/**
 * Pure, platform-agnostic stopwatch engine.
 *
 * This class contains **all** timing business logic and is deliberately free of any
 * Android, web, or UI framework dependencies.  It can be unit-tested on the JVM
 * without a device or emulator.
 *
 * ## Design
 * - All state mutations return a new [StopwatchState]; the engine itself is stateless.
 * - A [Clock] abstraction is injected so that tests can supply a deterministic time
 *   source instead of [System.currentTimeMillis].
 * - Lap logic mirrors the behaviour found in the original JavaScript implementation
 *   (`clockstopper-droid/js/app.js`): recording a lap captures the *current* total
 *   elapsed time as the lap's end-mark; the lap *duration* is the difference between
 *   that end-mark and the previous lap's end-mark (or 0 for the very first lap).
 *
 * ## Typical usage from an Android ViewModel
 * ```kotlin
 * private var state = StopwatchState.INITIAL
 * private val engine = StopwatchEngine()
 *
 * fun onStartStop() {
 *     state = if (state.isRunning) engine.stop(state) else engine.start(state)
 * }
 * fun onLap()   { state = engine.lap(state) }
 * fun onReset() { state = engine.reset(state) }
 * fun tick()    { state = engine.tick(state) }
 * ```
 */
class StopwatchEngine(private val clock: Clock = SystemClock) {

    // -------------------------------------------------------------------------
    // Public API – all functions are pure (input state → output state)
    // -------------------------------------------------------------------------

    /**
     * Start (or resume) the stopwatch.
     *
     * If the stopwatch is already running this is a no-op; the same state is
     * returned unchanged so callers don't need to guard against double-starts.
     */
    fun start(state: StopwatchState): StopwatchState {
        if (state.isRunning) return state
        return state.copy(
            startedAtMs = clock.nowMs(),
            isRunning = true,
        )
    }

    /**
     * Stop (pause) the stopwatch, freezing [StopwatchState.elapsedMs].
     *
     * If the stopwatch is already stopped this is a no-op.
     */
    fun stop(state: StopwatchState): StopwatchState {
        if (!state.isRunning) return state
        val now = clock.nowMs()
        val segmentMs = (now - state.startedAtMs).coerceAtLeast(0L)
        return state.copy(
            elapsedMs = state.elapsedMs + segmentMs,
            currentSegmentMs = 0L,
            startedAtMs = -1L,
            isRunning = false,
        )
    }

    /**
     * Reset the stopwatch to [StopwatchState.INITIAL], discarding all elapsed time
     * and lap records.
     *
     * The stopwatch is also stopped as a side-effect; callers do not need to
     * [stop] before resetting.
     */
    fun reset(@Suppress("UNUSED_PARAMETER") state: StopwatchState): StopwatchState =
        StopwatchState.INITIAL

    /**
     * Record a lap.
     *
     * A lap is only recorded while the stopwatch is running (consistent with
     * conventional stopwatch behaviour).  If the stopwatch is stopped the state is
     * returned unchanged.
     *
     * The lap duration stored in [StopwatchState.laps] is the wall-clock time since
     * the *previous* lap was recorded (or since the stopwatch was started if this is
     * the first lap).
     */
    fun lap(state: StopwatchState): StopwatchState {
        if (!state.isRunning) return state

        val now = clock.nowMs()
        val segmentMs = (now - state.startedAtMs).coerceAtLeast(0L)
        val runningTotalMs = state.elapsedMs + segmentMs

        // Duration of *this* lap = running total minus the sum of all previous laps
        val previousLapsTotal = state.laps.sum()
        val lapDurationMs = (runningTotalMs - previousLapsTotal).coerceAtLeast(0L)

        return state.copy(
            currentSegmentMs = segmentMs,
            laps = state.laps + lapDurationMs,
            // Keep startedAtMs unchanged – we do NOT reset the segment clock on lap
        )
    }

    /**
     * Advance the live [StopwatchState.currentSegmentMs] to reflect the current
     * wall-clock time.
     *
     * Call this on every UI tick (e.g. once per frame or every ~10 ms) while
     * [StopwatchState.isRunning] is `true`.  Safe to call when stopped – returns the
     * state unchanged.
     */
    fun tick(state: StopwatchState): StopwatchState {
        if (!state.isRunning) return state
        val now = clock.nowMs()
        val segmentMs = (now - state.startedAtMs).coerceAtLeast(0L)
        return state.copy(currentSegmentMs = segmentMs)
    }

    // -------------------------------------------------------------------------
    // Clock abstraction
    // -------------------------------------------------------------------------

    /**
     * Minimal time source used by the engine.
     *
     * Inject a test double in unit tests to keep timing deterministic.
     */
    fun interface Clock {
        /** Returns the current time in milliseconds since the Unix epoch. */
        fun nowMs(): Long
    }

    /** Default [Clock] backed by [System.currentTimeMillis]. */
    object SystemClock : Clock {
        override fun nowMs(): Long = System.currentTimeMillis()
    }
}
