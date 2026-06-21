package com.clockstopper.app.domain

import java.util.Locale

/**
 * TimeFormatter
 * ─────────────
 * Pure-Kotlin utility object that converts a raw millisecond duration into a
 * human-readable string suitable for display in the stopwatch UI.
 *
 * Output format
 * ─────────────
 * `MM:SS.cc`
 *   MM  — minutes (zero-padded to 2 digits, grows beyond 2 if needed)
 *   SS  — seconds within the current minute (zero-padded, 00–59)
 *   cc  — centiseconds (hundredths of a second, 00–99)
 *
 * Examples
 * ────────
 *   0 ms         →  "00:00.00"
 *   1 500 ms     →  "00:01.50"
 *   61 234 ms    →  "01:01.23"
 *   3 661 000 ms →  "61:01.00"
 *
 * The format is deliberately compact and matches the canonical stopwatch
 * presentation familiar to users of physical sports stopwatches.
 */
object TimeFormatter {

    /**
     * Format [elapsedMs] as `MM:SS.cc`.
     *
     * @param elapsedMs Non-negative total elapsed milliseconds.
     * @return Formatted time string.
     */
    fun format(elapsedMs: Long): String {
        require(elapsedMs >= 0) { "elapsedMs must be non-negative, got $elapsedMs" }

        val centiseconds = (elapsedMs / 10) % 100
        val totalSeconds = elapsedMs / 1_000
        val seconds = totalSeconds % 60
        val minutes = totalSeconds / 60

        return String.format(Locale.ROOT, "%02d:%02d.%02d", minutes, seconds, centiseconds)
    }

    /**
     * Convenience alias — returns [format] output for the zeroed / initial state.
     */
    val ZERO: String = format(0L)
}
