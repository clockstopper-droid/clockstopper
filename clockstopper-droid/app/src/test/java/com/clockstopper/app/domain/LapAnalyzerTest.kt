package com.clockstopper.app.domain

import org.junit.Assert.*
import org.junit.Test

/**
 * Unit tests for [LapAnalyzer].
 */
class LapAnalyzerTest {

    @Test
    fun `summarise empty list produces zeroed summary`() {
        val summary = LapAnalyzer.summarise(emptyList())
        assertEquals(0, summary.count)
        assertNull(summary.fastestMs)
        assertNull(summary.slowestMs)
        assertNull(summary.averageMs)
        assertEquals(0L, summary.totalMs)
    }

    @Test
    fun `summarise single lap`() {
        val summary = LapAnalyzer.summarise(listOf(5_000L))
        assertEquals(1, summary.count)
        assertEquals(5_000L, summary.fastestMs)
        assertEquals(5_000L, summary.slowestMs)
        assertEquals(5_000L, summary.averageMs)
        assertEquals(5_000L, summary.totalMs)
    }

    @Test
    fun `summarise multiple laps`() {
        val laps = listOf(3_000L, 5_000L, 4_000L)
        val summary = LapAnalyzer.summarise(laps)

        assertEquals(3, summary.count)
        assertEquals(3_000L, summary.fastestMs)
        assertEquals(5_000L, summary.slowestMs)
        assertEquals(4_000L, summary.averageMs)   // (3+5+4)/3 = 4
        assertEquals(12_000L, summary.totalMs)
    }

    @Test
    fun `summarise average is truncated not rounded`() {
        // 5 + 5 + 6 = 16, 16/3 = 5.333… → truncated to 5
        val summary = LapAnalyzer.summarise(listOf(5_000L, 5_000L, 6_000L))
        assertEquals(5_333L, summary.averageMs)    // 16000/3 truncated
    }

    @Test
    fun `fastestIndex returns correct index`() {
        assertEquals(0, LapAnalyzer.fastestIndex(listOf(1_000L, 3_000L, 2_000L)))
    }

    @Test
    fun `slowestIndex returns correct index`() {
        assertEquals(1, LapAnalyzer.slowestIndex(listOf(1_000L, 3_000L, 2_000L)))
    }

    @Test
    fun `fastestIndex returns -1 for empty list`() {
        assertEquals(-1, LapAnalyzer.fastestIndex(emptyList()))
    }

    @Test
    fun `slowestIndex returns -1 for empty list`() {
        assertEquals(-1, LapAnalyzer.slowestIndex(emptyList()))
    }
}
