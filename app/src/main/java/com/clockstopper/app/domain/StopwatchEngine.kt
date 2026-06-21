package com.clockstopper.app.domain

/**
 * StopwatchEngine
 * ───────────────
 * **Pure, platform-agnostic** core of the stopwatch business logic.
 *
 * The engine is a simple state machine: callers hand it **time** (as
 * monotonic millisecond values) and **commands** (start / stop / lap /
 * reset), and it returns a new [StopwatchState] after every mutation.
 * It never touches threads, handlers, coroutines, or any Android class —
 * all scheduling is delegated to the caller (typically [StopwatchViewModel]).
 *
 * ### Monotonic clock contract
 * All `nowMs` parameters must come from a **monotonic** clock source
 * (e.g. `SystemClock.elapsedRealtime()` on Android, or `System.nanoTime()/1_000_000`
 * in unit tests) so that elapsed times remain correct across system-clock
 * adjustments.
 *
 * ### Immutability
 * [StopwatchState] is a `data class`; the engine produces a fresh copy for
 * every state transition. Previous states are never mutated.
 *
 * ### Thread-safety
 * The engine itself holds no mutable state — it stores only `Long` timestamps
 * and a lap accumulator. Callers that share an engine instance across threads
 * must synchronise externally (or, preferably, confine all calls to a single
 * thread / coroutine dispatcher).
 *
 * ### Lifecycle / state-machine
 * ```
 * ┌────────┐  start(now)  ┌─────────┐  stop(now)  ┌────────┐
 * │ RESET  │─────────────▶│ RUNNING │────────────▶│ PAUSED │
 * └────────┘              └─────────┘             └────────┘
 *      ▲                       │                       │
 *      │                  lap(now)                     │
 *      │                       │                  start(now)
 *      │                       ▼                       │
 *      │              (lap added to state)             │
 *      └──────────────── reset() ◀─────────────────────┘
 * ```
 *
 * ### Lap ranking
 * After every [lap] call the engine re-evaluates which lap is the fastest
 * (shortest split) and which is the slowest (longest split). Rankings are
 * only assigned when there are **≥ 2** laps — with a single lap there is
 * nothing to compare against. All lap objects in the returned [StopwatchState]
 * carry up-to-date [Lap.isFastest] / [Lap.isSlowest] flags.
 */
class StopwatchEngine {

    // ── Internal mutable state ────────────────────────────────────────────

    /**
     * Monotonic timestamp (ms) at which the stopwatch was last started or
     * resumed. `null` while paused or reset.
     */
    private var startTimestampMs: Long? = null

    /**
     * Accumulated elapsed time (ms) from all *previous* running intervals.
     * When the stopwatch is paused this value captures everything up to (but
     * not including) the current interval; when it is reset it is zeroed.
     */
    private var accumulatedMs: Long = 0L

    /**
     * Accumulated split time (ms) for the lap currently in progress.
     * Mirrors [accumulatedMs] but is reset to 0 every time [lap] is called.
     */
    private var lapAccumulatedMs: Long = 0L

    /**
     * Ordered list of completed lap records (oldest first).
     * Updated immutably via [toMutableList] + copy operations so that
     * previously emitted [StopwatchState] objects remain valid.
     */
    private var laps: MutableList<Lap> = mutableListOf()

    // ── Public API ────────────────────────────────────────────────────────

    /**
     * Starts or resumes the stopwatch.
     *
     * - From [StopwatchStatus.RESET]: begins a fresh session (accumulators
     *   are already zeroed; this sets [startTimestampMs]).
     * - From [StopwatchStatus.PAUSED]: resumes from the paused position.
     * - From [StopwatchStatus.RUNNING]: no-op (idempotent).
     *
     * @param nowMs Monotonic "now" in milliseconds from the caller's clock.
     * @return Updated [StopwatchState] with [StopwatchStatus.RUNNING].
     */
    fun start(nowMs: Long): StopwatchState {
        if (startTimestampMs != null) return snapshot(nowMs) // already running
        startTimestampMs = nowMs
        return snapshot(nowMs)
    }

