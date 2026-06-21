package com.clockstopper.app.domain

/**
 * Pure-Kotlin utility object for formatting raw millisecond values into
 * human-readable stopwatch strings.
 *
 * No Android framework dependencies – fully testable with plain JUnit.
 */
object TimeFormatter {

    /**
     * Formats [totalMs] as  **HH:MM:SS.mmm**  (e.g. "01:02:03.456").
     *
     * Hours are always shown so the display width stays constant during
     * long sessions. Milliseconds are shown with three digits.
     *
     * @param totalMs  Non-negative elapsed time in milliseconds.
     * @return Formatted time string.
     */
    fun formatElapsed(totalMs: Long): String {
        require(totalMs >= 0) { "totalMs must be ≥ 0, was $totalMs" }
        val ms  = totalMs % 1_000
        val sec = (totalMs / 1_000) % 60
        val min = (totalMs / 60_000) % 60
        val hr  = totalMs / 3_600_000
        return "%02d:%02d:%02d.%03d".format(hr, min, sec, ms)
    }

    /**
     * Formats [totalMs] as  **MM:SS.mmm**  (e.g. "02:03.456").
     *
     * Suitable for individual lap splits that are expected to be under one
     * hour. If the value exceeds 59:59.999, the minute field simply grows
     * beyond two digits.
     *
     * @param totalMs  Non-negative duration in milliseconds.
     * @return Formatted split string.
     */
    fun formatSplit(totalMs: Long): String {
        require(totalMs >= 0) { "totalMs must be ≥ 0, was $totalMs" }
        val ms  = totalMs % 1_000
        val sec = (totalMs / 1_000) % 60
        val min = totalMs / 60_000
        return "%02d:%02d.%03d".format(min, sec, ms)
    }
}
