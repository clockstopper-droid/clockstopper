package com.clockstopper.app.domain

/**
 * TimeFormatter
 * ─────────────
 * **Pure, platform-agnostic** utility for converting a duration expressed in
 * milliseconds into human-readable string representations.
 *
 * All functions are top-level (no instance state) and free of Android imports,
 * making them trivially testable with plain JUnit.
 *
 * ### Supported formats
 *
 * | Format | Example | Use-case |
 * |---|---|---|
 * | `MM:SS.cc` | `01:23.45` | Primary elapsed-time display; centisecond precision |
 * | `HH:MM:SS.cc` | `01:23:45.67` | Overflow display when elapsed ≥ 1 hour |
 * | `MM:SS.cc` (lap) | `00:03.21` | Per-lap split durations |
 * | `+SS.cc` / `−SS.cc` | `+01.23` | Delta display (fastest/slowest difference) |
 *
 * ### Origin in web app (`app.js`)
 * The original JavaScript implementation rendered elapsed time as
 * `mm:ss:ms` using `Date` arithmetic. This Kotlin port preserves the
 * same precision (centiseconds = hundredths of a second) while replacing
 * all DOM / browser APIs with pure string manipulation.
 */
object TimeFormatter {

    // ── Primary display format ────────────────────────────────────────────

    /**
     * Formats [elapsedMs] for the main elapsed-time display.
     *
     * - Below 1 hour  →  `MM:SS.cc`  (e.g. `"05:23.09"`)
     * - 1 hour and above  →  `HH:MM:SS.cc`  (e.g. `"01:05:23.09"`)
     *
     * Hours are uncapped (a multi-day run renders as `"72:00:00.00"`) so the
     * format degrades gracefully for extreme durations.
     *
     * Negative values are treated as zero.
     *
     * @param elapsedMs Non-negative duration in milliseconds.
     * @return Formatted time string.
     */
    fun formatElapsed(elapsedMs: Long): String {
        val safeMs = maxOf(0L, elapsedMs)
        val centiseconds = (safeMs / 10) % 100
        val seconds = (safeMs / 1_000) % 60
        val minutes = (safeMs / 60_000) % 60
        val hours = safeMs / 3_600_000

        return if (hours > 0) {
            "%02d:%02d:%02d.%02d".format(hours, minutes, seconds, centiseconds)
        } else {
            "%02d:%02d.%02d".format(minutes, seconds, centiseconds)
        }
    }

    /**
     * Formats a lap split duration for display in the lap list.
     *
     * Uses the same `MM:SS.cc` format as [formatElapsed] (without the
     * hour segment) since individual lap splits rarely exceed an hour in
     * practice.  If a split somehow exceeds 59:59.99 the minutes field
     * simply grows beyond two digits (e.g. `"90:00.00"`).
     *
     * @param splitMs Non-negative lap split duration in milliseconds.
     * @return Formatted split string, e.g. `"00:03.21"`.
     */
    fun formatSplit(splitMs: Long): String {
        val safeMs = maxOf(0L, splitMs)
        val centiseconds = (safeMs / 10) % 100
        val seconds = (safeMs / 1_000) % 60
        val minutes = safeMs / 60_000        // intentionally uncapped

        return "%02d:%02d.%02d".format(minutes, seconds, centiseconds)
    }

    /**
     * Formats a **signed** millisecond delta for fastest/slowest difference
     * indicators displayed alongside lap rows.
     *
     * The sign prefix (`+` or `−`) is always included so the user can
     * immediately distinguish whether the lap was ahead of or behind the
     * reference time.
     *
     * - Positive delta (lap was slower than reference) → `"+SS.cc"` or `"+MM:SS.cc"`
     * - Negative delta (lap was faster than reference) → `"−SS.cc"` or `"−MM:SS.cc"`
     * - Zero delta → `"+00.00"`
     *
     * Note: The minus sign used is the Unicode **minus** character (`−`, U+2212)
     * rather than the ASCII hyphen-minus (`-`) for typographic correctness.
     *
     * @param deltaMs Signed delta in milliseconds.
     * @return Formatted delta string, e.g. `"+01.23"` or `"−00.45"`.
     */
    fun formatDelta(deltaMs: Long): String {
        val sign = if (deltaMs < 0) "\u2212" else "+"
        val absMs = kotlin.math.abs(deltaMs)
        val centiseconds = (absMs / 10) % 100
        val seconds = (absMs / 1_000) % 60
        val minutes = absMs / 60_000

        return if (minutes > 0) {
            "$sign%02d:%02d.%02d".format(minutes, seconds, centiseconds)
        } else {
            "$sign%02d.%02d".format(seconds, centiseconds)
        }
    }

    // ── Zero / initial display ────────────────────────────────────────────

    /**
     * The string shown in the elapsed-time display when the stopwatch is in
     * the [StopwatchStatus.RESET] state (before it has ever been started, or
     * after a reset).
     *
     * Matches the output of `formatElapsed(0L)` but is exposed as a named
     * constant so UI components can reference it without having to call the
     * formatter.
     */
    const val ZERO_TIME: String = "00:00.00"

    /**
     * Returns `true` when [text] represents the zeroed display value.
     *
     * Useful for UI components that need to detect the initial/reset state
     * without re-running the stopwatch engine.
     */
    fun isZeroDisplay(text: String): Boolean = text == ZERO_TIME
}
