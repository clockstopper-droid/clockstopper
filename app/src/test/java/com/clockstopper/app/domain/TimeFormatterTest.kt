package com.clockstopper.app.domain

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Unit tests for [TimeFormatter].
 * No Android framework dependency – runs with plain JUnit 4.
 */
class TimeFormatterTest {

    // ── formatElapsed (HH:MM:SS.mmm) ─────────────────────────────────────────

    @Test
    fun `formatElapsed returns all zeros for 0 ms`() {
        assertEquals("00:00:00.000", TimeFormatter.formatElapsed(0L))
    }

    @Test
    fun `formatElapsed pads single-digit components`() {
        // 1 hour, 2 min, 3 sec, 4 ms
        val ms = 3_600_000L + 2 * 60_000L + 3_000L + 4L
        assertEquals("01:02:03.004", TimeFormatter.formatElapsed(ms))
    }

    @Test
    fun `formatElapsed handles exactly 1 second`() {
        assertEquals("00:00:01.000", TimeFormatter.formatElapsed(1_000L))
    }

    @Test
    fun `formatElapsed handles exactly 1 minute`() {
        assertEquals("00:01:00.000", TimeFormatter.formatElapsed(60_000L))
    }

    @Test
    fun `formatElapsed handles exactly 1 hour`() {
        assertEquals("01:00:00.000", TimeFormatter.formatElapsed(3_600_000L))
    }

    @Test
    fun `formatElapsed handles millisecond precision`() {
        assertEquals("00:00:00.999", TimeFormatter.formatElapsed(999L))
        assertEquals("00:00:00.001", TimeFormatter.formatElapsed(1L))
    }

    @Test
    fun `formatElapsed handles values over 1 hour`() {
        val ms = 2 * 3_600_000L + 30 * 60_000L + 15_500L  // 2h 30m 15.5s
        assertEquals("02:30:15.500", TimeFormatter.formatElapsed(ms))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `formatElapsed throws for negative input`() {
        TimeFormatter.formatElapsed(-1L)
    }

    // ── formatSplit (MM:SS.mmm) ───────────────────────────────────────────────

    @Test
    fun `formatSplit returns all zeros for 0 ms`() {
        assertEquals("00:00.000", TimeFormatter.formatSplit(0L))
    }

    @Test
    fun `formatSplit formats a typical lap split`() {
        // 1 min 23.456 sec
        val ms = 60_000L + 23_456L
        assertEquals("01:23.456", TimeFormatter.formatSplit(ms))
    }

    @Test
    fun `formatSplit pads seconds and ms`() {
        assertEquals("00:01.007", TimeFormatter.formatSplit(1_007L))
    }

    @Test
    fun `formatSplit handles exactly 1 minute`() {
        assertEquals("01:00.000", TimeFormatter.formatSplit(60_000L))
    }

    @Test
    fun `formatSplit minute field grows beyond two digits for long durations`() {
        // 100 minutes
        val ms = 100L * 60_000L
        assertEquals("100:00.000", TimeFormatter.formatSplit(ms))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `formatSplit throws for negative input`() {
        TimeFormatter.formatSplit(-1L)
    }
}
