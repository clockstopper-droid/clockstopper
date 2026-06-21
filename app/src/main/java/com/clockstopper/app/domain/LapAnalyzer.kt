package com.clockstopper.app.domain

/**
 * LapAnalyzer
 * ───────────
 * Pure-Kotlin use case that converts a raw list of lap-split durations (as
 * stored in [StopwatchState.laps]) into a richer list of [LapSummary] objects
 * suitable for direct display in the lap-list RecyclerView.
 *
 * Responsibilities
 * ────────────────
 * - Assign 1-based lap numbers.
 * - Compute cumulative elapsed time for each lap.
 * - Delegate formatting to [TimeFormatter] so the UI layer deals only with
 *   ready-to-display strings.
 *
 * The list returned by [analyze] is ordered so that the **most recent lap
 * appears first** (index 0), matching the conventional stopwatch display
 * where the latest split is always at the top.
 */
object LapAnalyzer {

    /**
     * Convert a list of raw split durations into display-ready [LapSummary]s.
     *
     * @param splits Ordered list of split durations in milliseconds, earliest
     *               first — exactly as stored in [StopwatchState.laps].
     * @return A new list of [LapSummary] objects in **reverse** order (newest
     *         lap first), ready to bind directly to the RecyclerView adapter.
     */
    fun analyze(splits: List<Long>): List<LapSummary> {
        if (splits.isEmpty()) return emptyList()

        var cumulative = 0L
        // Build summaries in chronological order first, then reverse.
        val chronological = splits.mapIndexed { index, splitMs ->
            cumulative += splitMs
            LapSummary(
                lapNumber = index + 1,
                splitMs = splitMs,
                cumulativeMs = cumulative,
                formattedSplit = TimeFormatter.format(splitMs),
                formattedCumulative = TimeFormatter.format(cumulative),
            )
        }
        return chronological.asReversed()
    }
}
