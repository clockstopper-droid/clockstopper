package com.clockstopper.app.domain

import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * StopwatchEngineTest
 * ───────────────────
 * Exhaustive unit tests for [StopwatchEngine].
 *
 * All tests use a simple monotonic counter (`t`) instead of a real clock so
 * timings are perfectly deterministic — no flakiness from wall-clock drift.
 *
 * Test naming convention:  `<scenario>_<expected outcome>`
 *
 * Coverage areas
 * ──────────────
 *  S-1   Start transitions
 *  S-2   Stop (pause) transitions
 *  S-3   Lap recording
 *  S-4   Reset
 *  S-5   Snapshot / elapsed time accuracy
 *  S-6   Lap ranking (fastest / slowest)
 *  S-7   State-machine guards (no-op calls)
 *  S-8   Accumulated time across multiple pause/resume cycles
 *  S-9   Lap split accumulation
 *  S-10  Edge cases (zero duration, single lap ranking, overflow-safe arithmetic)
 */
class StopwatchEngineTest {

    private lateinit var engine: StopwatchEngine

    @Before
    fun setUp() {
        engine = StopwatchEngine()
    }

    // ── S-1  Start transitions ────────────────────────────────────────────

    @Test
    fun `start from RESET returns RUNNING status`() {
        val state = engine.start(nowMs = 0)
        assertEquals(StopwatchStatus.RUNNING, state.status)
    }

    @Test
    fun `start from RESET initialises elapsed to zero`() {
        val state = engine.start(nowMs = 1_000)
        assertEquals(0L, state.elapsedMs)
    }

    @Test
    fun `start from PAUSED returns RUNNING status`() {
        engine.start(nowMs = 0)
        engine.stop(nowMs = 500)
        val state = engine.start(nowMs = 1_000)
        assertEquals(StopwatchStatus.RUNNING, state.status)
    }

    // ── S-2  Stop (pause) transitions ────────────────────────────────────

    @Test
    fun `stop from RUNNING returns PAUSED status`() {
        engine.start(nowMs = 0)
        val state = engine.stop(nowMs = 1_000)
        assertEquals(StopwatchStatus.PAUSED, state.status)
    }

    @Test
    fun `stop captures elapsed time correctly`() {
        engine.start(nowMs = 0)
        val state = engine.stop(nowMs = 2_500)
        assertEquals(2_500L, state.elapsedMs)
    }

    @Test
    fun `stop from RESET is a no-op and returns RESET status`() {
        val state = engine.stop(nowMs = 1_000)
        assertEquals(StopwatchStatus.RESET, state.status)
        assertEquals(0L, state.elapsedMs)
    }

    @Test
    fun `stop from PAUSED is a no-op`() {
        engine.start(nowMs = 0)
        engine.stop(nowMs = 1_000)
        val state = engine.stop(nowMs = 2_000) // second stop — no-op
        assertEquals(StopwatchStatus.PAUSED, state.status)
        assertEquals(1_000L, state.elapsedMs)
    }

    // ── S-3  Lap recording ────────────────────────────────────────────────

    @Test
    fun `first lap records correct split and total`() {
        engine.start(nowMs = 0)
        val state = engine.lap(nowMs = 3_000)
        assertEquals(1, state.lapCount)
        assertEquals(3_000L, state.laps[0].splitMs)
        assertEquals(3_000L, state.laps[0].totalMs)
    }

    @Test
    fun `second lap split is independent of first`() {
        engine.start(nowMs = 0)
        engine.lap(nowMs = 3_000)               // lap 1: 3 000 ms
        val state = engine.lap(nowMs = 5_000)   // lap 2: 2 000 ms
        assertEquals(2_000L, state.laps[1].splitMs)
        assertEquals(5_000L, state.laps[1].totalMs)
    }

    @Test
    fun `lap indices are 1-based and sequential`() {
        engine.start(nowMs = 0)
        engine.lap(nowMs = 1_000)
        engine.lap(nowMs = 2_000)
        val state = engine.lap(nowMs = 3_000)
        assertEquals(listOf(1, 2, 3), state.laps.map { it.index })
    }

    @Test
    fun `lap count matches number of lap calls`() {
        engine.start(nowMs = 0)
        repeat(5) { i -> engine.lap(nowMs = (i + 1) * 1_000L) }
        val state = engine.snapshot(nowMs = 6_000)
        assertEquals(5, state.lapCount)
    }

