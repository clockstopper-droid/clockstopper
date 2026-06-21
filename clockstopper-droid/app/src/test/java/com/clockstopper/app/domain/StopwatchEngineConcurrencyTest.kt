package com.clockstopper.app.domain

import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/**
 * Immutability / concurrency contracts for [StopwatchEngine].
 * All tests run on the plain JVM.
 */
class StopwatchEngineConcurrencyTest {

    private class FixedClock(val value: Long = 0L) : StopwatchEngine.Clock {
        override fun nowMs(): Long = value
    }

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
                    assertNotNull(engine.tick(runningState))
                } catch (t: Throwable) {
                    errors.compareAndSet(null, t)
                } finally {
                    latch.countDown()
                }
            }
        }

        assertTrue("Threads did not finish", latch.await(5, TimeUnit.SECONDS))
        executor.shutdownNow()
        assertNull(errors.get()?.message, errors.get())
    }

    @Test
    fun `sequential start-stop-start-stop gives deterministic elapsed time`() {
        fun buildElapsed(): Long {
            var t = 0L
            val clock = object : StopwatchEngine.Clock { override fun nowMs() = t }
            val engine = StopwatchEngine(clock)
            var state = StopwatchState.INITIAL
            t = 0L;     state = engine.start(state)
            t = 1_000L; state = engine.stop(state)
            t = 5_000L; state = engine.start(state)
            t = 6_500L; state = engine.stop(state)
            return state.elapsedMs
        }
        assertEquals(2_500L, buildElapsed())
        assertEquals(2_500L, buildElapsed())
    }

    @Test
    fun `start returns a new state instance`() {
        val engine = StopwatchEngine(FixedClock(0L))
        val initial = StopwatchState.INITIAL
        assertNotSame(initial, engine.start(initial))
    }

    @Test
    fun `stop returns a new state instance`() {
        val clock = object : StopwatchEngine.Clock { var t = 0L; override fun nowMs() = t }
        val engine = StopwatchEngine(clock)
        val running = engine.start(StopwatchState.INITIAL)
        clock.t = 1_000L
        assertNotSame(running, engine.stop(running))
    }

    @Test
    fun `lap returns a new state instance`() {
        val clock = object : StopwatchEngine.Clock { var t = 0L; override fun nowMs() = t }
        val engine = StopwatchEngine(clock)
        val running = engine.start(StopwatchState.INITIAL)
        clock.t = 500L
        assertNotSame(running, engine.lap(running))
    }

    @Test
    fun `tick returns a new state instance when running`() {
        val clock = object : StopwatchEngine.Clock { var t = 0L; override fun nowMs() = t }
        val engine = StopwatchEngine(clock)
        val running = engine.start(StopwatchState.INITIAL)
        clock.t = 100L
        assertNotSame(running, engine.tick(running))
    }
}
