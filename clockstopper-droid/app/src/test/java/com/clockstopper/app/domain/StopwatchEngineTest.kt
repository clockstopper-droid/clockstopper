package com.clockstopper.app.domain

import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Unit tests for [StopwatchEngine].
 *
 * A [FakeClock] is injected so every test runs deterministically without
 * depending on wall-clock time.
 */
class StopwatchEngineTest {

    // -----------------------------------------------------------------------
    // Test infrastructure
    // -----------------------------------------------------------------------

    /** Fake clock whose current time can be advanced manually. */
    private class FakeClock(initialMs: Long = 0L) : StopwatchEngine.Clock {
        var nowMs: Long = initialMs
        override fun nowMs(): Long = nowMs
    }

    private lateinit var clock: FakeClock
    private lateinit var engine: StopwatchEngine

    @Before
    fun setUp() {
        clock = FakeClock(0L)
        engine = StopwatchEngine(clock)
    }

    // -----------------------------------------------------------------------
    // start()
    // -----------------------------------------------------------------------

    @Test
    fun `start transitions to running state`() {
        val next = engine.start(StopwatchState.INITIAL)
        assertTrue(next.isRunning)
    }

    @Test
    fun `start records the current clock time as startedAtMs`() {
        clock.nowMs = 1_000L
        val next = engine.start(StopwatchState.INITIAL)
        assertEquals(1_000L, next.startedAtMs)
    }

    @Test
    fun `start is a no-op when already running`() {
        clock.nowMs = 0L
        val running = engine.start(StopwatchState.INITIAL)
        clock.nowMs = 500L
        val again = engine.start(running)
        // startedAtMs must NOT be reset to 500 ms
        assertEquals(running.startedAtMs, again.startedAtMs)
    }

    // -----------------------------------------------------------------------
    // stop()
    // -----------------------------------------------------------------------

    @Test
    fun `stop accumulates elapsed time`() {
        clock.nowMs = 0L
        val running = engine.start(StopwatchState.INITIAL)
        clock.nowMs = 3_000L
        val stopped = engine.stop(running)

        assertFalse(stopped.isRunning)
        assertEquals(3_000L, stopped.elapsedMs)
        assertEquals(0L, stopped.currentSegmentMs)
        assertEquals(-1L, stopped.startedAtMs)
    }

    @Test
    fun `stop is a no-op when already stopped`() {
        val stopped = engine.stop(StopwatchState.INITIAL)
        assertEquals(StopwatchState.INITIAL, stopped)
    }

    @Test
    fun `elapsed time accumulates across multiple start-stop cycles`() {
        clock.nowMs = 0L
        var state = engine.start(StopwatchState.INITIAL)
        clock.nowMs = 1_000L
        state = engine.stop(state)

        clock.nowMs = 5_000L
        state = engine.start(state)
        clock.nowMs = 7_000L
        state = engine.stop(state)

        assertEquals(3_000L, state.elapsedMs) // 1 s + 2 s
    }

    // -----------------------------------------------------------------------
    // reset()
    // -----------------------------------------------------------------------

    @Test
    fun `reset returns INITIAL state regardless of input`() {
        clock.nowMs = 0L
        var state = engine.start(StopwatchState.INITIAL)
        clock.nowMs = 9_999L
        state = engine.stop(state)
        val reset = engine.reset(state)
        assertEquals(StopwatchState.INITIAL, reset)
    }

    @Test
    fun `reset works on already-stopped state`() {
        assertEquals(StopwatchState.INITIAL, engine.reset(StopwatchState.INITIAL))
    }

    // -----------------------------------------------------------------------
    // tick()
    // -----------------------------------------------------------------------

    @Test
    fun `tick updates currentSegmentMs while running`() {
        clock.nowMs = 0L
        val running = engine.start(StopwatchState.INITIAL)
        clock.nowMs = 250L
        val ticked = engine.tick(running)
        assertEquals(250L, ticked.currentSegmentMs)
    }

    @Test
    fun `tick is a no-op when stopped`() {
        clock.nowMs = 999L
        val ticked = engine.tick(StopwatchState.INITIAL)
        assertEquals(StopwatchState.INITIAL, ticked)
    }

    @Test
    fun `totalElapsedMs combines elapsedMs and currentSegmentMs`() {
        clock.nowMs = 0L
        var state = engine.start(StopwatchState.INITIAL)
        clock.nowMs = 1_000L
        state = engine.stop(state)   // elapsedMs = 1000

        clock.nowMs = 2_000L
        state = engine.start(state)
        clock.nowMs = 2_500L
        state = engine.tick(state)   // currentSegmentMs = 500

        assertEquals(1_500L, state.totalElapsedMs)
    }

    // -----------------------------------------------------------------------
    // lap()
    // -----------------------------------------------------------------------

    @Test
    fun `lap records first lap duration correctly`() {
        clock.nowMs = 0L
        var state = engine.start(StopwatchState.INITIAL)
        clock.nowMs = 5_000L
        state = engine.lap(state)

        assertEquals(1, state.laps.size)
        assertEquals(5_000L, state.laps[0])
    }

    @Test
    fun `lap records subsequent lap durations as deltas`() {
        clock.nowMs = 0L
        var state = engine.start(StopwatchState.INITIAL)

        clock.nowMs = 5_000L
        state = engine.lap(state) // lap 1 = 5 s

        clock.nowMs = 8_000L
        state = engine.lap(state) // lap 2 = 3 s

        clock.nowMs = 14_000L
        state = engine.lap(state) // lap 3 = 6 s

        assertEquals(listOf(5_000L, 3_000L, 6_000L), state.laps)
    }

    @Test
    fun `lap is a no-op when stopped`() {
        val state = engine.lap(StopwatchState.INITIAL)
        assertEquals(StopwatchState.INITIAL, state)
    }

    @Test
    fun `stopwatch keeps running after lap`() {
        clock.nowMs = 0L
        var state = engine.start(StopwatchState.INITIAL)
        clock.nowMs = 1_000L
        state = engine.lap(state)
        assertTrue(state.isRunning)
    }
}