    @Test
    fun `lap from RESET is a no-op`() {
        val state = engine.lap(nowMs = 1_000)
        assertEquals(0, state.lapCount)
        assertEquals(StopwatchStatus.RESET, state.status)
    }

    @Test
    fun `lap from PAUSED is a no-op`() {
        engine.start(nowMs = 0)
        engine.stop(nowMs = 1_000)
        val state = engine.lap(nowMs = 2_000)
        assertEquals(0, state.lapCount)
        assertEquals(StopwatchStatus.PAUSED, state.status)
    }

    @Test
    fun `lap split resets after each lap`() {
        engine.start(nowMs = 0)
        engine.lap(nowMs = 4_000)            // lap 1 split = 4 000
        val state = engine.snapshot(nowMs = 4_500)  // 500 ms into lap 2
        assertEquals(500L, state.lapSplitMs)
    }

    // ── S-4  Reset ────────────────────────────────────────────────────────

    @Test
    fun `reset returns RESET status`() {
        engine.start(nowMs = 0)
        val state = engine.reset()
        assertEquals(StopwatchStatus.RESET, state.status)
    }

    @Test
    fun `reset clears elapsed time`() {
        engine.start(nowMs = 0)
        engine.stop(nowMs = 5_000)
        val state = engine.reset()
        assertEquals(0L, state.elapsedMs)
    }

    @Test
    fun `reset clears all laps`() {
        engine.start(nowMs = 0)
        engine.lap(nowMs = 1_000)
        engine.lap(nowMs = 2_000)
        val state = engine.reset()
        assertEquals(0, state.lapCount)
        assertTrue(state.laps.isEmpty())
    }

    @Test
    fun `reset while running clears state`() {
        engine.start(nowMs = 0)
        val state = engine.reset()
        assertEquals(StopwatchStatus.RESET, state.status)
        assertEquals(0L, state.elapsedMs)
    }

    @Test
    fun `reset is idempotent`() {
        val s1 = engine.reset()
        val s2 = engine.reset()
        assertEquals(s1, s2)
    }

    @Test
    fun `engine is usable after reset`() {
        engine.start(nowMs = 0)
        engine.stop(nowMs = 2_000)
        engine.reset()
        engine.start(nowMs = 5_000)
        val state = engine.snapshot(nowMs = 7_000)
        assertEquals(2_000L, state.elapsedMs)
    }

    // ── S-5  Snapshot / elapsed time accuracy ─────────────────────────────

    @Test
    fun `snapshot while running returns correct elapsed`() {
        engine.start(nowMs = 100)
        val state = engine.snapshot(nowMs = 1_600)
        assertEquals(1_500L, state.elapsedMs)
    }

    @Test
    fun `snapshot after stop returns frozen elapsed`() {
        engine.start(nowMs = 0)
        engine.stop(nowMs = 3_000)
        // Snapshot at a later time — should NOT advance elapsed because paused
        val state = engine.snapshot(nowMs = 10_000)
        assertEquals(3_000L, state.elapsedMs)
    }

    @Test
    fun `snapshot after reset returns zero elapsed`() {
        engine.start(nowMs = 0)
        engine.stop(nowMs = 5_000)
        engine.reset()
        val state = engine.snapshot(nowMs = 99_000)
        assertEquals(0L, state.elapsedMs)
    }

    // ── S-6  Lap ranking ──────────────────────────────────────────────────

    @Test
    fun `single lap has no fastest or slowest flags set`() {
        engine.start(nowMs = 0)
        val state = engine.lap(nowMs = 1_000)
        assertFalse(state.laps[0].isFastest)
        assertFalse(state.laps[0].isSlowest)
    }

    @Test
    fun `two laps — shorter is fastest, longer is slowest`() {
        engine.start(nowMs = 0)
        engine.lap(nowMs = 1_000)   // lap 1 — 1 s
        val state = engine.lap(nowMs = 3_000)   // lap 2 — 2 s
        assertTrue(state.laps[0].isFastest)
        assertFalse(state.laps[0].isSlowest)
        assertFalse(state.laps[1].isFastest)
        assertTrue(state.laps[1].isSlowest)
    }

