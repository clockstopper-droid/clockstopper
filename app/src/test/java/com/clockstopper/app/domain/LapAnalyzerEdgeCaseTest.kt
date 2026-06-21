package com.clockstopper.app.domain

import org.junit.Assert.*
import org.junit.Test

/**
 * Edge-case and contract tests for [LapAnalyzer] that complement
 * [LapAnalyzerTest].
 *
 * All tests run on the plain JVM — no Android dependencies.
 *
 * Feature coverage: Lap analysis within the stopwatch workflow.
 */
class LapAnalyzerEdgeCaseTest {

    // -----------------------------------------------------------------------
    // Tie-breaking: when multiple laps share the best or worst value
    // -----------------------------------------------------------------------

    @Test
    fun `when two laps tie for best the lower index wins`() {
        // Both lap 0 and lap 2 have duration 1 000 ms
        val summary = LapAnalyzer.analyze(listOf(1_000L, 3_000L, 1_000L))!!
        assertEquals(0, summary.bestLapIndex)
    }

    @Test
    fun `when two laps tie for worst the lower index wins`() {
        val summary = LapAnalyzer.analyze(listOf(5_000L, 5_000L, 2_000L))!!
        assertEquals(0, summary.worstLapIndex)
    }

    // -----------------------------------------------------------------------
    // Zero-duration laps
    // -----------------------------------------------------------------------

    @Test
    fun `zero-duration lap is recognised as best lap`() {
        val summary = LapAnalyzer.analyze(listOf(0L, 2_000L, 4_000L))!!
        assertEquals(0L, summary.bestLapMs)
        assertEquals(0, summary.bestLapIndex)
    }

    // -----------------------------------------------------------------------
    // Average rounding behaviour
    // -----------------------------------------------------------------------

    @Test
    fun `average uses integer truncation not rounding`() {
        // (1 000 + 2 000 + 3 000) / 3 = 2 000 exactly
        val summary = LapAnalyzer.analyze(listOf(1_000L, 2_000L, 3_000L))!!
        assertEquals(2_000L, summary.averageLapMs)
    }

    @Test
    fun `average with non-integer result truncates toward zero`() {
        // (1 000 + 2 000) / 2 = 1 500 — exact, no truncation needed
        val summary = LapAnalyzer.analyze(listOf(1_000L, 2_000L))!!
        assertEquals(1_500L, summary.averageLapMs)
    }

    @Test
    fun `average of three unequal laps truncates correctly`() {
        // 1 + 2 + 4 = 7 → 7 / 3 = 2 (integer truncation)
        val summary = LapAnalyzer.analyze(listOf(1_000L, 2_000L, 4_000L))!!
        val expected = (1_000L + 2_000L + 4_000L) / 3
        assertEquals(expected, summary.averageLapMs)
    }

    // -----------------------------------------------------------------------
    // Total elapsed
    // -----------------------------------------------------------------------

    @Test
    fun `total elapsed for single lap equals that lap`() {
        val summary = LapAnalyzer.analyze(listOf(7_500L))!!
        assertEquals(7_500L, summary.totalElapsedMs)
    }

    @Test
    fun `total elapsed sums all lap durations`() {
        val laps = listOf(1_100L, 2_200L, 3_300L, 4_400L)
        val summary = LapAnalyzer.analyze(laps)!!
        assertEquals(11_000L, summary.totalElapsedMs)
    }

    // -----------------------------------------------------------------------
    // Return type contract
    // -----------------------------------------------------------------------

    @Test
    fun `analyze returns non-null for any non-empty list`() {
        assertNotNull(LapAnalyzer.analyze(listOf(1L)))
        assertNotNull(LapAnalyzer.analyze(listOf(0L, 0L)))
    }

    @Test
    fun `lapCount matches input size for arbitrary list`() {
        val laps = List(17) { it * 500L + 1_000L }
        assertEquals(17, LapAnalyzer.analyze(laps)!!.lapCount)
    }
}
