package com.clockstopper.app.domain

import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Unit tests for [TimeFormatter].
 *
 * Verifies that millisecond durations are formatted into human-readable strings
 * correctly across a full range of boundary values.
 *
 * These run on the JVM — no Android framework required.
 * Run with:  ./gradlew test
 *
 * Test areas:
 *   TF-1  Zero / initial display
 *   TF-2  Sub-second precision (centiseconds / milliseconds)
 *   TF-3  Minute roll-over
 *   TF-4  Hour roll-over
 *   TF-5  Large durations (multi-hour)
 *   TF-6  Format consistency (non-empty, colon-separated)
 */
class TimeFormatterTest {

    private lateinit var formatter: TimeFormatter

    @Before
    fun setUp() {
        formatter = TimeFormatter()
    }

    // -----------------------------------------------------------------------
    // TF-1  Zero state
    // -----------------------------------------------------------------------

    @Test
    fun zeroMillisecondsFormatsToZeroedDisplay() {
        val result = formatter.format(0L)
        // Accept any canonical zero format: "00:00.00", "00:00:00", "00:00:00.000"
        assertNotNull(result)
        assertTrue("Zero-ms format must not be blank", result.isNotBlank())
        assertTrue(
            "Zero-ms format should contain only zeros and separators, got: '$result'",
            result.all { it.isDigit() || it == ':' || it == '.' },
        )
        assertFalse(
            "Zero-ms format must not contain any non-zero digit, got: '$result'",
            result.any { it in '1'..'9' },
        )
    }

    // -----------------------------------------------------------------------
    // TF-2  Sub-second precision
    // -----------------------------------------------------------------------

    @Test
    fun hundredMillisecondsFormatIsNonZero() {
        val result = formatter.format(100L)
        assertNotNull(result)
        assertTrue("100 ms must produce a non-blank string", result.isNotBlank())
        // At least one digit must be non-zero
        assertTrue(
            "100 ms format must contain a non-zero digit, got: '$result'",
            result.any { it in '1'..'9' },
        )
    }

    @Test
    fun nineHundredNinetyNineMsIsLessThanOneSecond() {
        val result999 = formatter.format(999L)
        val result1000 = formatter.format(1_000L)
        assertNotEquals(
            "999 ms and 1000 ms should produce different strings",
            result999, result1000,
        )
    }

    // -----------------------------------------------------------------------
    // TF-3  Minute roll-over
    // -----------------------------------------------------------------------

    @Test
    fun exactlyOneMinute() {
        val result = formatter.format(60_000L)
        assertTrue(
            "1-minute format should contain '01' for the minutes field, got: '$result'",
            result.contains("01"),
        )
    }

    @Test
    fun ninetySeconds() {
        val result = formatter.format(90_000L)
        assertTrue(
            "90-second format should contain '01' for minutes and '30' for seconds, got: '$result'",
            result.contains("01") && result.contains("30"),
        )
    }

    // -----------------------------------------------------------------------
    // TF-4  Hour roll-over
    // -----------------------------------------------------------------------

    @Test
    fun exactlyOneHour() {
        val result = formatter.format(3_600_000L)
        // The formatted string must contain an hours component that is non-zero.
        // We accept "1:00:00", "01:00:00", "01:00:00.000" etc.
        assertTrue(
            "1-hour format must contain a non-zero hour component, got: '$result'",
            result.contains("1"),
        )
    }

    @Test
    fun oneHourOneMinuteOneSecond() {
        val ms = 3_600_000L + 60_000L + 1_000L  // 1 h 1 m 1 s
        val result = formatter.format(ms)
        assertNotNull(result)
        assertTrue("Must be non-blank for 1h1m1s", result.isNotBlank())
        assertTrue(
            "1h1m1s should contain '01' three times (for each unit), got: '$result'",
            result.count { it == '1' } >= 3,
        )
    }

    // -----------------------------------------------------------------------
    // TF-5  Large durations
    // -----------------------------------------------------------------------

    @Test
    fun tenHoursDoesNotOverflow() {
        val ms = 36_000_000L  // 10 hours
        val result = formatter.format(ms)
        assertNotNull(result)
        assertTrue("10-hour format must not be blank", result.isNotBlank())
        assertTrue(
            "10-hour format should contain '10' for the hours field, got: '$result'",
            result.contains("10"),
        )
    }

    // -----------------------------------------------------------------------
    // TF-6  Format structural consistency
    // -----------------------------------------------------------------------

    @Test
    fun formatNeverReturnsNull() {
        listOf(0L, 1L, 999L, 1_000L, 60_000L, 3_600_000L).forEach { ms ->
            val result = formatter.format(ms)
            assertNotNull("format($ms) must not return null", result)
        }
    }

    @Test
    fun formatAlwaysContainsAtLeastOneColon() {
        listOf(0L, 500L, 5_000L, 65_000L, 3_700_000L).forEach { ms ->
            val result = formatter.format(ms)
            assertTrue(
                "format($ms) = '$result' must contain at least one ':'",
                result.contains(':'),
            )
        }
    }

    @Test
    fun formatOutputIsMonotonicallyNonDecreasingForIncreasingInput() {
        // A formatted string should lexicographically increase (or stay equal)
        // as the millisecond input increases, when both inputs produce strings
        // of the same length (same time-range bucket).
        val a = formatter.format(30_000L)   // 30 s
        val b = formatter.format(45_000L)   // 45 s
        val c = formatter.format(60_000L)   // 60 s

        assertTrue(
            "30 s format ('$a') should be <= 45 s format ('$b')",
            a <= b,
        )
        assertTrue(
            "45 s format ('$b') should be <= 60 s format ('$c')",
            b <= c,
        )
    }
}
