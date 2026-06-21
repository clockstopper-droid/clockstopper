package com.clockstopper.app.domain

/**
 * Pure utility object that derives statistics from a list of lap durations.
 *
 * No Android dependencies; safe to use from unit tests on the plain JVM.
 */
object LapAnalyzer {

    /**
     * Compute a [LapSummary] from [laps], which is expected to be the
     * [StopwatchState.laps] list (lap durations in milliseconds, oldest first).
     *
     * An empty list produces a summary with all nullable fields set to `null`
     * and a zero total.
     */
    fun summarise(laps: List<Long>): LapSummary {
        if (laps.isEmpty()) {
            return LapSummary(
                count = 0,
                fastestMs = null,
                slowestMs = null,
                averageMs = null,
                totalMs = 0L,
            )
        }
        val total = laps.sum()
        return LapSummary(
            count = laps.size,
            fastestMs = laps.min(),
            slowestMs = laps.max(),
            averageMs = total / laps.size,
            totalMs = total,
        )
    }

    /**
     * Return the index of the fastest lap in [laps], or -1 for an empty list.
     *
     * Useful for highlighting the fastest lap row in a UI list.
     */
    fun fastestIndex(laps: List<Long>): Int =
        if (laps.isEmpty()) -1 else laps.indexOf(laps.min())

    /**
     * Return the index of the slowest lap in [laps], or -1 for an empty list.
     *
     * Useful for highlighting the slowest lap row in a UI list.
     */
    fun slowestIndex(laps: List<Long>): Int =
        if (laps.isEmpty()) -1 else laps.indexOf(laps.max())
}
