package com.clockstopper.app.domain

import org.junit.Assert.*
import org.junit.Test

/**
 * LapAnalyzerTest
 * ───────────────
 * Unit tests for [LapAnalyzer].
 *
 * Covers:
 *   A-1  Empty lap list → EMPTY summary
 *   A-2  Single lap → counts, totals, no rankings
 *   A-3  Two laps → rankings assigned
 *   A-4  Three+ laps → rankings reassigned on new extremes
 *   A-5  Tied splits → tie-break on first (lowest index)
 *   A-6  Average split calculation
 *   A-7  Delta fields (fastestDeltaMs / slowestDeltaMs)
 *   A-8  fastestLap / slowestLap / averageSplitMs helpers
 *   A-9  splitDelta helper
 *
 * No Android imports — pure JVM tests.
 */
class LapAnalyzerTest {

    // ── Helpers ───────────────────────────────────────────────────────────

    /**
     * Creates a bare [Lap] with the supplied split.  [totalMs] is computed
     * as cumulative sum of all splits up to this point; callers may override.
     */
    private fun lap(index: Int, splitMs: Long, totalMs: Long = splitMs): Lap =
        Lap(index = index, splitMs = splitMs, totalMs = totalMs)

    private fun laps(vararg splitMs: Long): List<Lap> {
        var total = 0L
        return splitMs.mapIndexed { i, split ->
            total += split
            Lap(index = i + 1, splitMs = split, totalMs = total)
        }
    }

    // ── A-1  Empty list ───────────────────────────────────────────────────

    @Test
    fun `summarize empty list returns EMPTY sentinel`() {
        val summary = LapAnalyzer.summarize(emptyList())
        assertEquals(LapSummary.EMPTY, summary)
    }

    @Test
    fun `summarize empty list has zero lapCount`() {
        assertEquals(0, LapAnalyzer.summarize(emptyList()).lapCount)
    }

    @Test
    fun `summarize empty list has null averageSplitMs`() {
        assertNull(LapAnalyzer.summarize(emptyList()).averageSplitMs)
    }

    @Test
    fun `summarize empty list has zero totalElapsedMs`() {
        assertEquals(0L, LapAnalyzer.summarize(emptyList()).totalElapsedMs)
    }

    // ── A-2  Single lap ───────────────────────────────────────────────────

    @Test
    fun `summarize single lap has correct lapCount`() {
        val summary = LapAnalyzer.summarize(laps(5_000))
        assertEquals(1, summary.lapCount)
    }

    @Test
    fun `summarize single lap has no fastest or slowest`() {
        val summary = LapAnalyzer.summarize(laps(5_000))
        assertNull(summary.fastestLapIndex)
        assertNull(summary.fastestSplitMs)
        assertNull(summary.slowestLapIndex)
        assertNull(summary.slowestSplitMs)
    }

    @Test
    fun `summarize single lap has correct average`() {
        val summary = LapAnalyzer.summarize(laps(4_000))
        assertEquals(4_000L, summary.averageSplitMs)
    }

    @Test
    fun `summarize single lap has correct totalElapsedMs`() {
        val summary = LapAnalyzer.summarize(laps(7_500))
        assertEquals(7_500L, summary.totalElapsedMs)
    }

    @Test
    fun `summarize single lap has null delta fields`() {
        val summary = LapAnalyzer.summarize(laps(3_000))
        assertNull(summary.fastestDeltaMs)
        assertNull(summary.slowestDeltaMs)
    }

    // ── A-3  Two laps ─────────────────────────────────────────────────────

    @Test
    fun `summarize two laps assigns fastest and slowest`() {
        val summary = LapAnalyzer.summarize(laps(1_000, 2_000))
        assertEquals(1, summary.fastestLapIndex)   // lap 1 = 1 000 ms
        assertEquals(2, summary.slowestLapIndex)   // lap 2 = 2 000 ms
    }

    @Test
    fun `summarize two laps fastest split value is correct`() {
        val summary = LapAnalyzer.summarize(laps(1_000, 3_000))
        assertEquals(1_000L, summary.fastestSplitMs)
    }

    @Test
    fun `summarize two laps slowest split value is correct`() {
        val summary = LapAnalyzer.summarize(laps(1_000, 3_000))
        assertEquals(3_000L, summary.slowestSplitMs)
    }

    @Test
    fun `summarize two laps average is mean of splits`() {
        val summary = LapAnalyzer.summarize(laps(1_000, 3_000))
        assertEquals(2_000L, summary.averageSplitMs)
    }

    @Test
    fun `summarize two laps totalElapsedMs is sum of splits`() {
        val summary = LapAnalyzer.summarize(laps(1_000, 3_000))
        assertEquals(4_000L, summary.totalElapsedMs)
    }

    // ── A-4  Three laps — rankings reassigned ─────────────────────────────

    @Test
    fun `summarize three laps fastest is shortest split`() {
        // splits: 3 000, 1 000, 2 000
        val summary = LapAnalyzer.summarize(laps(3_000, 1_000, 2_000))
        assertEquals(2, summary.fastestLapIndex)   // lap 2 = 1 000 ms
        assertEquals(1_000L, summary.fastestSplitMs)
    }

