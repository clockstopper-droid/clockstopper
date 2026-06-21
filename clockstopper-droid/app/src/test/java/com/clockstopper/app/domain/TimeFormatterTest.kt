package com.clockstopper.app.domain

import org.junit.Assert.*
import org.junit.Test

/**
 * Unit tests for [TimeFormatter].
 *
 * All tests run on the plain JVM with zero Android dependencies.
 */
class TimeFormatterTest {

    // -----------------------------------------------------------------------
    // format()
    // -----------------------------------------------------------------------

    @Test
    fun `format zero milliseconds`() {
        assertEquals("00:00.00", TimeFormatter.format(0L))
    }

    @Test
    fun `format sub-second value shows centiseconds`() {
        // 990 ms → 0 min, 0 sec, 99 centiseconds
        assertEquals("00:00.99", TimeFormatter.format(990L))
    }

    @Test
    fun `format exactly one second`() {
        assertEquals("00:01.00", TimeFormatter.format(1_000L))
    }

    @Test
    fun `format one second and 230 ms shows 23 centiseconds`() {
        assertEquals("00:01.23", TimeFormatter.format(1_230L))
    }

    @Test
    fun `format omits hours component when total time is less than one hour`() {
        // 61 500 ms = 1 min 1.5 sec
        val result = TimeFormatter.format(61_500L)
        assertFalse("Hours component should be absent", result.contains(Regex("""^\d+:""")))
        assertEquals("01:01.50", result)
    }

    @Test
    fun `format includes hours component when total time is one hour or more`() {
        // 3 661 000 ms = 1 h 1 min 1 sec
        assertEquals("01:01:01.00", TimeFormatter.format(3_661_000L))
    }

    @Test
    fun `format handles exactly 59 minutes 59 seconds without hours`() {
        val ms = (59 * 60 + 59) * 1_000L  // 3 599 000 ms
        assertEquals("59:59.00", TimeFormatter.format(ms))
    }

    @Test
    fun `format handles exactly 60 minutes (one hour) with hours component`() {
        val ms = 3_600_000L
        assertEquals("01:00:00.00", TimeFormatter.format(ms))
    }

    @Test
    fun `format treats negative input same as positive`() {
        assertEquals(TimeFormatter.format(1_230L), TimeFormatter.format(-1_230L))
    }

    // -----------------------------------------------------------------------
    // formatLap()
    // -----------------------------------------------------------------------

    @Test
    fun `formatLap without lap number returns just the time string`() {
        assertEquals("00:05.00", TimeFormatter.formatLap(5_000L))
    }

    @Test
    fun `formatLap with lap number includes lap prefix`() {
        val result = TimeFormatter.formatLap(5_000L, lapNumber = 3)
        assertTrue("Should contain 'Lap 3'", result.contains("Lap 3"))
        assertTrue("Should contain the time", result.contains("00:05.00"))
    }

    // -----------------------------------------------------------------------
    // parse()
    // -----------------------------------------------------------------------

    @Test
    fun `parse round-trips MM-SS-cc format`() {
        val original = 73_450L          // 01:13.45
        val formatted = TimeFormatter.format(original)
        assertEquals(original, TimeFormatter.parse(formatted))
    }

    @Test
    fun `parse round-trips HH-MM-SS-cc format`() {
        val original = 3_723_210L       // 01:02:03.21
        val formatted = TimeFormatter.format(original)
        assertEquals(original, TimeFormatter.parse(formatted))
    }

    @Test
    fun `parse zero string`() {
        assertEquals(0L, TimeFormatter.parse("00:00.00"))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `parse throws for invalid string`() {
        TimeFormatter.parse("not-a-time")
    }
}
