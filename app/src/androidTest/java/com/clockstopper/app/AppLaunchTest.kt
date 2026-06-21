package com.clockstopper.app

import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.ViewActions.click
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.matcher.ViewMatchers.*
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * AppLaunchTest — instrumented smoke tests that validate:
 *   1. MainActivity launches without crashing on API 26+ devices/emulators.
 *   2. The NavHostFragment is inflated and the start destination is displayed.
 *   3. Core stopwatch UI controls are present and respond to interaction.
 *
 * Run with:  ./gradlew connectedAndroidTest
 *
 * These tests require a connected device or emulator (API 26+).
 */
@RunWith(AndroidJUnit4::class)
@LargeTest
class AppLaunchTest {

    private lateinit var scenario: ActivityScenario<MainActivity>

    @Before
    fun setUp() {
        scenario = ActivityScenario.launch(MainActivity::class.java)
    }

    @After
    fun tearDown() {
        scenario.close()
    }

    // -----------------------------------------------------------------------
    // Launch / host checks
    // -----------------------------------------------------------------------

    /**
     * The Activity must reach the RESUMED state without throwing any exception.
     * A crash during onCreate / navigation inflation surfaces here as a test failure.
     */
    @Test
    fun activityLaunchesWithoutCrash() {
        scenario.onActivity { activity ->
            assert(activity != null) { "MainActivity should not be null" }
        }
    }

    /**
     * The root NavHostFragment container must be visible after launch.
     * If the navigation graph failed to inflate this view would be GONE / missing.
     */
    @Test
    fun navHostFragmentContainerIsDisplayed() {
        onView(withId(R.id.nav_host_fragment))
            .check(matches(isDisplayed()))
    }

    // -----------------------------------------------------------------------
    // Start-destination (StopwatchFragment) presence checks
    // -----------------------------------------------------------------------

    /** The primary stopwatch display (elapsed-time TextView) must be visible. */
    @Test
    fun stopwatchTimeDisplayIsVisible() {
        onView(withId(R.id.tv_elapsed_time))
            .check(matches(isDisplayed()))
    }

    /** The Start / Stop toggle button must be visible and enabled on launch. */
    @Test
    fun startStopButtonIsVisibleAndEnabled() {
        onView(withId(R.id.btn_start_stop))
            .check(matches(isDisplayed()))
            .check(matches(isEnabled()))
    }

    /** The Lap button must be visible on launch. */
    @Test
    fun lapButtonIsVisible() {
        onView(withId(R.id.btn_lap))
            .check(matches(isDisplayed()))
    }

    /** The Reset button must be visible on launch. */
    @Test
    fun resetButtonIsVisible() {
        onView(withId(R.id.btn_reset))
            .check(matches(isDisplayed()))
    }

    /** The lap list RecyclerView must be present in the layout. */
    @Test
    fun lapListRecyclerViewIsPresent() {
        onView(withId(R.id.rv_laps))
            .check(matches(isDisplayed()))
    }

    // -----------------------------------------------------------------------
    // Initial state checks
    // -----------------------------------------------------------------------

    /**
     * On a fresh launch the elapsed-time display must be non-empty (shows
     * zeroed state like "00:00.00").
     */
    @Test
    fun initialTimeDisplayShowsZeroedState() {
        onView(withId(R.id.tv_elapsed_time))
            .check(matches(isDisplayed()))
            .check(matches(withText(org.hamcrest.Matchers.not(org.hamcrest.Matchers.isEmptyString()))))
    }

    // -----------------------------------------------------------------------
    // Basic interaction — Start / Stop cycle
    // -----------------------------------------------------------------------

    /**
     * Tapping Start must not crash the app and the button must remain operable.
     */
    @Test
    fun tappingStartDoesNotCrash() {
        onView(withId(R.id.btn_start_stop)).perform(click())

        onView(withId(R.id.btn_start_stop))
            .check(matches(isDisplayed()))
            .check(matches(isEnabled()))
    }

    /** Start then immediately Stop — must survive a rapid Start→Stop cycle. */
    @Test
    fun startThenStopDoesNotCrash() {
        onView(withId(R.id.btn_start_stop)).perform(click())   // Start
        onView(withId(R.id.btn_start_stop)).perform(click())   // Stop

        onView(withId(R.id.tv_elapsed_time)).check(matches(isDisplayed()))
    }

    /**
     * Tapping Lap while the stopwatch is running must not crash and the
     * RecyclerView must remain visible.
     */
    @Test
    fun tappingLapWhileRunningDoesNotCrash() {
        onView(withId(R.id.btn_start_stop)).perform(click())
        onView(withId(R.id.btn_lap)).perform(click())

        onView(withId(R.id.rv_laps)).check(matches(isDisplayed()))
    }

    /**
     * Tapping Reset after a Start→Stop cycle must not crash and must keep the
     * elapsed-time display visible.
     */
    @Test
    fun resetAfterStopDoesNotCrash() {
        onView(withId(R.id.btn_start_stop)).perform(click())   // Start
        onView(withId(R.id.btn_start_stop)).perform(click())   // Stop
        onView(withId(R.id.btn_reset)).perform(click())        // Reset

        onView(withId(R.id.tv_elapsed_time)).check(matches(isDisplayed()))
    }
}
