package com.clockstopper.app.domain

/**
 * Derived statistics computed from a completed set of lap recordings.
 *
 * This value object is produced by [LapAnalyzer.summarise] and can be consumed
 * directly by a ViewModel or UI layer without carrying any Android dependencies.
 *
 * @property count      Total number of laps recorded.
 * @property fastestMs  Duration of the fastest (shortest) lap in milliseconds,
 *                      or `null` when [count] is zero.
 * @property slowestMs  Duration of the slowest (longest) lap in milliseconds,
 *                      or `null` when [count] is zero.
 * @property averageMs  Arithmetic mean lap duration in milliseconds (truncated),
 *                      or `null` when [count] is zero.
 * @property totalMs    Sum of all recorded lap durations in milliseconds.
 */
data class LapSummary(
    val count: Int,
    val fastestMs: Long?,
    val slowestMs: Long?,
    val averageMs: Long?,
    val totalMs: Long,
)
