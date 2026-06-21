package com.clockstopper.app.domain

import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Unit tests for [LapAnalyzer].
 *
 * These run on the JVM (no Android instrumentation required).
 * Run with:  ./gradlew test
 *
 * Coverage areas:
 *   - Best / worst lap identification from a list of lap durations
 *   - Edge cases: single lap, two laps, identical durations, large counts
 *   - [LapSummary] data integrity after analysis
 */
class LapAnalyzerTest {

    private lateinit var analyzer: LapAnalyzer

    @Before
    fun setUp() {
        analyzer = LapAnalyzer()
    }

    // -----------------------------------------------------------------------
    // Null / trivially-empty input
    // -----------------------------------------------------------------------

    @Test
    fun emptyLapListReturnsNoBestWorst() {
        val result = analyzer.analyze(emptyList())
        assertNull("Best lap index should be null for empty list", result.bestLapIndex)
        assertNull("Worst lap index should be null for empty list", result.worstLapIndex)
    }

    // -----------------------------------------------------------------------
    // Single lap — best and worst are the same element
    // -----------------------------------------------------------------------

    @Test
    fun singleLapHasBestAndWorstAtIndexZero() {
        val result = analyzer.analyze(listOf(5_000L))
        assertEquals("Best lap index should be 0 for single-element list", 0, result.bestLapIndex)
        assertEquals("Worst lap index should be 0 for single-element list", 0, result.worstLapIndex)
    }

    // -----------------------------------------------------------------------
    // Two laps — best is shorter, worst is longer
    // -----------------------------------------------------------------------

    @Test
    fun twoLapsCorrectBestAndWorst() {
        // Lap 0 = 3 s (shorter = best), Lap 1 = 7 s (longer = worst)
        val result = analyzer.analyze(listOf(3_000L, 7_000L))
        assertEquals("Lap 0 (3 s) should be the best", 0, result.bestLapIndex)
        assertEquals("Lap 1 (7 s) should be the worst", 1, result.worstLapIndex)
    }

    @Test
    fun twoLapsReversedOrderCorrectBestAndWorst() {
        val result = analyzer.analyze(listOf(8_000L, 2_000L))
        assertEquals("Lap 1 (2 s) should be the best", 1, result.bestLapIndex)
        assertEquals("Lap 0 (8 s) should be the worst", 0, result.worstLapIndex)
    }

    // -----------------------------------------------------------------------
    // Multiple laps
    // -----------------------------------------------------------------------

    @Test
    fun multipleLapsBestAndWorstAreCorrect() {
        // Durations: 6, 3, 9, 4, 7  →  best=index 1 (3), worst=index 2 (9)
        val laps = listOf(6_000L, 3_000L, 9_000L, 4_000L, 7_000L)
        val result = analyzer.analyze(laps)
        assertEquals("Index 1 (3 s) should be the best lap", 1, result.bestLapIndex)
        assertEquals("Index 2 (9 s) should be the worst lap", 2, result.worstLapIndex)
    }

    @Test
    fun bestLapIsAlwaysTheShortest() {
        val laps = listOf(10_000L, 20_000L, 5_000L, 15_000L)
        val result = analyzer.analyze(laps)
        val best = result.bestLapIndex!!
        val bestDuration = laps[best]
        laps.forEach { duration ->
            assertTrue(
                "Best lap ($bestDuration ms) should be <= every other lap ($duration ms)",
                bestDuration <= duration,
            )
        }
    }

    @Test
    fun worstLapIsAlwaysTheLongest() {
        val laps = listOf(10_000L, 20_000L, 5_000L, 15_000L)
        val result = analyzer.analyze(laps)
        val worst = result.worstLapIndex!!
        val worstDuration = laps[worst]
        laps.forEach { duration ->
            assertTrue(
                "Worst lap ($worstDuration ms) should be >= every other lap ($duration ms)",
                worstDuration >= duration,
            )
        }
    }

    // -----------------------------------------------------------------------
    // Identical durations — both best and worst should still be valid indices
    // -----------------------------------------------------------------------

    @Test
    fun identicalDurationsReturnValidIndices() {
        val laps = listOf(5_000L, 5_000L, 5_000L)
        val result = analyzer.analyze(laps)
        assertNotNull("Best lap index must not be null", result.bestLapIndex)
        assertNotNull("Worst lap index must not be null", result.worstLapIndex)
        assertTrue("Best lap index must be in range", result.bestLapIndex!! in laps.indices)
        assertTrue("Worst lap index must be in range", result.worstLapIndex!! in laps.indices)
    }

    // -----------------------------------------------------------------------
    // Large lap count — performance / correctness at scale
    // -----------------------------------------------------------------------

    @Test
    fun largeNumberOfLapsAnalyzedCorrectly() {
        val n = 1_000
        val laps = LongArray(n) { (it + 1) * 100L }.toList() // 100, 200, …, 100 000
        val result = analyzer.analyze(laps)
        assertEquals("First lap (shortest) should be best in monotonically increasing list",
            0, result.bestLapIndex)
        assertEquals("Last lap (longest) should be worst in monotonically increasing list",
            n - 1, result.worstLapIndex)
    }

    // -----------------------------------------------------------------------
    // LapSummary data integrity
    // -----------------------------------------------------------------------

    @Test
    fun lapSummaryContainsInputDurations() {
        val laps = listOf(4_000L, 2_000L, 6_000L)
        val result = analyzer.analyze(laps)
        assertEquals("LapSummary should preserve all lap durations", laps, result.lapDurationsMs)
    }

    @Test
    fun lapSummaryTotalIsCorrect() {
        val laps = listOf(1_000L, 2_000L, 3_000L)
        val result = analyzer.analyze(laps)
        assertEquals("Total should equal sum of all lap durations", 6_000L, result.totalDurationMs)
    }

    @Test
    fun lapSummaryAverageIsCorrect() {
        val laps = listOf(1_000L, 2_000L, 3_000L)
        val result = analyzer.analyze(laps)
        assertEquals("Average should be total / count", 2_000L, result.averageLapDurationMs)
    }

    @Test
    fun lapSummaryAverageRoundsForOddCounts() {
        // 1000 + 2000 + 3000 + 4000 = 10 000 / 4 = 2500 (exact)
        val laps = listOf(1_000L, 2_000L, 3_000L, 4_000L)
        val result = analyzer.analyze(laps)
        assertEquals(2_500L, result.averageLapDurationMs)
    }
}
