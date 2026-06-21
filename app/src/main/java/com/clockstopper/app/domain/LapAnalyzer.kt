package com.clockstopper.app.domain

/**
 * LapAnalyzer
 * ───────────
 * **Pure, platform-agnostic** utility that computes aggregate statistics over
 * a list of [Lap] records.
 *
 * All functions are stateless and deterministic: given the same list of laps
 * they always return the same [LapSummary].  No Android imports, no coroutines,
 * no threading — safe to call from any thread or test harness.
 *
 * ### Responsibility boundary
 * [LapAnalyzer] is *read-only*: it never creates, modifies, or reorders laps.
 * Mutation of the lap list is the sole responsibility of [StopwatchEngine].
 * [LapAnalyzer] consumes the list produced by [StopwatchEngine.snapshot] and
 * reduces it into statistics for display.
 *
 * ### Origin in web app (`app.js`)
 * The original JavaScript implementation computed fastest/slowest lap indices
 * inline in the render loop.  This class extracts that logic into a dedicated,
 * independently-testable module.
 */
object LapAnalyzer {

    // ── Public API ────────────────────────────────────────────────────────

    /**
     * Computes a [LapSummary] from [laps].
     *
     * Returns [LapSummary.EMPTY] when [laps] is empty so callers never need
     * to handle `null`.
     *
     * Rankings ([LapSummary.fastestLapIndex], [LapSummary.slowestLapIndex],
     * [LapSummary.fastestDeltaMs], [LapSummary.slowestDeltaMs]) are `null`
     * when fewer than two laps are present — a single lap has no peer to
     * compare against.
     *
     * Tie-breaking: when two or more laps share the exact same split the
     * **first** lap (lowest [Lap.index]) wins the ranking.
     *
     * @param laps Ordered list of completed lap records (oldest first).
     * @return Aggregated [LapSummary] for the supplied laps.
     */
    fun summarize(laps: List<Lap>): LapSummary {
        if (laps.isEmpty()) return LapSummary.EMPTY

        val lapCount = laps.size
        val totalElapsedMs = laps.last().totalMs
        val averageSplitMs = laps.sumOf { it.splitMs } / lapCount

        // Rankings only apply when there are at least 2 laps.
        if (lapCount < 2) {
            return LapSummary(
                lapCount = lapCount,
                fastestLapIndex = null,
                fastestSplitMs = null,
                slowestLapIndex = null,
                slowestSplitMs = null,
                averageSplitMs = averageSplitMs,
                totalElapsedMs = totalElapsedMs,
                fastestDeltaMs = null,
                slowestDeltaMs = null,
            )
        }

        val fastest = laps.minByOrNull { it.splitMs }!! // safe: size >= 2
        val slowest = laps.maxByOrNull { it.splitMs }!! // safe: size >= 2

        return LapSummary(
            lapCount = lapCount,
            fastestLapIndex = fastest.index,
            fastestSplitMs = fastest.splitMs,
            slowestLapIndex = slowest.index,
            slowestSplitMs = slowest.splitMs,
            averageSplitMs = averageSplitMs,
            totalElapsedMs = totalElapsedMs,
            fastestDeltaMs = fastest.splitMs - averageSplitMs,
            slowestDeltaMs = slowest.splitMs - averageSplitMs,
        )
    }

    // ── Ranking predicates (used by [StopwatchEngine] and UI) ────────────

    /**
     * Returns the [Lap] with the shortest split from [laps], or `null` if
     * the list is empty or contains only one lap.
     *
     * Tie-breaking: returns the earliest lap (lowest [Lap.index]).
     */
    fun fastestLap(laps: List<Lap>): Lap? =
        if (laps.size < 2) null else laps.minByOrNull { it.splitMs }

    /**
     * Returns the [Lap] with the longest split from [laps], or `null` if
     * the list is empty or contains only one lap.
     *
     * Tie-breaking: returns the earliest lap (lowest [Lap.index]).
     */
    fun slowestLap(laps: List<Lap>): Lap? =
        if (laps.size < 2) null else laps.maxByOrNull { it.splitMs }

    /**
     * Computes the average split duration across [laps] in milliseconds, or
     * `null` if [laps] is empty.
     */
    fun averageSplitMs(laps: List<Lap>): Long? =
        if (laps.isEmpty()) null else laps.sumOf { it.splitMs } / laps.size

    /**
     * Returns the signed delta (in ms) between [lap]'s split and the
     * [referenceSplitMs].
     *
     * - Negative → this lap was **faster** than the reference.
     * - Positive → this lap was **slower** than the reference.
     * - Zero → exactly on pace.
     *
     * Typically used to compute the delta from the average or the best lap.
     */
    fun splitDelta(lap: Lap, referenceSplitMs: Long): Long =
        lap.splitMs - referenceSplitMs
}
