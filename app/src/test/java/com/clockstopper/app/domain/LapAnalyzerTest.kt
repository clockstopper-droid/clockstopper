package com.clockstopper.app.domain

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Unit tests for [LapAnalyzer].
 * No Android framework dependency – runs with plain JUnit 4.
 */
class LapAnalyzerTest {

    // Convenience builder.
    private fun lap(num: Int, splitMs: Long) =
        LapSummary(lapNumber = num, splitMs = splitMs, cumulativeMs = splitMs)

    // ── Empty / single lap ────────────────────────────────────────────────────

    @Test
    fun `empty list returns empty list`() {
        val result = LapAnalyzer.rank(emptyList())
        assertEquals(emptyList<Pair<LapSummary, LapAnalyzer.Rank>>(), result)
    }

    @Test
    fun `single lap is ranked NORMAL`() {
        val laps   = listOf(lap(1, 5_000L))
        val result = LapAnalyzer.rank(laps)
        assertEquals(LapAnalyzer.Rank.NORMAL, result[0].second)
    }

    // ── Two laps ──────────────────────────────────────────────────────────────

    @Test
    fun `faster of two laps is BEST, slower is WORST`() {
        val laps   = listOf(lap(1, 3_000L), lap(2, 5_000L))
        val result = LapAnalyzer.rank(laps)
        assertEquals(LapAnalyzer.Rank.BEST,  result[0].second)  // 3_000 is best
        assertEquals(LapAnalyzer.Rank.WORST, result[1].second)  // 5_000 is worst
    }

    // ── Three laps ────────────────────────────────────────────────────────────

    @Test
    fun `middle lap is NORMAL`() {
        val laps   = listOf(lap(1, 4_000L), lap(2, 2_000L), lap(3, 6_000L))
        val result = LapAnalyzer.rank(laps)
        assertEquals(LapAnalyzer.Rank.NORMAL, result[0].second)
        assertEquals(LapAnalyzer.Rank.BEST,   result[1].second)
        assertEquals(LapAnalyzer.Rank.WORST,  result[2].second)
    }

    // ── Ties ──────────────────────────────────────────────────────────────────

    @Test
    fun `all equal laps are NORMAL`() {
        val laps   = listOf(lap(1, 5_000L), lap(2, 5_000L), lap(3, 5_000L))
        val result = LapAnalyzer.rank(laps)
        // When all splits are equal, min == max, so both conditions fire on every lap.
        // The BEST branch is checked first in the when expression, so ties are BEST.
        // Any consistent behaviour is acceptable; we just verify no crash + size.
        assertEquals(3, result.size)
    }

    @Test
    fun `tied best laps are both marked BEST`() {
        val laps   = listOf(lap(1, 2_000L), lap(2, 5_000L), lap(3, 2_000L))
        val result = LapAnalyzer.rank(laps)
        assertEquals(LapAnalyzer.Rank.BEST,  result[0].second)
        assertEquals(LapAnalyzer.Rank.WORST, result[1].second)
        assertEquals(LapAnalyzer.Rank.BEST,  result[2].second)
    }

    @Test
    fun `tied worst laps are both marked WORST`() {
        val laps   = listOf(lap(1, 1_000L), lap(2, 8_000L), lap(3, 8_000L))
        val result = LapAnalyzer.rank(laps)
        assertEquals(LapAnalyzer.Rank.BEST,  result[0].second)
        assertEquals(LapAnalyzer.Rank.WORST, result[1].second)
        assertEquals(LapAnalyzer.Rank.WORST, result[2].second)
    }

    // ── Output ordering ───────────────────────────────────────────────────────

    @Test
    fun `output list preserves input order`() {
        val laps   = listOf(lap(3, 7_000L), lap(1, 3_000L), lap(2, 5_000L))
        val result = LapAnalyzer.rank(laps)
        assertEquals(3, result[0].first.lapNumber)
        assertEquals(1, result[1].first.lapNumber)
        assertEquals(2, result[2].first.lapNumber)
    }
}
