package com.clockstopper.app.domain

import org.junit.Assert.*
import org.junit.Test

/**
 * Unit tests for [LapAnalyzer].
 *
 * Covers statistical analysis of lap lists: best lap, worst lap, average lap,
 * edge cases (empty list, single lap, all equal laps, large lists).
 *
 * All tests run on the plain JVM — no Android dependencies.
 *
 * Feature coverage: Lap recording and analysis within the stopwatch workflow.
 */
class LapAnalyzerTest {

    // -----------------------------------------------------------------------
    // Empty / null-guard cases
    // -----------------------------------------------------------------------

    @Test
    fun `analyze empty list returns null summary`() {
        val summary = LapAnalyzer.analyze(emptyList())
        assertNull(summary)
    }

    // -----------------------------------------------------------------------
    // Single-lap cases
    // -----------------------------------------------------------------------

    @Test
    fun `single lap — best equals that lap`() {
        val summary = LapAnalyzer.analyze(listOf(5_000L))!!
        assertEquals(5_000L, summary.bestLapMs)
    }

    @Test
    fun `single lap — worst equals that lap`() {
        val summary = LapAnalyzer.analyze(listOf(5_000L))!!
        assertEquals(5_000L, summary.worstLapMs)
    }

    @Test
    fun `single lap — average equals that lap`() {
        val summary = LapAnalyzer.analyze(listOf(5_000L))!!
        assertEquals(5_000L, summary.averageLapMs)
    }

    @Test
    fun `single lap — best and worst index both 0`() {
        val summary = LapAnalyzer.analyze(listOf(3_000L))!!
        assertEquals(0, summary.bestLapIndex)
        assertEquals(0, summary.worstLapIndex)
    }

    // -----------------------------------------------------------------------
    // Two-lap cases
    // -----------------------------------------------------------------------

    @Test
    fun `two laps — best is the shorter one`() {
        val summary = LapAnalyzer.analyze(listOf(4_000L, 2_000L))!!
        assertEquals(2_000L, summary.bestLapMs)
    }

    @Test
    fun `two laps — worst is the longer one`() {
        val summary = LapAnalyzer.analyze(listOf(4_000L, 2_000L))!!
        assertEquals(4_000L, summary.worstLapMs)
    }

    @Test
    fun `two laps — correct indices`() {
        val summary = LapAnalyzer.analyze(listOf(4_000L, 2_000L))!!
        assertEquals(1, summary.bestLapIndex)   // index 1 = 2 000
        assertEquals(0, summary.worstLapIndex)  // index 0 = 4 000
    }

    @Test
    fun `two laps — average is arithmetic mean`() {
        val summary = LapAnalyzer.analyze(listOf(4_000L, 2_000L))!!
        assertEquals(3_000L, summary.averageLapMs)
    }

    // -----------------------------------------------------------------------
    // All-equal laps
    // -----------------------------------------------------------------------

    @Test
    fun `all equal laps — best equals worst equals average`() {
        val laps = List(5) { 3_000L }
        val summary = LapAnalyzer.analyze(laps)!!
        assertEquals(3_000L, summary.bestLapMs)
        assertEquals(3_000L, summary.worstLapMs)
        assertEquals(3_000L, summary.averageLapMs)
    }

    // -----------------------------------------------------------------------
    // Multi-lap cases
    // -----------------------------------------------------------------------

    @Test
    fun `three laps — best lap identified correctly`() {
        val summary = LapAnalyzer.analyze(listOf(6_000L, 3_000L, 5_000L))!!
        assertEquals(3_000L, summary.bestLapMs)
        assertEquals(1, summary.bestLapIndex)
    }

    @Test
    fun `three laps — worst lap identified correctly`() {
        val summary = LapAnalyzer.analyze(listOf(6_000L, 3_000L, 5_000L))!!
        assertEquals(6_000L, summary.worstLapMs)
        assertEquals(0, summary.worstLapIndex)
    }

    @Test
    fun `three laps — average is arithmetic mean`() {
        // (6000 + 3000 + 5000) / 3 = 4666 (integer division)
        val summary = LapAnalyzer.analyze(listOf(6_000L, 3_000L, 5_000L))!!
        val expected = (6_000L + 3_000L + 5_000L) / 3
        assertEquals(expected, summary.averageLapMs)
    }

    // -----------------------------------------------------------------------
    // lap count
    // -----------------------------------------------------------------------

    @Test
    fun `lap count matches input size`() {
        val laps = listOf(1_000L, 2_000L, 3_000L, 4_000L)
        val summary = LapAnalyzer.analyze(laps)!!
        assertEquals(4, summary.lapCount)
    }

    // -----------------------------------------------------------------------
    // Large list
    // -----------------------------------------------------------------------

    @Test
    fun `100 laps — best and worst correctly identified at boundaries`() {
        // Lap durations 1..100 seconds; best = 1 000 ms at index 0,
        // worst = 100 000 ms at index 99
        val laps = (1..100).map { it * 1_000L }
        val summary = LapAnalyzer.analyze(laps)!!
        assertEquals(1_000L, summary.bestLapMs)
        assertEquals(0, summary.bestLapIndex)
        assertEquals(100_000L, summary.worstLapMs)
        assertEquals(99, summary.worstLapIndex)
    }

    @Test
    fun `100 laps — average is correct`() {
        val laps = (1..100).map { it * 1_000L }
        val summary = LapAnalyzer.analyze(laps)!!
        val expected = laps.sum() / laps.size
        assertEquals(expected, summary.averageLapMs)
    }

    // -----------------------------------------------------------------------
    // total elapsed
    // -----------------------------------------------------------------------

    @Test
    fun `total elapsed is sum of all laps`() {
        val laps = listOf(2_000L, 3_000L, 4_000L)
        val summary = LapAnalyzer.analyze(laps)!!
        assertEquals(9_000L, summary.totalElapsedMs)
    }
}
