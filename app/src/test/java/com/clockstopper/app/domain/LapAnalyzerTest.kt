package com.clockstopper.app.domain

import org.junit.Assert.*
import org.junit.Test

/**
 * LapAnalyzerTest — unit tests for [LapAnalyzer].
 *
 * Verifies that:
 *   - An empty split list produces an empty result.
 *   - A single split produces the correct [LapSummary] with lap number 1.
 *   - Multiple splits accumulate correctly.
 *   - The output is in reverse order (newest lap first).
 *   - Formatted strings match [TimeFormatter] output.
 *
 * Run with:  ./gradlew test
 */
class LapAnalyzerTest {

    @Test
    fun emptySplits_returnsEmptyList() {
        val result = LapAnalyzer.analyze(emptyList())
        assertTrue(result.isEmpty())
    }

    @Test
    fun singleSplit_lapNumberIsOne() {
        val result = LapAnalyzer.analyze(listOf(5_000L))
        assertEquals(1, result.size)
        assertEquals(1, result[0].lapNumber)
    }

    @Test
    fun singleSplit_splitAndCumulativeAreEqual() {
        val result = LapAnalyzer.analyze(listOf(5_000L))
        assertEquals(5_000L, result[0].splitMs)
        assertEquals(5_000L, result[0].cumulativeMs)
    }

    @Test
    fun singleSplit_formattedValuesMatchTimeFormatter() {
        val splitMs = 5_432L
        val result = LapAnalyzer.analyze(listOf(splitMs))
        assertEquals(TimeFormatter.format(splitMs), result[0].formattedSplit)
        assertEquals(TimeFormatter.format(splitMs), result[0].formattedCumulative)
    }

    @Test
    fun twoSplits_cumulativeAccumulates() {
        // split 1 = 3000 ms, split 2 = 4000 ms
        val result = LapAnalyzer.analyze(listOf(3_000L, 4_000L))
        assertEquals(2, result.size)
        // newest lap (lap 2) is at index 0 after reversal
        val lap2 = result[0]
        val lap1 = result[1]

        assertEquals(2, lap2.lapNumber)
        assertEquals(4_000L, lap2.splitMs)
        assertEquals(7_000L, lap2.cumulativeMs)

        assertEquals(1, lap1.lapNumber)
        assertEquals(3_000L, lap1.splitMs)
        assertEquals(3_000L, lap1.cumulativeMs)
    }

    @Test
    fun outputIsInReverseOrder_newestFirst() {
        val splits = listOf(1_000L, 2_000L, 3_000L)
        val result = LapAnalyzer.analyze(splits)
        // Lap numbers should be 3, 2, 1 (newest first)
        assertEquals(3, result[0].lapNumber)
        assertEquals(2, result[1].lapNumber)
        assertEquals(1, result[2].lapNumber)
    }

    @Test
    fun threeSplits_cumulativeValuesCorrect() {
        val splits = listOf(1_000L, 2_000L, 3_000L)
        val result = LapAnalyzer.analyze(splits)
        // In reverse: lap3 cumulative=6000, lap2 cumulative=3000, lap1 cumulative=1000
        assertEquals(6_000L, result[0].cumulativeMs) // lap 3
        assertEquals(3_000L, result[1].cumulativeMs) // lap 2
        assertEquals(1_000L, result[2].cumulativeMs) // lap 1
    }

    @Test
    fun formattedSplit_matchesTimeFormatter() {
        val splits = listOf(12_345L, 67_890L)
        val result = LapAnalyzer.analyze(splits)
        // result[0] is lap 2 (newest)
        assertEquals(TimeFormatter.format(67_890L), result[0].formattedSplit)
        assertEquals(TimeFormatter.format(12_345L), result[1].formattedSplit)
    }

    @Test
    fun formattedCumulative_matchesTimeFormatter() {
        val splits = listOf(10_000L, 20_000L)
        val result = LapAnalyzer.analyze(splits)
        // lap 2 cumulative = 30_000 ms
        assertEquals(TimeFormatter.format(30_000L), result[0].formattedCumulative)
        // lap 1 cumulative = 10_000 ms
        assertEquals(TimeFormatter.format(10_000L), result[1].formattedCumulative)
    }
}
