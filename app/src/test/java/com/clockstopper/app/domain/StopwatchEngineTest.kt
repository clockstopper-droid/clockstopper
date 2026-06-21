package com.clockstopper.app.domain

import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Unit tests for [StopwatchEngine].
 *
 * A deterministic fake clock is injected so tests are completely reproducible
 * and millisecond-accurate without any real-time delays.
 */
class StopwatchEngineTest {

    // Mutable wall-clock; advance it manually in each test.
    private var fakeNow = 0L
    private lateinit var engine: StopwatchEngine

    @Before
    fun setUp() {
        fakeNow = 0L
        engine  = StopwatchEngine(clock = { fakeNow })
    }

    // ── Initial state ─────────────────────────────────────────────────────────

    @Test
    fun `initial state is IDLE`() {
        assertEquals(StopwatchState.IDLE, engine.state)
    }

    @Test
    fun `elapsedMs is 0 when IDLE`() {
        assertEquals(0L, engine.elapsedMs)
    }

    @Test
    fun `currentLapMs is 0 when IDLE`() {
        assertEquals(0L, engine.currentLapMs)
    }

    @Test
    fun `laps list is empty on creation`() {
        assertTrue(engine.laps.isEmpty())
    }

    // ── Start ─────────────────────────────────────────────────────────────────

    @Test
    fun `start transitions IDLE to RUNNING`() {
        engine.start()
        assertEquals(StopwatchState.RUNNING, engine.state)
    }

    @Test
    fun `elapsedMs counts up while RUNNING`() {
        engine.start()
        fakeNow = 1_500L
        assertEquals(1_500L, engine.elapsedMs)
    }

    @Test
    fun `calling start while RUNNING is a no-op`() {
        engine.start()
        fakeNow = 500L
        engine.start()   // second call – should be ignored
        fakeNow = 1_000L
        assertEquals(1_000L, engine.elapsedMs)
    }

    // ── Stop ──────────────────────────────────────────────────────────────────

    @Test
    fun `stop transitions RUNNING to PAUSED`() {
        engine.start()
        engine.stop()
        assertEquals(StopwatchState.PAUSED, engine.state)
    }

    @Test
    fun `elapsedMs does not advance while PAUSED`() {
        engine.start()
        fakeNow = 2_000L
        engine.stop()
        val snapshotMs = engine.elapsedMs
        fakeNow = 9_999L     // time passes – should not affect the frozen value
        assertEquals(snapshotMs, engine.elapsedMs)
    }

    @Test
    fun `calling stop while not RUNNING is a no-op`() {
        // IDLE → stop() → still IDLE
        engine.stop()
        assertEquals(StopwatchState.IDLE, engine.state)
    }

    // ── Resume ────────────────────────────────────────────────────────────────

    @Test
    fun `start after PAUSED resumes accumulation correctly`() {
        engine.start()
        fakeNow = 1_000L
        engine.stop()
        // Elapsed so far = 1_000 ms.  Now 500 ms gap during pause.
        fakeNow = 1_500L
        engine.start()         // resume
        fakeNow = 2_500L       // 1_000 ms more of running
        // Total running time = 1_000 + 1_000 = 2_000 ms (gap not counted).
        assertEquals(2_000L, engine.elapsedMs)
    }

    // ── Lap ───────────────────────────────────────────────────────────────────

    @Test
    fun `lap records a LapSummary with correct split and cumulative values`() {
        engine.start()
        fakeNow = 5_000L
        engine.lap()

        assertEquals(1, engine.laps.size)
        val lap = engine.laps.first()
        assertEquals(1,      lap.lapNumber)
        assertEquals(5_000L, lap.splitMs)
        assertEquals(5_000L, lap.cumulativeMs)
    }

    @Test
    fun `second lap split equals time since first lap marker`() {
        engine.start()
        fakeNow = 3_000L
        engine.lap()          // Lap 1 split = 3_000
        fakeNow = 7_000L
        engine.lap()          // Lap 2 split = 4_000

        // laps list is most-recent first
        val lap2 = engine.laps[0]
        val lap1 = engine.laps[1]
        assertEquals(2,      lap2.lapNumber)
        assertEquals(4_000L, lap2.splitMs)
        assertEquals(7_000L, lap2.cumulativeMs)
        assertEquals(1,      lap1.lapNumber)
        assertEquals(3_000L, lap1.splitMs)
    }

    @Test(expected = IllegalStateException::class)
    fun `lap throws when not RUNNING`() {
        engine.lap()   // state is IDLE
    }

    @Test
    fun `currentLapNumber increments after each lap`() {
        engine.start()
        assertEquals(1, engine.currentLapNumber)
        engine.lap()
        assertEquals(2, engine.currentLapNumber)
        engine.lap()
        assertEquals(3, engine.currentLapNumber)
    }

    // ── Reset ─────────────────────────────────────────────────────────────────

    @Test
    fun `reset from RUNNING returns to IDLE`() {
        engine.start()
        fakeNow = 1_000L
        engine.reset()
        assertEquals(StopwatchState.IDLE, engine.state)
    }

    @Test
    fun `reset clears accumulated time and laps`() {
        engine.start()
        fakeNow = 3_000L
        engine.lap()
        engine.reset()

        assertEquals(0L, engine.elapsedMs)
        assertTrue(engine.laps.isEmpty())
    }

    @Test
    fun `engine can be restarted cleanly after reset`() {
        engine.start()
        fakeNow = 5_000L
        engine.stop()
        engine.reset()

        fakeNow = 6_000L   // time continues but is not counted
        engine.start()
        fakeNow = 7_000L
        assertEquals(1_000L, engine.elapsedMs)
    }

    // ── currentLapMs ──────────────────────────────────────────────────────────

    @Test
    fun `currentLapMs reflects time since last lap marker`() {
        engine.start()
        fakeNow = 4_000L
        engine.lap()          // lap 1 recorded; new lap starts at 4_000

        fakeNow = 4_800L
        assertEquals(800L, engine.currentLapMs)
    }

    @Test
    fun `currentLapMs freezes when PAUSED`() {
        engine.start()
        fakeNow = 2_000L
        engine.stop()
        val frozen = engine.currentLapMs
        fakeNow = 9_999L
        assertEquals(frozen, engine.currentLapMs)
    }
}
