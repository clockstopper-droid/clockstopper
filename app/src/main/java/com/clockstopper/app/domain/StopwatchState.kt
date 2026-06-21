package com.clockstopper.app.domain

/**
 * Represents the lifecycle state of the stopwatch.
 *
 * The valid state machine transitions are:
 *
 *   IDLE ──start──► RUNNING ──stop──► PAUSED ──start──► RUNNING
 *                     │                  │
 *                   lap()             reset()
 *                     │                  │
 *                     ▼                  ▼
 *                  (lap recorded)      IDLE
 */
enum class StopwatchState {
    /** Timer has never been started, or has been fully reset. */
    IDLE,

    /** Timer is actively counting up. */
    RUNNING,

    /** Timer has been stopped but not yet reset; can be resumed. */
    PAUSED
}
