package com.clockstopper.app.domain

import org.junit.Assert.*
import org.junit.Test

/**
 * Edge-case and boundary tests for [TimeFormatter].
 * All tests run on the plain JVM.
 */
class TimeFormatterEdgeCaseTest {

    @Test
    fun `9 ms truncates to 00 centiseconds`() {
        assertEquals("00:00.00", TimeFormatter.format(9L))
    }

    @Test
    fun `999 ms truncates to 99 centiseconds`() {
        assertEquals("00:00.99", TimeFormatter.format(999L))
    }

    @Test
    fun `3599999 ms is still sub-hour`() {
        val result = TimeFormatter.format(3_599_990L)
        assertFalse(result.matches(Regex("""\d{2}:\d{2}:\d{2}\.\d{2}""")))
        assertEquals("59:59.99", result)
    }

    @Test
    fun `3600000 ms is exactly one hour`() {
        assertEquals("01:00:00.00", TimeFormatter.format(3_600_000L))
    }

    @Test
    fun `formatting same value twice produces identical strings`() {
        val ms = 12_345_678L
        assertEquals(TimeFormatter.format(ms), TimeFormatter.format(ms))
    }

    @Test
    fun `format handles 24 hours without overflow`() {
        val ms = 24L * 3_600_000L
        assertTrue(TimeFormatter.format(ms).startsWith("24:"))
    }

    @Test
    fun `format handles Long MAX gracefully without throwing`() {
        try {
            TimeFormatter.format(Long.MAX_VALUE)
        } catch (e: Exception) {
            fail("format() must not throw for Long.MAX_VALUE: ${e.javaClass.simpleName}")
        }
    }
}
