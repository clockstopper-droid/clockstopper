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
 * AppLaunchTest for the clockstopper-droid WebView variant.
 *
 * Verifies that MainActivity launches without crash and that the WebView
 * container is visible.
 *
 * Run with:  ./gradlew connectedAndroidTest
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

    @Test
    fun activityLaunchesWithoutCrash() {
        scenario.onActivity { activity ->
            assert(activity != null) { "MainActivity should not be null" }
        }
    }

    @Test
    fun navHostFragmentContainerIsDisplayed() {
        onView(withId(R.id.nav_host_fragment))
            .check(matches(isDisplayed()))
    }
}