    /**
     * Pauses the stopwatch, preserving accumulated elapsed time.
     *
     * - From [StopwatchStatus.RUNNING]: captures the current interval into
     *   [accumulatedMs] and clears [startTimestampMs].
     * - From [StopwatchStatus.PAUSED] or [StopwatchStatus.RESET]: no-op.
     *
     * @param nowMs Monotonic "now" in milliseconds.
     * @return Updated [StopwatchState] with [StopwatchStatus.PAUSED].
     */
    fun stop(nowMs: Long): StopwatchState {
        val start = startTimestampMs ?: return snapshot(nowMs) // not running
        val elapsed = nowMs - start
        accumulatedMs += elapsed
        lapAccumulatedMs += elapsed
        startTimestampMs = null
        return snapshot(nowMs)
    }

    /**
     * Records the current elapsed time as a lap split, then resets the
     * lap-interval accumulator.
     *
     * Only meaningful while [StopwatchStatus.RUNNING]; calling it in other
     * states is a no-op that returns the current state unchanged.
     *
     * After every lap the [Lap.isFastest] / [Lap.isSlowest] flags are
     * recomputed across **all** laps so the caller always receives accurate
     * rankings in the returned state.
     *
     * @param nowMs Monotonic "now" in milliseconds.
     * @return Updated [StopwatchState] with the new lap appended.
     */
    fun lap(nowMs: Long): StopwatchState {
        val start = startTimestampMs ?: return snapshot(nowMs) // not running

        val currentIntervalMs = nowMs - start
        val splitMs = lapAccumulatedMs + currentIntervalMs
        val totalMs = accumulatedMs + currentIntervalMs

        // Reset lap accumulator for the next lap interval
        lapAccumulatedMs = 0L
        accumulatedMs = totalMs      // keep total in sync
        startTimestampMs = nowMs     // restart interval measurement

        val newLap = Lap(
            index = laps.size + 1,
            splitMs = splitMs,
            totalMs = totalMs,
        )
        laps.add(newLap)
        recomputeRankings()

        return snapshot(nowMs)
    }

    /**
     * Resets the stopwatch to its initial state.
     *
     * All accumulators, timestamps, and lap records are cleared. The engine
     * is ready to accept a fresh [start] call.
     *
     * This method is idempotent: resetting an already-reset engine is safe.
     *
     * @return [StopwatchState] with [StopwatchStatus.RESET] and all fields
     *         zeroed / empty.
     */
    fun reset(): StopwatchState {
        startTimestampMs = null
        accumulatedMs = 0L
        lapAccumulatedMs = 0L
        laps = mutableListOf()
        return StopwatchState(status = StopwatchStatus.RESET)
    }

    /**
     * Returns the current [StopwatchState] without modifying any internal
     * state. Useful for polling the current elapsed time from a ticker.
     *
     * @param nowMs Monotonic "now" in milliseconds.
     */
    fun snapshot(nowMs: Long): StopwatchState {
        val intervalMs = startTimestampMs?.let { nowMs - it } ?: 0L
        val elapsedMs = accumulatedMs + intervalMs
        val lapSplitMs = lapAccumulatedMs + intervalMs

        val status = when {
            startTimestampMs != null -> StopwatchStatus.RUNNING
            elapsedMs > 0L -> StopwatchStatus.PAUSED
            else -> StopwatchStatus.RESET
        }

        return StopwatchState(
            status = status,
            elapsedMs = elapsedMs,
            lapSplitMs = lapSplitMs,
            laps = laps.toList(), // defensive copy
        )
    }

    // ── Private helpers ───────────────────────────────────────────────────

    /**
     * Re-evaluates fastest / slowest rankings across all recorded laps.
     *
     * Rankings are **only** assigned when there are at least two laps.
     * With a single lap there is nothing to compare against so no lap is
     * marked fastest or slowest (both flags remain `false`).
     *
     * Ties: if two laps share the same split duration the *first* (oldest)
     * one in insertion order is marked as fastest/slowest.
     */
    private fun recomputeRankings() {
        if (laps.size < 2) {
            // Ensure any previously set flags are cleared (edge case: list
            // was externally modified, which cannot happen here, but defensive).
            laps.replaceAll { it.copy(isFastest = false, isSlowest = false) }
            return
        }

        val minSplit = laps.minOf { it.splitMs }
        val maxSplit = laps.maxOf { it.splitMs }

        var fastestAssigned = false
        var slowestAssigned = false

        laps.replaceAll { lap ->
            val fastest = !fastestAssigned && lap.splitMs == minSplit
            val slowest = !slowestAssigned && lap.splitMs == maxSplit
            if (fastest) fastestAssigned = true
            if (slowest) slowestAssigned = true
            lap.copy(isFastest = fastest, isSlowest = slowest)
        }
    }
}
