package com.clockstopper.app.domain

import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/**
 * Concurrency-safety tests for [StopwatchEngine].
 *
 * StopwatchEngine is a pure functional / immutable state machine — every method
 * takes a [StopwatchState] and returns a NEW [StopwatchState]; it never mutates
 * shared mutable state internally.  These tests verify that the engine can be
 * called concurrently from multiple threads without throwing exceptions or
 * producing corrupt state objects.
 *
 * NOTE: Thread-safety of the *holder* (ViewModel) is a separate concern and is
 * tested via [StopwatchViewModelTest].
 *
 * All tests run on the plain JVM — no Android dependencies.
 *
 * Feature coverage: Stopwatch correctness under rapid / concurrent usage
 * (maps to rapid Start/Stop scenario on Android).
 */
class StopwatchEngineConcurrencyTest {

    private class FixedClock(val value: Long = 0L) : StopwatchEngine.Clock {
        override fun nowMs(): Long = value
    }

    // -----------------------------------------------------------------------
    // T-1  Concurrent tick calls on a single shared running state
    // -----------------------------------------------------------------------

    /**
     * 8 threads each call tick() on the SAME immutable running-state snapshot.
     * Every call must return a valid non-null state without throwing.
     */
    @Test
    fun `concurrent tick calls on running state do not throw`() {
        val clock = FixedClock(0L)
        val engine = StopwatchEngine(clock)
        val runningState = engine.start(StopwatchState.INITIAL)

        val executor = Executors.newFixedThreadPool(8)
        val latch = CountDownLatch(8)
        val errors = AtomicReference<Throwable?>(null)

        repeat(8) {
            executor.submit {
                try {
                    val result = engine.tick(runningState)
                    assertNotNull(result)
                } catch (t: Throwable) {
                    errors.compareAndSet(null, t)
                } finally {
                    latch.countDown()
                }
            }
        }

        assertTrue("Threads did not finish in time", latch.await(5, TimeUnit.SECONDS))
        executor.shutdownNow()
        assertNull("Unexpected error in concurrent tick: ${errors.get()?.message}", errors.get())
    }

    // -----------------------------------------------------------------------
    // T-2  Sequential state transitions produce deterministic result
    // -----------------------------------------------------------------------

    /**
     * A single-threaded sequence of engine calls must always produce the same
     * final accumulated elapsed time regardless of the engine instance used.
     */
    @Test
    fun `sequential start-stop-start-stop gives deterministic elapsed time`() {
        fun buildElapsed(): Long {
            var t = 0L
            val clock = object : StopwatchEngine.Clock {
                override fun nowMs() = t
            }
            val engine = StopwatchEngine(clock)
            var state = StopwatchState.INITIAL

            t = 0L;     state = engine.start(state)
            t = 1_000L; state = engine.stop(state)
            t = 5_000L; state = engine.start(state)
            t = 6_500L; state = engine.stop(state)
            return state.elapsedMs
        }

        assertEquals(2_500L, buildElapsed())
        assertEquals(2_500L, buildElapsed())   // must be deterministic
    }

    // -----------------------------------------------------------------------
    // T-3  Engine methods return new instances (immutability contract)
    // -----------------------------------------------------------------------

    @Test
    fun `start returns a new state instance`() {
        val clock = FixedClock(0L)
        val engine = StopwatchEngine(clock)
        val initial = StopwatchState.INITIAL
        val started = engine.start(initial)
        assertNotSame(initial, started)
    }

    @Test
    fun `stop returns a new state instance`() {
        val clock = object : StopwatchEngine.Clock {
            var t = 0L; override fun nowMs() = t
        }
        val engine = StopwatchEngine(clock)
        var state = engine.start(StopwatchState.INITIAL)
        clock.t = 1_000L
        val stopped = engine.stop(state)
        assertNotSame(state, stopped)
    }

    @Test
    fun `lap returns a new state instance`() {
        val clock = object : StopwatchEngine.Clock {
            var t = 0L; override fun nowMs() = t
        }
        val engine = StopwatchEngine(clock)
        var state = engine.start(StopwatchState.INITIAL)
        clock.t = 500L
        val lapped = engine.lap(state)
        assertNotSame(state, lapped)
    }

    @Test
    fun `tick returns a new state instance when running`() {
        val clock = object : StopwatchEngine.Clock {
            var t = 0L; override fun nowMs() = t
        }
        val engine = StopwatchEngine(clock)
        val running = engine.start(StopwatchState.INITIAL)
        clock.t = 100L
        val ticked = engine.tick(running)
        assertNotSame(running, ticked)
    }
}
