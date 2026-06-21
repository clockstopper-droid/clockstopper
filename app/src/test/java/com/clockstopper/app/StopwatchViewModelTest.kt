package com.clockstopper.app

import androidx.arch.core.executor.testing.InstantTaskExecutorRule
import androidx.lifecycle.Observer
import com.clockstopper.app.domain.StopwatchEngine
import com.clockstopper.app.domain.StopwatchState
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mock
import org.mockito.Mockito.*
import org.mockito.junit.MockitoJUnitRunner

/**
 * Unit tests for [StopwatchViewModel].
 *
 * Uses [InstantTaskExecutorRule] so LiveData emissions are synchronous, and
 * injects a [FakeClock] so timing is deterministic.  No Android instrumentation
 * is required — these run on the plain JVM.
 *
 * Feature coverage:
 *   - Stopwatch Start / Stop / Reset / Lap user actions
 *   - LiveData emissions reaching the Fragment observer
 *   - Lap list construction and ordering
 *   - Timer state across ViewModel lifecycle (survives config change proxy)
 */
@RunWith(MockitoJUnitRunner::class)
class StopwatchViewModelTest {

    // Runs LiveData tasks synchronously on the test thread
    @get:Rule
    val instantTaskRule = InstantTaskExecutorRule()

    // -----------------------------------------------------------------------
    // Fake clock injected into the engine
    // -----------------------------------------------------------------------

    private class FakeClock(var nowMs: Long = 0L) : StopwatchEngine.Clock {
        override fun nowMs(): Long = nowMs
    }

    private lateinit var fakeClock: FakeClock
    private lateinit var viewModel: StopwatchViewModel

    @Mock
    private lateinit var stateObserver: Observer<StopwatchState>

    @Before
    fun setUp() {
        fakeClock = FakeClock(0L)
        // StopwatchViewModel must accept a Clock for test injection.
        // If your implementation uses a default parameter, pass fakeClock here.
        viewModel = StopwatchViewModel(StopwatchEngine(fakeClock))
        viewModel.state.observeForever(stateObserver)
    }

    // -----------------------------------------------------------------------
    // Initial emission
    // -----------------------------------------------------------------------

    @Test
    fun `initial state emitted is INITIAL`() {
        val current = viewModel.state.value
        assertNotNull(current)
        assertFalse(current!!.isRunning)
        assertEquals(0L, current.totalElapsedMs)
    }

    // -----------------------------------------------------------------------
    // onStartStop()
    // -----------------------------------------------------------------------

    @Test
    fun `onStartStop transitions to running`() {
        viewModel.onStartStop()
        assertTrue(viewModel.state.value!!.isRunning)
    }

    @Test
    fun `onStartStop twice stops the stopwatch`() {
        viewModel.onStartStop()     // start
        viewModel.onStartStop()     // stop
        assertFalse(viewModel.state.value!!.isRunning)
    }

    @Test
    fun `onStartStop stop accumulates elapsed time`() {
        fakeClock.nowMs = 0L
        viewModel.onStartStop()             // start at 0
        fakeClock.nowMs = 3_000L
        viewModel.onStartStop()             // stop at 3 000

        assertEquals(3_000L, viewModel.state.value!!.elapsedMs)
    }

    @Test
    fun `state observer receives emission on start`() {
        viewModel.onStartStop()
        verify(stateObserver, atLeastOnce()).onChanged(any())
    }

    // -----------------------------------------------------------------------
    // onReset()
    // -----------------------------------------------------------------------

    @Test
    fun `onReset after stop returns state to INITIAL`() {
        fakeClock.nowMs = 0L
        viewModel.onStartStop()
        fakeClock.nowMs = 5_000L
        viewModel.onStartStop()
        viewModel.onReset()

        val state = viewModel.state.value!!
        assertFalse(state.isRunning)
        assertEquals(0L, state.elapsedMs)
        assertTrue(state.laps.isEmpty())
    }

    @Test
    fun `onReset clears laps`() {
        fakeClock.nowMs = 0L
        viewModel.onStartStop()
        fakeClock.nowMs = 1_000L; viewModel.onLap()
        fakeClock.nowMs = 2_000L; viewModel.onLap()
        viewModel.onStartStop()
        viewModel.onReset()

        assertTrue(viewModel.state.value!!.laps.isEmpty())
    }

    // -----------------------------------------------------------------------
    // onLap()
    // -----------------------------------------------------------------------

    @Test
    fun `onLap while running records a lap`() {
        fakeClock.nowMs = 0L
        viewModel.onStartStop()
        fakeClock.nowMs = 2_000L
        viewModel.onLap()

        assertEquals(1, viewModel.state.value!!.laps.size)
    }

    @Test
    fun `onLap is ignored when stopped`() {
        viewModel.onLap()   // never started
        assertTrue(viewModel.state.value!!.laps.isEmpty())
    }

    @Test
    fun `three onLap calls produce three laps in order`() {
        fakeClock.nowMs = 0L
        viewModel.onStartStop()
        fakeClock.nowMs = 1_000L; viewModel.onLap()
        fakeClock.nowMs = 3_000L; viewModel.onLap()
        fakeClock.nowMs = 6_000L; viewModel.onLap()

        val laps = viewModel.state.value!!.laps
        assertEquals(3, laps.size)
        assertEquals(listOf(1_000L, 2_000L, 3_000L), laps)
    }

    // -----------------------------------------------------------------------
    // tick() / display update
    // -----------------------------------------------------------------------

    @Test
    fun `tick while running updates currentSegmentMs`() {
        fakeClock.nowMs = 0L
        viewModel.onStartStop()
        fakeClock.nowMs = 500L
        viewModel.tick()    // ViewModel exposes tick() for the timer callback

        assertEquals(500L, viewModel.state.value!!.currentSegmentMs)
    }

    @Test
    fun `tick while stopped has no effect`() {
        fakeClock.nowMs = 500L
        viewModel.tick()    // never started

        assertEquals(0L, viewModel.state.value!!.currentSegmentMs)
    }

    // -----------------------------------------------------------------------
    // Proxy: state survives "re-subscription" (simulates config change)
    // -----------------------------------------------------------------------

    @Test
    fun `state value is retained after observer re-subscribes`() {
        fakeClock.nowMs = 0L
        viewModel.onStartStop()
        fakeClock.nowMs = 4_000L
        viewModel.onStartStop()     // stop with 4 s accumulated

        // Simulate re-subscribe (e.g. Fragment re-created on rotation)
        val newObserver = Observer<StopwatchState> {}
        viewModel.state.observeForever(newObserver)

        assertEquals(4_000L, viewModel.state.value!!.elapsedMs)
        viewModel.state.removeObserver(newObserver)
    }
}
