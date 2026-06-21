package com.clockstopper.app.domain

/**
 * LapSummary
 * ──────────
 * Aggregated statistics computed from a collection of [Lap] records.
 *
 * Produced by [LapAnalyzer.summarize]; callers receive an instance of this
 * class and bind its fields directly to UI elements without any further
 * calculation.
 *
 * All fields are platform-agnostic primitives — no Android imports, no DOM
 * references.
 *
 * ### Field reference
 *
 * | Field | Unit | Meaning |
 * |---|---|---|
 * | [lapCount] | count | Total number of laps recorded |
 * | [fastestLapIndex] | 1-based | 1-based index of the lap with the shortest split, or `null` if < 2 laps |
 * | [fastestSplitMs] | ms | Shortest split duration, or `null` if < 2 laps |
 * | [slowestLapIndex] | 1-based | 1-based index of the lap with the longest split, or `null` if < 2 laps |
 * | [slowestSplitMs] | ms | Longest split duration, or `null` if < 2 laps |
 * | [averageSplitMs] | ms | Mean split duration across all laps, or `null` if no laps |
 * | [totalElapsedMs] | ms | Cumulative elapsed time of the last recorded lap, or 0 if no laps |
 * | [fastestDeltaMs] | ms | Fastest split minus average (negative = ahead of average), or `null` if < 2 laps |
 * | [slowestDeltaMs] | ms | Slowest split minus average (positive = behind average), or `null` if < 2 laps |
 */
data class LapSummary(

    /** Total number of laps recorded. */
    val lapCount: Int,

    /**
     * 1-based index of the lap with the shortest split duration.
     * `null` when fewer than 2 laps have been recorded.
     */
    val fastestLapIndex: Int?,

    /**
     * Duration of the fastest lap split in milliseconds.
     * `null` when fewer than 2 laps have been recorded.
     */
    val fastestSplitMs: Long?,

    /**
     * 1-based index of the lap with the longest split duration.
     * `null` when fewer than 2 laps have been recorded.
     */
    val slowestLapIndex: Int?,

    /**
     * Duration of the slowest lap split in milliseconds.
     * `null` when fewer than 2 laps have been recorded.
     */
    val slowestSplitMs: Long?,

    /**
     * Arithmetic mean of all lap splits in milliseconds.
     * `null` when no laps have been recorded.
     */
    val averageSplitMs: Long?,

    /**
     * Cumulative elapsed time at the end of the last recorded lap in milliseconds.
     * `0` when no laps have been recorded.
     */
    val totalElapsedMs: Long,

    /**
     * Difference between the fastest split and the average split in milliseconds.
     * A **negative** value means the fastest lap was ahead of the average.
     * `null` when fewer than 2 laps have been recorded (no meaningful ranking).
     */
    val fastestDeltaMs: Long?,

    /**
     * Difference between the slowest split and the average split in milliseconds.
     * A **positive** value means the slowest lap was behind the average.
     * `null` when fewer than 2 laps have been recorded (no meaningful ranking).
     */
    val slowestDeltaMs: Long?,
) {
    companion object {
        /** Sentinel empty summary returned when no laps are present. */
        val EMPTY = LapSummary(
            lapCount = 0,
            fastestLapIndex = null,
            fastestSplitMs = null,
            slowestLapIndex = null,
            slowestSplitMs = null,
            averageSplitMs = null,
            totalElapsedMs = 0L,
            fastestDeltaMs = null,
            slowestDeltaMs = null,
        )
    }
}
