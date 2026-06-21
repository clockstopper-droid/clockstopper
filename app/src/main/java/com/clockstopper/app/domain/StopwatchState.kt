package com.clockstopper.app.domain

/**
 * StopwatchState
 * ──────────────
 * Represents the complete, immutable snapshot of the stopwatch at any given
 * moment in time.  This is the primary data model that flows from the domain
 * layer ([StopwatchEngine]) up through the ViewModel and into the UI layer.
 *
 * @property elapsedMs        Total elapsed wall-clock milliseconds since the
 *                            stopwatch was last started (accumulated across
 *                            multiple start/stop cycles).
 * @property isRunning        `true` while the stopwatch is actively counting.
 * @property laps             Ordered list of lap split times in milliseconds
 *                            (earliest lap first).  Empty when no laps have
 *                            been recorded or after a reset.
 */
data class StopwatchState(
    val elapsedMs: Long = 0L,
    val isRunning: Boolean = false,
    val laps: List<Long> = emptyList(),
) {
    companion object {
        /** Canonical zeroed / initial state. */
        val INITIAL: StopwatchState = StopwatchState()
    }
}
