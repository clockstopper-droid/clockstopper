package com.clockstopper.app.domain

import org.junit.Assert.*
import org.junit.Test

/**
 * Unit tests for [TimeFormatter].
 *
 * Covers every formatting branch plus round-trip parse contracts.
 * All tests execute on the plain JVM — no Android dependencies.
 *
 * Feature coverage: Call Duration Timer display (MM:SS / HH:MM:SS formatting),
 * Stopwatch elapsed-time display.
 */
class TimeFormatterTest {

    // -----------------------------------------------------------------------
    // format() — sub-second / boundary values
    // -----------------------------------------------------------------------

    @Test
    fun `format zero milliseconds produces zeroed display`() {
        assertEquals("00:00.00", TimeFormatter.format(0L))
    }

    @Test
    fun `format 10 ms shows one centisecond`() {
        assertEquals("00:00.01", TimeFormatter.format(10L))
    }

    @Test
    fun `format 990 ms shows 99 centiseconds`() {
        assertEquals("00:00.99", TimeFormatter.format(990L))
    }

    @Test
    fun `format exactly one second`() {
        assertEquals("00:01.00", TimeFormatter.format(1_000L))
    }

    @Test
    fun `format 1230 ms shows 23 centiseconds`() {
        assertEquals("00:01.23", TimeFormatter.format(1_230L))
    }

    // -----------------------------------------------------------------------
    // format() — minutes boundary
    // -----------------------------------------------------------------------

    @Test
    fun `format 59 seconds 990 ms stays within MM-SS bracket`() {
        assertEquals("00:59.99", TimeFormatter.format(59_990L))
    }

    @Test
    fun `format 60 seconds rolls into one-minute display`() {
        assertEquals("01:00.00", TimeFormatter.format(60_000L))
    }

    @Test
    fun `format 61500 ms shows one minute one second`() {
        assertEquals("01:01.50", TimeFormatter.format(61_500L))
    }

    @Test
    fun `format omits hours component when total time is less than one hour`() {
        val result = TimeFormatter.format(61_500L)
        // Must NOT be prefixed with an hour segment like "00:01:01.50"
        assertFalse(
            "Hours component must be absent for sub-hour times",
            result.matches(Regex("""\d{2}:\d{2}:\d{2}\.\d{2}"""))
        )
    }

    @Test
    fun `format 59 minutes 59 seconds without hours segment`() {
        val ms = (59 * 60 + 59) * 1_000L
        assertEquals("59:59.00", TimeFormatter.format(ms))
    }

    // -----------------------------------------------------------------------
    // format() — hours boundary
    // -----------------------------------------------------------------------

    @Test
    fun `format exactly 60 minutes includes hours component`() {
        assertEquals("01:00:00.00", TimeFormatter.format(3_600_000L))
    }

    @Test
    fun `format 1 hour 1 minute 1 second`() {
        assertEquals("01:01:01.00", TimeFormatter.format(3_661_000L))
    }

    @Test
    fun `format 10 hours`() {
        assertEquals("10:00:00.00", TimeFormatter.format(36_000_000L))
    }

    @Test
    fun `format 99 hours does not truncate`() {
        val ms = 99L * 3_600_000L
        assertTrue(TimeFormatter.format(ms).startsWith("99:"))
    }

    // -----------------------------------------------------------------------
    // format() — negative / symmetry
    // -----------------------------------------------------------------------

    @Test
    fun `format treats negative input identically to its absolute value`() {
        assertEquals(TimeFormatter.format(1_230L), TimeFormatter.format(-1_230L))
    }

    // -----------------------------------------------------------------------
    // formatLap()
    // -----------------------------------------------------------------------

    @Test
    fun `formatLap without lap number returns bare time string`() {
        assertEquals("00:05.00", TimeFormatter.formatLap(5_000L))
    }

    @Test
    fun `formatLap with lap number 1 includes Lap 1 prefix`() {
        val result = TimeFormatter.formatLap(5_000L, lapNumber = 1)
        assertTrue("Must contain 'Lap 1'", result.contains("Lap 1"))
        assertTrue("Must contain the time string", result.contains("00:05.00"))
    }

    @Test
    fun `formatLap with lap number 99 pads correctly`() {
        val result = TimeFormatter.formatLap(120_000L, lapNumber = 99)
        assertTrue("Must contain 'Lap 99'", result.contains("Lap 99"))
    }

    @Test
    fun `formatLap result is non-empty`() {
        assertTrue(TimeFormatter.formatLap(0L).isNotBlank())
    }

    // -----------------------------------------------------------------------
    // parse() — round-trip contracts
    // -----------------------------------------------------------------------

    @Test
    fun `parse zero string returns zero`() {
        assertEquals(0L, TimeFormatter.parse("00:00.00"))
    }

    @Test
    fun `parse round-trips MM-SS-cc format`() {
        val original = 73_450L          // 01:13.45
        assertEquals(original, TimeFormatter.parse(TimeFormatter.format(original)))
    }

    @Test
    fun `parse round-trips HH-MM-SS-cc format`() {
        val original = 3_723_210L       // 01:02:03.21
        assertEquals(original, TimeFormatter.parse(TimeFormatter.format(original)))
    }

    @Test
    fun `parse round-trips sub-second value`() {
        val original = 550L             // 00:00.55
        assertEquals(original, TimeFormatter.parse(TimeFormatter.format(original)))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `parse throws IllegalArgumentException for completely invalid input`() {
        TimeFormatter.parse("not-a-time")
    }

    @Test(expected = IllegalArgumentException::class)
    fun `parse throws IllegalArgumentException for blank string`() {
        TimeFormatter.parse("")
    }
}