    @Test
    fun `summarize three laps slowest is longest split`() {
        val summary = LapAnalyzer.summarize(laps(3_000, 1_000, 2_000))
        assertEquals(1, summary.slowestLapIndex)   // lap 1 = 3 000 ms
        assertEquals(3_000L, summary.slowestSplitMs)
    }

    @Test
    fun `summarize average rounds down on integer division`() {
        // splits: 1 000, 1 000, 1 001 → sum = 3 001 / 3 = 1 000 (integer)
        val summary = LapAnalyzer.summarize(laps(1_000, 1_000, 1_001))
        assertEquals(1_000L, summary.averageSplitMs)
    }

    // ── A-5  Tied splits — tie-break ──────────────────────────────────────

    @Test
    fun `summarize tied fastest laps — first lap wins`() {
        val summary = LapAnalyzer.summarize(laps(1_000, 1_000, 2_000))
        assertEquals(1, summary.fastestLapIndex)   // tie → index 1 wins
    }

    @Test
    fun `summarize tied slowest laps — first lap wins`() {
        val summary = LapAnalyzer.summarize(laps(2_000, 2_000, 1_000))
        assertEquals(1, summary.slowestLapIndex)   // tie → index 1 wins
    }

    // ── A-6  Average split ────────────────────────────────────────────────

    @Test
    fun `averageSplitMs helper matches summarize`() {
        val lapList = laps(2_000, 4_000, 6_000)
        val fromHelper = LapAnalyzer.averageSplitMs(lapList)
        val fromSummary = LapAnalyzer.summarize(lapList).averageSplitMs
        assertEquals(fromSummary, fromHelper)
    }

    @Test
    fun `averageSplitMs helper returns null for empty list`() {
        assertNull(LapAnalyzer.averageSplitMs(emptyList()))
    }

    // ── A-7  Delta fields ─────────────────────────────────────────────────

    @Test
    fun `fastestDeltaMs is negative when fastest is below average`() {
        // splits: 1 000, 3 000 → avg = 2 000; fastest = 1 000; delta = −1 000
        val summary = LapAnalyzer.summarize(laps(1_000, 3_000))
        assertEquals(-1_000L, summary.fastestDeltaMs)
    }

    @Test
    fun `slowestDeltaMs is positive when slowest is above average`() {
        // splits: 1 000, 3 000 → avg = 2 000; slowest = 3 000; delta = +1 000
        val summary = LapAnalyzer.summarize(laps(1_000, 3_000))
        assertEquals(1_000L, summary.slowestDeltaMs)
    }

    @Test
    fun `all equal splits produce zero deltas`() {
        val summary = LapAnalyzer.summarize(laps(2_000, 2_000, 2_000))
        assertEquals(0L, summary.fastestDeltaMs)
        assertEquals(0L, summary.slowestDeltaMs)
    }

    // ── A-8  fastestLap / slowestLap helpers ─────────────────────────────

    @Test
    fun `fastestLap returns null for empty list`() {
        assertNull(LapAnalyzer.fastestLap(emptyList()))
    }

    @Test
    fun `fastestLap returns null for single lap`() {
        assertNull(LapAnalyzer.fastestLap(laps(1_000)))
    }

    @Test
    fun `fastestLap returns correct lap for two laps`() {
        val lapList = laps(3_000, 1_000)
        val fastest = LapAnalyzer.fastestLap(lapList)
        assertNotNull(fastest)
        assertEquals(2, fastest!!.index)
        assertEquals(1_000L, fastest.splitMs)
    }

    @Test
    fun `slowestLap returns null for empty list`() {
        assertNull(LapAnalyzer.slowestLap(emptyList()))
    }

    @Test
    fun `slowestLap returns null for single lap`() {
        assertNull(LapAnalyzer.slowestLap(laps(2_000)))
    }

    @Test
    fun `slowestLap returns correct lap for three laps`() {
        val lapList = laps(2_000, 5_000, 3_000)
        val slowest = LapAnalyzer.slowestLap(lapList)
        assertNotNull(slowest)
        assertEquals(2, slowest!!.index)
        assertEquals(5_000L, slowest.splitMs)
    }

    // ── A-9  splitDelta helper ────────────────────────────────────────────

    @Test
    fun `splitDelta returns zero when split equals reference`() {
        val l = lap(1, 2_000L)
        assertEquals(0L, LapAnalyzer.splitDelta(l, 2_000L))
    }

    @Test
    fun `splitDelta is negative when split is below reference`() {
        val l = lap(1, 1_000L)
        assertEquals(-1_000L, LapAnalyzer.splitDelta(l, 2_000L))
    }

    @Test
    fun `splitDelta is positive when split is above reference`() {
        val l = lap(1, 3_000L)
        assertEquals(1_000L, LapAnalyzer.splitDelta(l, 2_000L))
    }
}
