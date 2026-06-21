package com.clockstopper.app.domain

import org.junit.Assert.*
import org.junit.Test

/**
 * Unit tests for [StopwatchState] value-object invariants.
 *
 * These tests verify the data class contracts: equality, copy semantics,
 * computed properties, and the INITIAL singleton.
 *
 * All tests run on the plain JVM — no Android dependencies.
 */
class StopwatchStateTest {

    @Test
    fun `INITIAL is not running`() {
        assertFalse(StopwatchState.INITIAL.isRunning)
    }

    @Test
    fun `INITIAL has zero elapsedMs`() {
        assertEquals(0L, StopwatchState.INITIAL.elapsedMs)
    }

    @Test
    fun `INITIAL has zero totalElapsedMs`() {
        assertEquals(0L, StopwatchState.INITIAL.totalElapsedMs)
    }

    @Test
    fun `INITIAL has zero currentSegmentMs`() {
        assertEquals(0L, StopwatchState.INITIAL.currentSegmentMs)
    }

    @Test
    fun `INITIAL has sentinel startedAtMs`() {
        assertEquals(-1L, StopwatchState.INITIAL.startedAtMs)
    }

    @Test
    fun `INITIAL has empty laps list`() {
        assertTrue(StopwatchState.INITIAL.laps.isEmpty())
    }

    @Test
    fun `two INITIAL references are equal`() {
        assertEquals(StopwatchState.INITIAL, StopwatchState.INITIAL)
    }

    @Test
    fun `copy with modified field produces unequal state`() {
        val modified = StopwatchState.INITIAL.copy(elapsedMs = 1_000L)
        assertNotEquals(StopwatchState.INITIAL, modified)
    }

    @Test
    fun `copy preserves unmodified fields`() {
        val original = StopwatchState.INITIAL.copy(elapsedMs = 5_000L, isRunning = true)
        val copied = original.copy(elapsedMs = 6_000L)
        assertTrue(copied.isRunning)
    }

    @Test
    fun `totalElapsedMs is sum of elapsedMs and currentSegmentMs`() {
        val state = StopwatchState.INITIAL.copy(
            elapsedMs = 3_000L,
            currentSegmentMs = 700L
        )
        assertEquals(3_700L, state.totalElapsedMs)
    }

    @Test
    fun `laps list isolation between copies`() {
        val state = StopwatchState.INITIAL.copy(laps = listOf(1_000L, 2_000L))
        assertTrue(StopwatchState.INITIAL.laps.isEmpty())
        assertEquals(2, state.laps.size)
    }
}