    @Test
    fun `fastest and slowest reassigned when new extremes appear`() {
        engine.start(nowMs = 0)
        engine.lap(nowMs = 2_000)   // lap 1 — 2 s
        engine.lap(nowMs = 4_000)   // lap 2 — 2 s (tie)
        val state = engine.lap(nowMs = 4_500)   // lap 3 — 0.5 s  ← new fastest

        // lap 3 is now fastest; one of lap 1/2 is slowest
        assertTrue(state.laps[2].isFastest)
        // Lap 1 should be slowest (tie-break: first wins)
        assertTrue(state.laps[0].isSlowest)
        assertFalse(state.laps[1].isSlowest)
    }

    @Test
    fun `tied fastest laps — only first is marked`() {
        engine.start(nowMs = 0)
        engine.lap(nowMs = 1_000)   // lap 1 — 1 s
        val state = engine.lap(nowMs = 2_000)   // lap 2 — 1 s (tie with lap 1)
        // Lap 1 wins tie for fastest
        assertTrue(state.laps[0].isFastest)
        assertFalse(state.laps[1].isFastest)
    }

    @Test
    fun `state exposes hasFastestLap correctly`() {
        engine.start(nowMs = 0)
        val onelapState = engine.lap(nowMs = 1_000)
        assertFalse(onelapState.hasFastestLap)

        val twolapState = engine.lap(nowMs = 2_000)
        assertTrue(twolapState.hasFastestLap)
    }

    // ── S-7  State-machine guard calls ────────────────────────────────────

    @Test
    fun `calling start twice is idempotent`() {
        engine.start(nowMs = 0)
        val s1 = engine.snapshot(nowMs = 1_000)
        engine.start(nowMs = 1_000) // second start — no-op
        val s2 = engine.snapshot(nowMs = 2_000)
        // Elapsed after second call should have advanced by 1 000 ms
        assertEquals(s1.elapsedMs + 1_000L, s2.elapsedMs)
    }

    // ── S-8  Accumulated time across pause/resume cycles ─────────────────

    @Test
    fun `accumulated time is preserved across pause and resume`() {
        engine.start(nowMs = 0)
        engine.stop(nowMs = 2_000)   // 2 000 ms accumulated
        engine.start(nowMs = 3_000)  // resume (gap of 1 000 ms not counted)
        val state = engine.snapshot(nowMs = 4_000)
        // Total: 2 000 (first interval) + 1 000 (second interval) = 3 000
        assertEquals(3_000L, state.elapsedMs)
    }

    @Test
    fun `multiple pause resume cycles accumulate correctly`() {
        engine.start(nowMs = 0)
        engine.stop(nowMs = 1_000)  // +1 000
        engine.start(nowMs = 2_000)
        engine.stop(nowMs = 2_500)  // +500
        engine.start(nowMs = 10_000)
        engine.stop(nowMs = 10_300) // +300
        val state = engine.snapshot(nowMs = 99_000)
        assertEquals(1_800L, state.elapsedMs)
    }

    // ── S-9  Lap split accumulation across pause/resume ───────────────────

    @Test
    fun `lap split accumulates across pause resume within the same lap`() {
        engine.start(nowMs = 0)
        engine.stop(nowMs = 1_000)   // 1 000 ms in lap
        engine.start(nowMs = 5_000)  // resume
        val state = engine.lap(nowMs = 6_000)  // +1 000 ms in lap → split = 2 000
        assertEquals(2_000L, state.laps[0].splitMs)
    }

    // ── S-10  Edge cases ──────────────────────────────────────────────────

    @Test
    fun `zero-duration start stop produces zero elapsed`() {
        engine.start(nowMs = 1_000)
        val state = engine.stop(nowMs = 1_000)
        assertEquals(0L, state.elapsedMs)
    }

    @Test
    fun `very large elapsed time does not overflow`() {
        val tenHoursMs = 10L * 3_600_000L
        engine.start(nowMs = 0)
        val state = engine.snapshot(nowMs = tenHoursMs)
        assertEquals(tenHoursMs, state.elapsedMs)
    }

    @Test
    fun `laps list in snapshot is a defensive copy`() {
        engine.start(nowMs = 0)
        engine.lap(nowMs = 1_000)
        val state = engine.snapshot(nowMs = 2_000)
        val laps = state.laps

        // Record another lap — the previously returned list must be unaffected
        engine.lap(nowMs = 2_000)
        assertEquals(1, laps.size)
    }
}
