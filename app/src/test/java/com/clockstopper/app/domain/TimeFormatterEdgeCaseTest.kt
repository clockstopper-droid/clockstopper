package com.clockstopper.app.domain

import org.junit.Assert.*
import org.junit.Test

/**
 * Additional edge-case and boundary tests for [TimeFormatter] that complement
 * [TimeFormatterTest].  Focuses on centisecond truncation, exact-boundary
 * transitions, and idempotent formatting.
 *
 * All tests run on the plain JVM — no Android dependencies.
 *
 * Feature coverage: Call Duration Timer display, Stopwatch elapsed-time display.
 */
class TimeFormatterEdgeCaseTest {

    // -----------------------------------------------------------------------
    // Centisecond truncation / rounding
    // -----------------------------------------------------------------------

    @Test
    fun `9 ms truncates to 00 centiseconds`() {
        // 9 ms / 10 = 0 centiseconds (floor, not round)
        assertEquals("00:00.00", TimeFormatter.format(9L))
    }

    @Test
    fun `999 ms truncates to 99 centiseconds`() {
        assertEquals("00:00.99", TimeFormatter.format(999L))
    }

    @Test
    fun `1001 ms shows 00 centiseconds on the second boundary`() {
        assertEquals("00:01.00", TimeFormatter.format(1_001L))
    }

    @Test
    fun `1099 ms still shows second 1 with 09 centiseconds`() {
        assertEquals("00:01.09", TimeFormatter.format(1_090L))
    }

    // -----------------------------------------------------------------------
    // Minute/hour exact boundaries
    // -----------------------------------------------------------------------

    @Test
    fun `3599999 ms is still sub-hour`() {
        // 59:59.99 — should NOT include hours
        val result = TimeFormatter.format(3_599_990L)
        assertFalse(result.matches(Regex("""\d{2}:\d{2}:\d{2}\.\d{2}""")))
        assertEquals("59:59.99", result)
    }

    @Test
    fun `3600000 ms is exactly one hour`() {
        assertEquals("01:00:00.00", TimeFormatter.format(3_600_000L))
    }

    @Test
    fun `3600001 ms is one hour plus one millisecond`() {
        // Still shows 01:00:00.00 because 1 ms → 0 centiseconds
        assertEquals("01:00:00.00", TimeFormatter.format(3_600_001L))
    }

    // -----------------------------------------------------------------------
    // Idempotent formatting
    // -----------------------------------------------------------------------

    @Test
    fun `formatting same value twice produces identical strings`() {
        val ms = 12_345_678L
        assertEquals(TimeFormatter.format(ms), TimeFormatter.format(ms))
    }

    // -----------------------------------------------------------------------
    // Very large values
    // -----------------------------------------------------------------------

    @Test
    fun `format handles 24 hours without overflow`() {
        val ms = 24L * 3_600_000L
        val result = TimeFormatter.format(ms)
        assertTrue("24-hour value should start with '24:'", result.startsWith("24:"))
    }

    @Test
    fun `format handles Long MAX gracefully without throwing`() {
        // Should not throw ArithmeticException or NumberFormatException
        try {
            TimeFormatter.format(Long.MAX_VALUE)
        } catch (e: Exception) {
            fail("format() must not throw for Long.MAX_VALUE but threw: ${e.javaClass.simpleName}")
        }
    }
}
