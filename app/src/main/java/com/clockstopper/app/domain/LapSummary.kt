package com.clockstopper.app.domain

/**
 * LapSummary
 * ──────────
 * Derived view model for a single lap entry as displayed in the lap list.
 *
 * The domain stores raw split durations (ms) in [StopwatchState.laps]; this
 * data class packages the information the UI actually needs without burdening
 * the UI layer with the derivation logic.
 *
 * @property lapNumber        1-based display index shown to the user.
 * @property splitMs          Duration of this lap in milliseconds (time
 *                            elapsed since the previous lap or since start).
 * @property cumulativeMs     Total elapsed time at the end of this lap
 *                            (sum of all splits up to and including this one).
 * @property formattedSplit   [splitMs] formatted as `MM:SS.cc`.
 * @property formattedCumulative [cumulativeMs] formatted as `MM:SS.cc`.
 */
data class LapSummary(
    val lapNumber: Int,
    val splitMs: Long,
    val cumulativeMs: Long,
    val formattedSplit: String,
    val formattedCumulative: String,
)
