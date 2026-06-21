package com.clockstopper.app.domain

/**
 * Immutable snapshot of a completed lap.
 *
 * @property lapNumber   1-based lap index (first lap = 1).
 * @property splitMs     Duration of this lap in milliseconds
 *                       (i.e. time elapsed since the previous lap marker).
 * @property cumulativeMs  Total elapsed time at the moment the lap was recorded.
 */
data class LapSummary(
    val lapNumber: Int,
    val splitMs: Long,
    val cumulativeMs: Long
)
