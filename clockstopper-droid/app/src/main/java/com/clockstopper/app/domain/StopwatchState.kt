package com.clockstopper.app.domain

/**
 * Immutable snapshot of the stopwatch at any point in time.
 *
 * All time values are expressed in **milliseconds**.
 *
 * @property elapsedMs       Total accumulated elapsed time (does NOT include the
 *                           currently-running segment when [isRunning] is true – add
 *                           [currentSegmentMs] to get the true running total).
 * @property currentSegmentMs Duration of the in-progress segment (i.e. wall-clock time
 *                            since [startedAtMs] was last set).  Zero when stopped.
 * @property startedAtMs      The [System.currentTimeMillis] timestamp at which the
 *                            most-recent "start" occurred.  -1 when stopped.
 * @property isRunning        Whether the stopwatch is currently counting up.
 * @property laps             Immutable ordered list of completed lap durations (ms),
 *                            oldest first.
 */
data class StopwatchState(
    val elapsedMs: Long = 0L,
    val currentSegmentMs: Long = 0L,
    val startedAtMs: Long = -1L,
    val isRunning: Boolean = false,
    val laps: List<Long> = emptyList(),
) {
    /** True total time shown to the user (accumulated + live segment). */
    val totalElapsedMs: Long get() = elapsedMs + currentSegmentMs

    companion object {
        /** Canonical initial/reset state. */
        val INITIAL = StopwatchState()
    }
}
