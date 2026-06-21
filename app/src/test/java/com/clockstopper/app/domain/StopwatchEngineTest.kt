package com.clockstopper.app.domain

import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Unit tests for [StopwatchEngine].
 *
 * The engine encapsulates all elapsed-time tracking and lap-split logic.
 * Tests here run purely on the JVM — no Android framework required.
 * Run with:  ./gradlew test
 *
 * Test areas:
 *   SE-1  Initial state after construction
 *   SE-2  Start / Stop / Reset lifecycle transitions
 *   SE-3  Lap recording: splits and cumulative totals
 *   SE-4  State invariants (can't double-start, can't lap when stopped, etc.)
 *   SE-5  Elapsed-time calculation consistency
 */
class StopwatchEngineTest {

    private lateinit var engine: StopwatchEngine

    /** A monotonic time source the test controls; starts at 0. */
    private var fakeNowMs: Long = 0L
    private val clock: () -> Long = { fakeNowMs }

    @Before
    fun setUp() {
        fakeNowMs = 0L
        engine = StopwatchEngine(clock)
    }

    // -----------------------------------------------------------------------
    // SE-1  Initial state
    // -----------------------------------------------------------------------

    @Test
    fun initialStateIsStopped() {
        val state = engine.getState()
        assertEquals(StopwatchState.STOPPED, state)
    }

    @Test
    fun initialElapsedTimeIsZero() {
        assertEquals(0L, engine.elapsedMs())
    }

    @Test
    fun initialLapListIsEmpty() {
        assertTrue("Lap list should be empty on construction", engine.laps().isEmpty())
    }

    // -----------------------------------------------------------------------
    // SE-2  Start / Stop / Reset lifecycle
    // -----------------------------------------------------------------------

    @Test
    fun stateChangesToRunningAfterStart() {
        engine.start()
        assertEquals(StopwatchState.RUNNING, engine.getState())
    }

    @Test
    fun stateChangesToStoppedAfterStop() {
        engine.start()
        engine.stop()
        assertEquals(StopwatchState.STOPPED, engine.getState())
    }

    @Test
    fun stateChangesToStoppedAfterReset() {
        engine.start()
        engine.stop()
        engine.reset()
        assertEquals(StopwatchState.STOPPED, engine.getState())
    }

    @Test
    fun resetClearsElapsedTime() {
        engine.start()
        fakeNowMs = 5_000L
        engine.stop()
        engine.reset()
        assertEquals(0L, engine.elapsedMs())
    }

    @Test
    fun resetClearsLaps() {
        engine.start()
        fakeNowMs = 1_000L
        engine.lap()
        engine.stop()
        engine.reset()
        assertTrue("Laps should be empty after reset", engine.laps().isEmpty())
    }

    // -----------------------------------------------------------------------
    // SE-3  Elapsed-time calculation
    // -----------------------------------------------------------------------

    @Test
    fun elapsedTimeAccumulatesWhileRunning() {
        engine.start()
        fakeNowMs = 3_000L
        assertEquals(3_000L, engine.elapsedMs())
    }

    @Test
    fun elapsedTimeFrozenWhileStopped() {
        engine.start()
        fakeNowMs = 2_000L
        engine.stop()
        // Advance clock further; engine is stopped so elapsed should not change
        fakeNowMs = 10_000L
        assertEquals(2_000L, engine.elapsedMs())
    }

    @Test
    fun elapsedTimeContinuesFromFrozenPointAfterRestart() {
        engine.start()
        fakeNowMs = 2_000L
        engine.stop()          // Frozen at 2 000 ms

        fakeNowMs = 5_000L    // 3 000 ms pass while stopped
        engine.start()         // Resume

        fakeNowMs = 6_000L    // 1 000 ms more while running
        assertEquals(3_000L, engine.elapsedMs())
    }

    // -----------------------------------------------------------------------
    // SE-4  Lap recording
    // -----------------------------------------------------------------------

    @Test
    fun lapRecordsCumulativeElapsedAndSplitTime() {
        engine.start()
        fakeNowMs = 4_000L
        engine.lap()

        val laps = engine.laps()
        assertEquals(1, laps.size)
        assertEquals(4_000L, laps[0].cumulativeMs)
        assertEquals(4_000L, laps[0].splitMs)  // First lap: split == cumulative
    }

    @Test
    fun secondLapSplitIsCorrect() {
        engine.start()
        fakeNowMs = 4_000L
        engine.lap()   // Lap 1 split = 4 000 ms

        fakeNowMs = 7_000L
        engine.lap()   // Lap 2 split = 7 000 − 4 000 = 3 000 ms

        val laps = engine.laps()
        assertEquals(2, laps.size)
        assertEquals(3_000L, laps[1].splitMs)
        assertEquals(7_000L, laps[1].cumulativeMs)
    }

    @Test
    fun lapNumbersAreSequential() {
        engine.start()
        repeat(5) { i ->
            fakeNowMs += 1_000L
            engine.lap()
        }
        engine.laps().forEachIndexed { index, lap ->
            assertEquals("Lap number should be 1-based", index + 1, lap.number)
        }
    }

    // -----------------------------------------------------------------------
    // SE-5  State invariants / defensive behaviour
    // -----------------------------------------------------------------------

    @Test
    fun callingStartTwiceDoesNotResetElapsed() {
        engine.start()
        fakeNowMs = 3_000L
        // A second start() call on an already-running engine should be a no-op
        engine.start()
        fakeNowMs = 4_000L
        // Elapsed should reflect time since the *first* start
        assertEquals(4_000L, engine.elapsedMs())
    }

    @Test
    fun lapWhileStoppedIsIgnored() {
        // Engine is stopped — lap should not add any entry
        engine.lap()
        assertTrue("Lap while stopped should not add entries", engine.laps().isEmpty())
    }

    @Test
    fun resetWhileRunningStopsAndClearsEngine() {
        engine.start()
        fakeNowMs = 2_000L
        engine.reset()
        assertEquals(StopwatchState.STOPPED, engine.getState())
        assertEquals(0L, engine.elapsedMs())
        assertTrue(engine.laps().isEmpty())
    }
}
