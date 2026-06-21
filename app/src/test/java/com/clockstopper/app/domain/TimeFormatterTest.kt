package com.clockstopper.app.domain

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * TimeFormatterTest — verifies [TimeFormatter.format] for a representative set
 * of durations covering edge cases and typical values.
 *
 * No Android instrumentation required; runs on the JVM.
 */
class TimeFormatterTest {

    @Test
    fun zero_formatsAsAllZeroes() {
        assertEquals("00:00.00", TimeFormatter.format(0L))
    }

    @Test
    fun zero_constantMatchesFormattedZero() {
        assertEquals(TimeFormatter.format(0L), TimeFormatter.ZERO)
    }

    @Test
    fun oneSecond_formatsCorrectly() {
        // 1 000 ms → 00:01.00
        assertEquals("00:01.00", TimeFormatter.format(1_000L))
    }

    @Test
    fun oneMinute_formatsCorrectly() {
        // 60 000 ms → 01:00.00
        assertEquals("01:00.00", TimeFormatter.format(60_000L))
    }

    @Test
    fun mixedMinutesSecondsAndCentiseconds() {
        // 1 minute, 23 seconds, 456 ms → 01:23.45  (centiseconds truncated)
        assertEquals("01:23.45", TimeFormatter.format(83_456L))
    }

    @Test
    fun centisecondsAreHundredthsOfSecond() {
        // 1 500 ms → 0 minutes, 1 second, 50 centiseconds
        assertEquals("00:01.50", TimeFormatter.format(1_500L))
    }

    @Test
    fun minutesExceedTwoDigits() {
        // 3 661 000 ms = 61 min 1 sec → "61:01.00"
        assertEquals("61:01.00", TimeFormatter.format(3_661_000L))
    }

    @Test
    fun oneMillisecondBelowOneCentisecond_showsZeroCentiseconds() {
        // 9 ms → centiseconds = (9/10) % 100 = 0
        assertEquals("00:00.00", TimeFormatter.format(9L))
    }

    @Test
    fun tenMilliseconds_showsOneCentisecond() {
        // 10 ms → centiseconds = (10/10) % 100 = 1
        assertEquals("00:00.01", TimeFormatter.format(10L))
    }

    @Test
    fun largeValue_formatsWithoutOverflow() {
        // 99 minutes, 59 seconds, 990 ms → "99:59.99"
        val ms = (99L * 60 * 1_000) + (59L * 1_000) + 990L
        assertEquals("99:59.99", TimeFormatter.format(ms))
    }
}
