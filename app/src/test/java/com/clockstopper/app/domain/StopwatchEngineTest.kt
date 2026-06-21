package com.clockstopper.app.domain

import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Unit tests for [StopwatchEngine].
 *
 * A [FakeClock] is injected so every test is deterministic and independent of
 * wall-clock time.  No Android dependencies — runs on the plain JVM.
 *
 * Feature coverage: Stopwatch start/stop/reset/lap lifecycle, elapsed-time
 * accumulation across multiple segments, lap delta tracking.
 */
class StopwatchEngineTest {

    // -----------------------------------------------------------------------
    // Test infrastructure
    // -----------------------------------------------------------------------

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
    // Initial state
    // -----------------------------------------------------------------------

    @Test
    fun `INITIAL state is not running`() {
        assertFalse(StopwatchState.INITIAL.isRunning)
    }

    @Test
    fun `INITIAL state has zero elapsed time`() {
        assertEquals(0L, StopwatchState.INITIAL.elapsedMs)
        assertEquals(0L, StopwatchState.INITIAL.totalElapsedMs)
    }

    @Test
    fun `INITIAL state has no laps`() {
        assertTrue(StopwatchState.INITIAL.laps.isEmpty())
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
    fun `start from arbitrary clock time captures that time`() {
        clock.nowMs = 99_999L
        val next = engine.start(StopwatchState.INITIAL)
        assertEquals(99_999L, next.startedAtMs)
    }

    @Test
    fun `start is a no-op when already running`() {
        clock.nowMs = 0L
        val running = engine.start(StopwatchState.INITIAL)
        clock.nowMs = 500L
        val again = engine.start(running)
        // startedAtMs must NOT be reset to 500
        assertEquals(running.startedAtMs, again.startedAtMs)
    }

    @Test
    fun `start preserves accumulated elapsedMs from previous segment`() {
        clock.nowMs = 0L
        var state = engine.start(StopwatchState.INITIAL)
        clock.nowMs = 2_000L
        state = engine.stop(state)          // elapsedMs = 2 000
        clock.nowMs = 5_000L
        state = engine.start(state)
        assertEquals(2_000L, state.elapsedMs)
    }

    // -----------------------------------------------------------------------
    // stop()
    // -----------------------------------------------------------------------

    @Test
    fun `stop accumulates elapsed time correctly`() {
        clock.nowMs = 0L
        val running = engine.start(StopwatchState.INITIAL)
        clock.nowMs = 3_000L
        val stopped = engine.stop(running)

        assertFalse(stopped.isRunning)
        assertEquals(3_000L, stopped.elapsedMs)
    }

    @Test
    fun `stop resets startedAtMs to sentinel value`() {
        clock.nowMs = 0L
        val running = engine.start(StopwatchState.INITIAL)
        clock.nowMs = 1_000L
        val stopped = engine.stop(running)
        assertEquals(-1L, stopped.startedAtMs)
    }

    @Test
    fun `stop resets currentSegmentMs to zero`() {
        clock.nowMs = 0L
        val running = engine.start(StopwatchState.INITIAL)
        clock.nowMs = 1_000L
        val stopped = engine.stop(running)
        assertEquals(0L, stopped.currentSegmentMs)
    }

    @Test
    fun `stop is a no-op when already stopped`() {
        val stopped = engine.stop(StopwatchState.INITIAL)
        assertEquals(StopwatchState.INITIAL, stopped)
    }

    @Test
    fun `elapsed time accumulates across two start-stop cycles`() {
        clock.nowMs = 0L
        var state = engine.start(StopwatchState.INITIAL)
        clock.nowMs = 1_000L
        state = engine.stop(state)                  // segment 1: 1 s

        clock.nowMs = 5_000L
        state = engine.start(state)
        clock.nowMs = 7_000L
        state = engine.stop(state)                  // segment 2: 2 s

        assertEquals(3_000L, state.elapsedMs)
    }

    @Test
    fun `elapsed time accumulates across three start-stop cycles`() {
        clock.nowMs = 0L
        var state = engine.start(StopwatchState.INITIAL)
        clock.nowMs = 1_000L
        state = engine.stop(state)

        clock.nowMs = 2_000L
        state = engine.start(state)
        clock.nowMs = 3_500L
        state = engine.stop(state)

        clock.nowMs = 10_000L
        state = engine.start(state)
        clock.nowMs = 10_250L
        state = engine.stop(state)

        assertEquals(2_750L, state.elapsedMs)   // 1000 + 1500 + 250
    }

    // -----------------------------------------------------------------------
    // reset()
    // -----------------------------------------------------------------------

    @Test
    fun `reset on running state returns INITIAL`() {
        val running = engine.start(StopwatchState.INITIAL)
        assertEquals(StopwatchState.INITIAL, engine.reset(running))
    }

    @Test
    fun `reset on stopped state returns INITIAL`() {
        clock.nowMs = 0L
        var state = engine.start(StopwatchState.INITIAL)
        clock.nowMs = 9_999L
        state = engine.stop(state)
        assertEquals(StopwatchState.INITIAL, engine.reset(state))
    }

    @Test
    fun `reset on INITIAL is idempotent`() {
        assertEquals(StopwatchState.INITIAL, engine.reset(StopwatchState.INITIAL))
    }

    @Test
    fun `reset clears all laps`() {
        clock.nowMs = 0L
        var state = engine.start(StopwatchState.INITIAL)
        clock.nowMs = 1_000L; state = engine.lap(state)
        clock.nowMs = 2_000L; state = engine.lap(state)
        state = engine.stop(state)
        val reset = engine.reset(state)
        assertTrue(reset.laps.isEmpty())
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
    fun `tick keeps engine running`() {
        clock.nowMs = 0L
        val running = engine.start(StopwatchState.INITIAL)
        clock.nowMs = 100L
        val ticked = engine.tick(running)
        assertTrue(ticked.isRunning)
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
        state = engine.stop(state)              // elapsedMs = 1 000

        clock.nowMs = 2_000L
        state = engine.start(state)
        clock.nowMs = 2_500L
        state = engine.tick(state)              // currentSegmentMs = 500

        assertEquals(1_500L, state.totalElapsedMs)
    }

    @Test
    fun `totalElapsedMs equals elapsedMs when stopped`() {
        clock.nowMs = 0L
        var state = engine.start(StopwatchState.INITIAL)
        clock.nowMs = 4_000L
        state = engine.stop(state)
        assertEquals(state.elapsedMs, state.totalElapsedMs)
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
    fun `second lap duration is delta from first lap`() {
        clock.nowMs = 0L
        var state = engine.start(StopwatchState.INITIAL)
        clock.nowMs = 5_000L; state = engine.lap(state)     // lap 1 = 5 s
        clock.nowMs = 8_000L; state = engine.lap(state)     // lap 2 = 3 s
        assertEquals(3_000L, state.laps[1])
    }

    @Test
    fun `lap records three lap durations as correct deltas`() {
        clock.nowMs = 0L
        var state = engine.start(StopwatchState.INITIAL)

        clock.nowMs = 5_000L;  state = engine.lap(state)    // lap 1 = 5 s
        clock.nowMs = 8_000L;  state = engine.lap(state)    // lap 2 = 3 s
        clock.nowMs = 14_000L; state = engine.lap(state)    // lap 3 = 6 s

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

    @Test
    fun `many laps accumulate without losing any`() {
        clock.nowMs = 0L
        var state = engine.start(StopwatchState.INITIAL)
        for (i in 1..20) {
            clock.nowMs = (i * 1_000L)
            state = engine.lap(state)
        }
        assertEquals(20, state.laps.size)
    }

    // -----------------------------------------------------------------------
    // Combined workflow: full start-lap-stop-reset cycle
    // -----------------------------------------------------------------------

    @Test
    fun `full workflow produces correct final state`() {
        clock.nowMs = 0L
        var state = engine.start(StopwatchState.INITIAL)

        clock.nowMs = 2_000L; state = engine.lap(state)
        clock.nowMs = 5_000L; state = engine.lap(state)
        clock.nowMs = 6_000L; state = engine.stop(state)

        assertEquals(6_000L, state.elapsedMs)
        assertEquals(listOf(2_000L, 3_000L), state.laps)
        assertFalse(state.isRunning)

        val reset = engine.reset(state)
        assertEquals(StopwatchState.INITIAL, reset)
    }
}
