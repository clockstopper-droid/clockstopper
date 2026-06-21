package com.clockstopper.app.domain

import kotlin.math.abs

/**
 * Platform-agnostic utilities for converting raw millisecond values into
 * human-readable stopwatch strings.
 *
 * All functions are pure (no side-effects, no Android dependencies) and can be
 * called from any layer: domain, ViewModel, unit test, or even a future
 * desktop / web target.
 *
 * ## Output format
 * The canonical display format is:
 * ```
 * HH:MM:SS.cc
 * ```
 * where:
 * - **HH** – hours, zero-padded to at least 2 digits (may exceed 2 for very long runs)
 * - **MM** – minutes (00–59)
 * - **SS** – seconds (00–59)
 * - **cc** – centiseconds / hundredths-of-a-second (00–99), matching the precision
 *            used in the original web front-end (`clockstopper-droid/js/app.js`).
 *
 * When the total time is less than one hour the hours component and its colon are
 * **omitted** so the display reads `MM:SS.cc` – again matching the web behaviour.
 *
 * ### Examples
 * | Input (ms) | Output        |
 * |------------|---------------|
 * | 0          | `00:00.00`    |
 * | 1_234      | `00:01.23`    |
 * | 61_500     | `01:01.50`    |
 * | 3_661_000  | `01:01:01.00` |
 */
object TimeFormatter {

    /**
     * Format [totalMs] as a stopwatch string.
     *
     * Negative values are treated as their absolute counterpart (i.e. no minus sign
     * is ever prepended) because elapsed time is always non-negative in practice.
     */
    fun format(totalMs: Long): String {
        val ms = abs(totalMs)

        val centiseconds = (ms / 10) % 100
        val seconds      = (ms / 1_000) % 60
        val minutes      = (ms / 60_000) % 60
        val hours        = ms / 3_600_000

        return if (hours > 0L) {
            "%02d:%02d:%02d.%02d".format(hours, minutes, seconds, centiseconds)
        } else {
            "%02d:%02d.%02d".format(minutes, seconds, centiseconds)
        }
    }

    /**
     * Format a lap duration [lapMs] with an optional [lapNumber] prefix.
     *
     * Returns e.g. `"Lap 3  00:12.34"` when [lapNumber] is provided, or just the
     * time string when it is `null`.
     */
    fun formatLap(lapMs: Long, lapNumber: Int? = null): String {
        val time = format(lapMs)
        return if (lapNumber != null) "Lap $lapNumber  $time" else time
    }

    /**
     * Parse a formatted stopwatch string back into milliseconds.
     *
     * Accepts both `"MM:SS.cc"` and `"HH:MM:SS.cc"` formats produced by [format].
     *
     * @throws IllegalArgumentException if [formatted] does not match either pattern.
     */
    fun parse(formatted: String): Long {
        val hhMmSsCc = Regex("""^(\d+):(\d{2}):(\d{2})\.(\d{2})$""")
        val mmSsCc   = Regex("""^(\d{2}):(\d{2})\.(\d{2})$""")

        val mmMatch = mmSsCc.matchEntire(formatted)
        if (mmMatch != null) {
            val (mm, ss, cc) = mmMatch.destructured
            return mm.toLong() * 60_000 +
                   ss.toLong() * 1_000 +
                   cc.toLong() * 10
        }

        val hhMatch = hhMmSsCc.matchEntire(formatted)
        if (hhMatch != null) {
            val (hh, mm, ss, cc) = hhMatch.destructured
            return hh.toLong() * 3_600_000 +
                   mm.toLong() * 60_000 +
                   ss.toLong() * 1_000 +
                   cc.toLong() * 10
        }

        throw IllegalArgumentException(
            "Cannot parse stopwatch string: \"$formatted\". " +
            "Expected MM:SS.cc or HH:MM:SS.cc"
        )
    }
}
