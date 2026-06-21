package com.clockstopper.app.domain

/**
 * Stateless utility that analyses a list of [LapSummary] records and
 * annotates each one with whether it is the fastest, slowest, or neither.
 *
 * No Android framework dependency – testable with plain JUnit.
 */
object LapAnalyzer {

    /** Classification of a single lap relative to the full lap set. */
    enum class Rank { BEST, WORST, NORMAL }

    /**
     * Pairs each [LapSummary] in [laps] with its [Rank].
     *
     * - If [laps] is empty or has exactly one entry, all entries are [Rank.NORMAL].
     * - Ties for best/worst are both marked accordingly.
     *
     * @param laps  The complete list of recorded laps (order does not matter).
     * @return      A list of (LapSummary, Rank) pairs in the same order as [laps].
     */
    fun rank(laps: List<LapSummary>): List<Pair<LapSummary, Rank>> {
        if (laps.size <= 1) return laps.map { it to Rank.NORMAL }

        val minSplit = laps.minOf { it.splitMs }
        val maxSplit = laps.maxOf { it.splitMs }

        return laps.map { lap ->
            val rank = when {
                lap.splitMs == minSplit -> Rank.BEST
                lap.splitMs == maxSplit -> Rank.WORST
                else                   -> Rank.NORMAL
            }
            lap to rank
        }
    }
}
