package com.clockstopper.app.domain

import org.junit.Assert.*
import org.junit.Test

/**
 * TimeFormatterTest
 * ─────────────────
 * Unit tests for [TimeFormatter].
 *
 * Every public function is exercised across representative boundary values:
 *   - Zero input
 *   - Sub-second values
 *   - Minute and hour rollovers
 *   - Very large durations
 *   - Negative inputs (treated as zero or with sign character)
 *
 * No Android framework imports — these tests run on the JVM via `./gradlew test`.
 */
class TimeFormatterTest {

    // ── formatElapsed ─────────────────────────────────────────────────────

    @Test
    fun `formatElapsed zero returns ZERO_TIME constant`() {
        assertEquals(TimeFormatter.ZERO_TIME, TimeFormatter.formatElapsed(0L))
    }

    @Test
    fun `formatElapsed negative value treated as zero`() {
        assertEquals(TimeFormatter.ZERO_TIME, TimeFormatter.formatElapsed(-1L))
        assertEquals(TimeFormatter.ZERO_TIME, TimeFormatter.formatElapsed(-999_999L))
    }

    @Test
    fun `formatElapsed centisecond precision`() {
        // 10 ms = 1 centisecond
        assertEquals("00:00.01", TimeFormatter.formatElapsed(10L))
        // 99 centiseconds = 990 ms
        assertEquals("00:00.99", TimeFormatter.formatElapsed(990L))
    }

    @Test
    fun `formatElapsed sub-second value`() {
        assertEquals("00:00.05", TimeFormatter.formatElapsed(50L))
        assertEquals("00:00.12", TimeFormatter.formatElapsed(120L))
    }

    @Test
    fun `formatElapsed exactly one second`() {
        assertEquals("00:01.00", TimeFormatter.formatElapsed(1_000L))
    }

    @Test
    fun `formatElapsed seconds rollover at 60`() {
        assertEquals("01:00.00", TimeFormatter.formatElapsed(60_000L))
        assertEquals("01:01.00", TimeFormatter.formatElapsed(61_000L))
    }

    @Test
    fun `formatElapsed 59 minutes 59 seconds 99 centiseconds`() {
        val ms = 59 * 60_000L + 59 * 1_000L + 990L
        assertEquals("59:59.99", TimeFormatter.formatElapsed(ms))
    }

    @Test
    fun `formatElapsed exactly one hour switches to HH format`() {
        val oneHourMs = 3_600_000L
        assertEquals("01:00:00.00", TimeFormatter.formatElapsed(oneHourMs))
    }

    @Test
    fun `formatElapsed one hour 23 minutes 45 seconds 67 centiseconds`() {
        val ms = 3_600_000L + 23 * 60_000L + 45 * 1_000L + 670L
        assertEquals("01:23:45.67", TimeFormatter.formatElapsed(ms))
    }

    @Test
    fun `formatElapsed hours field is uncapped for very long durations`() {
        val seventyTwoHoursMs = 72L * 3_600_000L
        assertEquals("72:00:00.00", TimeFormatter.formatElapsed(seventyTwoHoursMs))
    }

    @Test
    fun `formatElapsed milliseconds below centisecond threshold are truncated not rounded`() {
        // 1 009 ms → 1 s + 9 ms → 0 centiseconds (truncated)
        assertEquals("00:01.00", TimeFormatter.formatElapsed(1_009L))
        // 1 019 ms → 1 s + 19 ms → 1 centisecond
        assertEquals("00:01.01", TimeFormatter.formatElapsed(1_010L))
    }

    // ── formatSplit ───────────────────────────────────────────────────────

    @Test
    fun `formatSplit zero returns zeroed split`() {
        assertEquals("00:00.00", TimeFormatter.formatSplit(0L))
    }

    @Test
    fun `formatSplit negative value treated as zero`() {
        assertEquals("00:00.00", TimeFormatter.formatSplit(-500L))
    }

    @Test
    fun `formatSplit 3 seconds 21 centiseconds`() {
        assertEquals("00:03.21", TimeFormatter.formatSplit(3_210L))
    }

    @Test
    fun `formatSplit exactly one minute`() {
        assertEquals("01:00.00", TimeFormatter.formatSplit(60_000L))
    }

    @Test
    fun `formatSplit minutes grow beyond two digits for extreme values`() {
        // 100 min exactly (no hours field in split format)
        val hundredMinMs = 100L * 60_000L
        assertEquals("100:00.00", TimeFormatter.formatSplit(hundredMinMs))
    }

    @Test
    fun `formatSplit centisecond precision`() {
        assertEquals("00:01.05", TimeFormatter.formatSplit(1_050L))
        assertEquals("00:01.99", TimeFormatter.formatSplit(1_990L))
    }

    // ── formatDelta ───────────────────────────────────────────────────────

    @Test
    fun `formatDelta zero produces plus zero`() {
        assertEquals("+00.00", TimeFormatter.formatDelta(0L))
    }

    @Test
    fun `formatDelta positive value uses plus sign`() {
        // +1.23 s → +01.23
        assertEquals("+01.23", TimeFormatter.formatDelta(1_230L))
    }

    @Test
    fun `formatDelta negative value uses unicode minus`() {
        // −0.45 s → −00.45
        val result = TimeFormatter.formatDelta(-450L)
        assertTrue(
            "Expected unicode minus sign (\u2212) but got: $result",
            result.startsWith("\u2212"),
        )
        assertEquals("\u221200.45", result)
    }

    @Test
    fun `formatDelta shows minutes when delta exceeds 59 seconds`() {
        val sixtyTwoSeconds = 62_000L
        val result = TimeFormatter.formatDelta(sixtyTwoSeconds)
        assertTrue(result.startsWith("+"))
        assertEquals("+01:02.00", result)
    }

    @Test
    fun `formatDelta negative exceeding 59 seconds includes minutes`() {
        val result = TimeFormatter.formatDelta(-62_000L)
        assertEquals("\u221201:02.00", result)
    }

    @Test
    fun `formatDelta small centisecond delta`() {
        assertEquals("+00.01", TimeFormatter.formatDelta(10L))
        assertEquals("\u221200.01", TimeFormatter.formatDelta(-10L))
    }

    // ── ZERO_TIME constant ────────────────────────────────────────────────

    @Test
    fun `ZERO_TIME constant equals formatElapsed(0)`() {
        assertEquals(TimeFormatter.formatElapsed(0L), TimeFormatter.ZERO_TIME)
    }

    // ── isZeroDisplay ─────────────────────────────────────────────────────

    @Test
    fun `isZeroDisplay returns true for ZERO_TIME`() {
        assertTrue(TimeFormatter.isZeroDisplay(TimeFormatter.ZERO_TIME))
    }

    @Test
    fun `isZeroDisplay returns false for non-zero display`() {
        assertFalse(TimeFormatter.isZeroDisplay("00:01.00"))
        assertFalse(TimeFormatter.isZeroDisplay("01:00:00.00"))
        assertFalse(TimeFormatter.isZeroDisplay(""))
    }

    @Test
    fun `isZeroDisplay returns true only for exact match`() {
        // Leading/trailing space must not match
        assertFalse(TimeFormatter.isZeroDisplay(" 00:00.00"))
        assertFalse(TimeFormatter.isZeroDisplay("00:00.00 "))
    }
}
