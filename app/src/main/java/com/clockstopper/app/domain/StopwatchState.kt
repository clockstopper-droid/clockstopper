package com.clockstopper.app.domain

/**
 * StopwatchState
 * ──────────────
 * Immutable value type describing every observable aspect of the stopwatch at
 * a single point in time.
 *
 * All fields are platform-agnostic primitives or collections of domain types.
 * Nothing here imports or references any Android framework class.
 *
 * ### Fields
 * | Field | Meaning |
 * |---|---|
 * | [status] | Whether the stopwatch is idle, running, or paused |
 * | [elapsedMs] | Total elapsed wall-clock time in milliseconds |
 * | [lapSplitMs] | Elapsed time since the most recently recorded lap (or since start if no laps) |
 * | [laps] | Ordered list of all recorded laps (oldest first) |
 *
 * ### Derived helpers
 * [isRunning], [isPaused], [isReset] — convenience predicates derived from [status].
 * [lapCount] — number of laps recorded so far.
 * [hasFastestLap] / [hasSlowestLap] — true only when there are enough laps to rank.
 */
data class StopwatchState(
    val status: StopwatchStatus = StopwatchStatus.RESET,
    val elapsedMs: Long = 0L,
    val lapSplitMs: Long = 0L,
    val laps: List<Lap> = emptyList(),
) {
    // ── Convenience predicates ───────────────────────────────────────────────

    val isRunning: Boolean get() = status == StopwatchStatus.RUNNING
    val isPaused: Boolean get() = status == StopwatchStatus.PAUSED
    val isReset: Boolean get() = status == StopwatchStatus.RESET

    // ── Lap convenience ─────────────────────────────────────────────────────

    val lapCount: Int get() = laps.size

    /**
     * The most recently completed lap, or `null` if no laps have been recorded.
     */
    val lastLap: Lap? get() = laps.lastOrNull()

    /**
     * True when there are at least two laps and a fastest lap can be identified.
     * A single lap has no peer to compare against so no lap can be "fastest."
     */
    val hasFastestLap: Boolean get() = laps.size >= 2

    /**
     * True when there are at least two laps and a slowest lap can be identified.
     * Mirrors the logic of [hasFastestLap].
     */
    val hasSlowestLap: Boolean get() = laps.size >= 2
}

// ── Supporting types ─────────────────────────────────────────────────────────

/**
 * Three-state machine for the stopwatch lifecycle.
 *
 * ```
 * RESET ──start──▶ RUNNING ──stop──▶ PAUSED
 *                             ◀──start──
 * PAUSED ──reset──▶ RESET
 * RUNNING ──reset──▶ RESET   (guard: only allowed when paused, but modelled here for completeness)
 * ```
 */
enum class StopwatchStatus {
    /** Stopwatch has never been started, or has been fully reset. */
    RESET,

    /** Stopwatch is actively counting elapsed time. */
    RUNNING,

    /** Stopwatch was running and has been paused; elapsed time is preserved. */
    PAUSED,
}

/**
 * Lap
 * ───
 * Represents a single lap entry recorded by the user.
 *
 * @param index      1-based position of this lap (first lap is 1).
 * @param splitMs    Duration of *this* lap interval in milliseconds
 *                   (time since the previous lap, or since the start for lap 1).
 * @param totalMs    Cumulative elapsed time at the moment this lap was recorded.
 * @param isFastest  True when this lap has the shortest [splitMs] among all laps
 *                   recorded so far (only meaningful when [StopwatchState.hasFastestLap]).
 * @param isSlowest  True when this lap has the longest [splitMs] among all laps
 *                   recorded so far (only meaningful when [StopwatchState.hasSlowestLap]).
 */
data class Lap(
    val index: Int,
    val splitMs: Long,
    val totalMs: Long,
    val isFastest: Boolean = false,
    val isSlowest: Boolean = false,
)
