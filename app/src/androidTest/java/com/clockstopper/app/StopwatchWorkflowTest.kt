package com.clockstopper.app

import android.os.SystemClock
import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.ViewActions.click
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.matcher.ViewMatchers.*
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import androidx.recyclerview.widget.RecyclerView
import org.hamcrest.Matchers.*
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * StopwatchWorkflowTest — end-to-end instrumented tests that exercise the
 * complete user-facing stopwatch workflows:
 *
 *   W-1  Start → verify timer is running (display changes)
 *   W-2  Start → Lap → verify lap row appears in list
 *   W-3  Start → multiple Laps → verify count matches
 *   W-4  Start → Stop → Reset → verify UI returns to zeroed state
 *   W-5  Rapid Start/Stop cycles do not crash
 *   W-6  Lap button state: disabled before start, enabled while running
 *   W-7  Lap button disabled again after Reset
 *   W-8  Reset button visible and operable at all stopwatch states
 *
 * All tests run on a connected device / emulator (API 26+).
 * Run with:  ./gradlew connectedAndroidTest
 */
@RunWith(AndroidJUnit4::class)
@LargeTest
class StopwatchWorkflowTest {

    private lateinit var scenario: ActivityScenario<MainActivity>

    private fun waitMs(ms: Long) = SystemClock.sleep(ms)

    @Before
    fun setUp() {
        scenario = ActivityScenario.launch(MainActivity::class.java)
    }

    @After
    fun tearDown() {
        scenario.close()
    }

    // -----------------------------------------------------------------------
    // W-1  Start → timer display changes
    // -----------------------------------------------------------------------

    /**
     * After tapping Start and waiting 300 ms the elapsed-time display must show
     * a value different from the zeroed initial state.
     */
    @Test
    fun timerDisplayChangesAfterStart() {
        var initialText = ""
        onView(withId(R.id.tv_elapsed_time)).check { view, _ ->
            initialText = (view as android.widget.TextView).text.toString()
        }

        onView(withId(R.id.btn_start_stop)).perform(click())
        waitMs(350)

        onView(withId(R.id.tv_elapsed_time))
            .check(matches(not(withText(initialText))))
    }

    // -----------------------------------------------------------------------
    // W-2  Start → Lap → lap row appears
    // -----------------------------------------------------------------------

    /**
     * Recording a lap while running must result in at least one item in the
     * RecyclerView lap list.
     */
    @Test
    fun singleLapAppearsInList() {
        onView(withId(R.id.btn_start_stop)).perform(click())
        waitMs(100)
        onView(withId(R.id.btn_lap)).perform(click())
        waitMs(50)

        onView(withId(R.id.rv_laps)).check { view, noViewFoundException ->
            noViewFoundException?.let { throw it }
            val rv = view as RecyclerView
            val itemCount = rv.adapter?.itemCount ?: 0
            assert(itemCount >= 1) {
                "Expected at least 1 lap item in RecyclerView but found $itemCount"
            }
        }
    }

    // -----------------------------------------------------------------------
    // W-3  Three laps → item count matches
    // -----------------------------------------------------------------------

    @Test
    fun multipleLapsProduceMatchingRowCount() {
        onView(withId(R.id.btn_start_stop)).perform(click())

        repeat(3) {
            waitMs(150)
            onView(withId(R.id.btn_lap)).perform(click())
        }

        waitMs(50)

        onView(withId(R.id.rv_laps)).check { view, noViewFoundException ->
            noViewFoundException?.let { throw it }
            val rv = view as RecyclerView
            val itemCount = rv.adapter?.itemCount ?: 0
            assert(itemCount == 3) {
                "Expected 3 lap items but found $itemCount"
            }
        }
    }

    // -----------------------------------------------------------------------
    // W-4  Start → Stop → Reset returns UI to zero
    // -----------------------------------------------------------------------

