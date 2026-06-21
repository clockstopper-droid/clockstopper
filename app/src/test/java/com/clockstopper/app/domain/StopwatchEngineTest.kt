package com.clockstopper.app.domain

import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * StopwatchEngineTest — unit tests for [StopwatchEngine].
 *
 * A deterministic fake clock (`fakeNow`) is injected so tests do not rely on
 * wall-clock time and are therefore stable across any execution environment.
 *
 * Run with:  ./gradlew test
 */
class StopwatchEngineTest {

    private var fakeNow = 0L
    private lateinit var engine: StopwatchEngine

    @Before
    fun setUp() {
        fakeNow = 0L
        engine = StopwatchEngine(nowMs = { fakeNow })
    }

    // -----------------------------------------------------------------------
    // Initial state
    // -----------------------------------------------------------------------

    @Test
    fun initialState_isZeroedAndNotRunning() {
        val state = engine.currentState()
        assertEquals(0L, state.elapsedMs)
        assertFalse(state.isRunning)
        assertTrue(state.laps.isEmpty())
    }

    // -----------------------------------------------------------------------
    // Start / Stop
    // -----------------------------------------------------------------------

    @Test
    fun afterStart_isRunning() {
        val state = engine.startStop()
        assertTrue(state.isRunning)
    }

    @Test
    fun afterStart_elapsedTimeIncreasesWithFakeClock() {
        engine.startStop()         // start at t=0
        fakeNow = 1_000L           // advance clock by 1 s
        val state = engine.currentState()
        assertEquals(1_000L, state.elapsedMs)
    }

    @Test
    fun afterStop_isNotRunning() {
        engine.startStop()         // start
        engine.startStop()         // stop
        assertFalse(engine.currentState().isRunning)
    }

    @Test
    fun stopPreservesAccumulatedTime() {
        engine.startStop()         // start at t=0
        fakeNow = 2_000L
        engine.startStop()         // stop at t=2000 → accumulated = 2000
        assertEquals(2_000L, engine.currentState().elapsedMs)
    }

    @Test
    fun resumeAfterPauseAccumulatesCorrectly() {
        engine.startStop()         // start at 0
        fakeNow = 1_000L
        engine.startStop()         // pause → accumulated = 1000
        fakeNow = 3_000L
        engine.startStop()         // resume at 3000
        fakeNow = 5_000L
        // total = 1000 (first interval) + (5000-3000) = 3000
        assertEquals(3_000L, engine.currentState().elapsedMs)
    }

    // -----------------------------------------------------------------------
    // Lap
    // -----------------------------------------------------------------------

    @Test
    fun singleLap_splitEqualsCumulativeTime() {
        engine.startStop()         // start at 0
        fakeNow = 5_000L
        val state = engine.lap()
        assertEquals(1, state.laps.size)
        assertEquals(5_000L, state.laps[0])
    }

    @Test
    fun multipleLaps_splitsAreRelativeToLastLap() {
        engine.startStop()         // start at 0

        fakeNow = 3_000L
        engine.lap()               // lap 1: split = 3000

        fakeNow = 7_000L
        val state = engine.lap()   // lap 2: split = 4000

        assertEquals(2, state.laps.size)
        assertEquals(3_000L, state.laps[0])
        assertEquals(4_000L, state.laps[1])
    }

    @Test
    fun lap_doesNotStopTheTimer() {
        engine.startStop()
        fakeNow = 1_000L
        engine.lap()
        assertTrue(engine.currentState().isRunning)
    }

    // -----------------------------------------------------------------------
    // Reset
    // -----------------------------------------------------------------------

    @Test
    fun reset_returnsInitialState() {
        engine.startStop()
        fakeNow = 5_000L
        engine.lap()
        val state = engine.reset()
        assertEquals(StopwatchState.INITIAL, state)
    }

    @Test
    fun reset_engineBehavesLikeFreshInstance() {
        engine.startStop()
        fakeNow = 1_000L
        engine.lap()
        engine.reset()

        // Start fresh
        engine.startStop()         // start at t=1000 (fake clock unchanged)
        fakeNow = 2_000L           // advance by 1000
        val state = engine.currentState()
        // Only the 1000 ms since the post-reset start should count
        assertEquals(1_000L, state.elapsedMs)
        assertTrue(state.laps.isEmpty())
    }

    // -----------------------------------------------------------------------
    // Edge cases
    // -----------------------------------------------------------------------

    @Test
    fun stopAndResetImmediately_elapsedIsZero() {
        engine.startStop()   // start
        engine.startStop()   // stop immediately (fakeNow still 0)
        engine.reset()
        assertEquals(0L, engine.currentState().elapsedMs)
    }

    @Test
    fun multipleResets_stateRemainsInitial() {
        engine.reset()
        engine.reset()
        assertEquals(StopwatchState.INITIAL, engine.currentState())
    }
}
