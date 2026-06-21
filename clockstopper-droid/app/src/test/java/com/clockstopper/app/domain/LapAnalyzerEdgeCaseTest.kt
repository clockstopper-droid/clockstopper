package com.clockstopper.app.domain

import org.junit.Assert.*
import org.junit.Test

/**
 * Edge-case and contract tests for [LapAnalyzer].
 * All tests run on the plain JVM.
 */
class LapAnalyzerEdgeCaseTest {

    @Test
    fun `when two laps tie for best the lower index wins`() {
        val summary = LapAnalyzer.analyze(listOf(1_000L, 3_000L, 1_000L))!!
        assertEquals(0, summary.bestLapIndex)
    }

    @Test
    fun `when two laps tie for worst the lower index wins`() {
        val summary = LapAnalyzer.analyze(listOf(5_000L, 5_000L, 2_000L))!!
        assertEquals(0, summary.worstLapIndex)
    }

    @Test
    fun `zero-duration lap is recognised as best lap`() {
        val summary = LapAnalyzer.analyze(listOf(0L, 2_000L, 4_000L))!!
        assertEquals(0L, summary.bestLapMs)
        assertEquals(0, summary.bestLapIndex)
    }

    @Test
    fun `average of three unequal laps truncates correctly`() {
        val summary = LapAnalyzer.analyze(listOf(1_000L, 2_000L, 4_000L))!!
        val expected = (1_000L + 2_000L + 4_000L) / 3
        assertEquals(expected, summary.averageLapMs)
    }

    @Test
    fun `total elapsed sums all lap durations`() {
        val laps = listOf(1_100L, 2_200L, 3_300L, 4_400L)
        val summary = LapAnalyzer.analyze(laps)!!
        assertEquals(11_000L, summary.totalElapsedMs)
    }

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