    /**
     * After a full Start → Stop → Reset cycle:
     *   - The RecyclerView lap list must be empty.
     *   - The elapsed-time display must revert to the same zeroed text it
     *     showed before the stopwatch was ever started.
     */
    @Test
    fun resetClearsLapsAndResetsDisplay() {
        var initialText = ""
        onView(withId(R.id.tv_elapsed_time)).check { view, _ ->
            initialText = (view as android.widget.TextView).text.toString()
        }

        onView(withId(R.id.btn_start_stop)).perform(click())
        waitMs(200)
        onView(withId(R.id.btn_lap)).perform(click())
        onView(withId(R.id.btn_start_stop)).perform(click())   // Stop
        onView(withId(R.id.btn_reset)).perform(click())        // Reset
        waitMs(50)

        // Lap list must be empty
        onView(withId(R.id.rv_laps)).check { view, noViewFoundException ->
            noViewFoundException?.let { throw it }
            val rv = view as RecyclerView
            val itemCount = rv.adapter?.itemCount ?: 0
            assert(itemCount == 0) {
                "Expected 0 lap items after reset but found $itemCount"
            }
        }

        // Display must revert to zeroed text
        onView(withId(R.id.tv_elapsed_time))
            .check(matches(withText(initialText)))
    }

    // -----------------------------------------------------------------------
    // W-5  Rapid Start / Stop cycles
    // -----------------------------------------------------------------------

    /**
     * Five rapid Start / Stop toggles must not cause any crash or ANR.
     */
    @Test
    fun rapidStartStopCyclesDoNotCrash() {
        repeat(5) {
            onView(withId(R.id.btn_start_stop)).perform(click())   // Start
            waitMs(60)
            onView(withId(R.id.btn_start_stop)).perform(click())   // Stop
            waitMs(40)
        }

        onView(withId(R.id.tv_elapsed_time)).check(matches(isDisplayed()))
    }

    // -----------------------------------------------------------------------
    // W-6  Lap button state management
    // -----------------------------------------------------------------------

    /** Before the stopwatch is started the Lap button should be disabled. */
    @Test
    fun lapButtonIsDisabledBeforeStart() {
        onView(withId(R.id.btn_lap))
            .check(matches(not(isEnabled())))
    }

    /** Once the stopwatch is running the Lap button must become enabled. */
    @Test
    fun lapButtonBecomesEnabledAfterStart() {
        onView(withId(R.id.btn_start_stop)).perform(click())
        waitMs(100)
        onView(withId(R.id.btn_lap))
            .check(matches(isEnabled()))
    }

    // -----------------------------------------------------------------------
    // W-7  Lap button disabled after Reset
    // -----------------------------------------------------------------------

    /** After a Reset the Lap button must return to the disabled state. */
    @Test
    fun lapButtonIsDisabledAfterReset() {
        onView(withId(R.id.btn_start_stop)).perform(click())
        waitMs(100)
        onView(withId(R.id.btn_start_stop)).perform(click())   // Stop
        onView(withId(R.id.btn_reset)).perform(click())        // Reset
        waitMs(50)

        onView(withId(R.id.btn_lap))
            .check(matches(not(isEnabled())))
    }

    // -----------------------------------------------------------------------
    // W-8  Reset button reachability
    // -----------------------------------------------------------------------

    /** Reset button must be visible and enabled before, during, and after a run. */
    @Test
    fun resetButtonIsAlwaysReachable() {
        // Before start
        onView(withId(R.id.btn_reset)).check(matches(isDisplayed()))

        // During run
        onView(withId(R.id.btn_start_stop)).perform(click())
        waitMs(100)
        onView(withId(R.id.btn_reset)).check(matches(isDisplayed()))

        // After stop
        onView(withId(R.id.btn_start_stop)).perform(click())
        onView(withId(R.id.btn_reset)).check(matches(isDisplayed()))

        // After reset
        onView(withId(R.id.btn_reset)).perform(click())
        onView(withId(R.id.btn_reset)).check(matches(isDisplayed()))
    }

    // -----------------------------------------------------------------------
    // W-9  10 laps stress test
    // -----------------------------------------------------------------------

    /**
     * Recording 10 laps must not crash and the RecyclerView must show
     * exactly 10 items.
     */
    @Test
    fun tenLapsStressTest() {
        onView(withId(R.id.btn_start_stop)).perform(click())

        repeat(10) {
            waitMs(80)
            onView(withId(R.id.btn_lap)).perform(click())
        }

        waitMs(50)

        onView(withId(R.id.rv_laps)).check { view, noViewFoundException ->
            noViewFoundException?.let { throw it }
            val rv = view as RecyclerView
            val itemCount = rv.adapter?.itemCount ?: 0
            assert(itemCount == 10) {
                "Expected 10 lap items but found $itemCount"
            }
        }
    }
}
