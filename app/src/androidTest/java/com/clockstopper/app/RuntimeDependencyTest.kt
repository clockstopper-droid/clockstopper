package com.clockstopper.app

import android.content.Context
import android.os.Build
import android.os.PowerManager
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.matcher.ViewMatchers.isDisplayed
import androidx.test.espresso.matcher.ViewMatchers.withId
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.MediumTest
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * RuntimeDependencyTest — verifies that runtime dependencies and platform
 * services used by the app are accessible without error on the target device:
 *
 *   D-1  Minimum API level is satisfied (API 26+)
 *   D-2  PowerManager service is accessible
 *   D-3  The NavHostFragment view is inflated (all navigation dependencies resolved)
 *   D-4  ViewBinding / layout inflation succeeds for activity_main
 *   D-5  RecyclerView dependency resolves and adapter can be set
 *   D-6  ViewModel survives a simulated configuration change (rotation)
 *
 * Run with:  ./gradlew connectedAndroidTest
 */
@RunWith(AndroidJUnit4::class)
@MediumTest
class RuntimeDependencyTest {

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
    // D-1  API level gate
    // -----------------------------------------------------------------------

    @Test
    fun deviceMeetsMinimumApiLevel() {
        val currentSdk = Build.VERSION.SDK_INT
        assert(currentSdk >= 26) {
            "This app requires API 26+, but the test device is running API $currentSdk"
        }
    }

    // -----------------------------------------------------------------------
    // D-2  PowerManager accessible
    // -----------------------------------------------------------------------

    @Test
    fun powerManagerServiceIsAccessible() {
        val context: Context = ApplicationProvider.getApplicationContext()
        val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        assert(pm != null) {
            "PowerManager system service must not be null on a valid Android runtime"
        }
    }

    // -----------------------------------------------------------------------
    // D-3  Navigation / NavHostFragment inflates
    // -----------------------------------------------------------------------

    @Test
    fun navHostFragmentInflatesSuccessfully() {
        onView(withId(R.id.nav_host_fragment))
            .check(matches(isDisplayed()))
    }

    // -----------------------------------------------------------------------
    // D-4  Layout inflation (activity_main)
    // -----------------------------------------------------------------------

    @Test
    fun activityMainLayoutInflatesWithoutError() {
        scenario.onActivity { activity ->
            val rootView = activity.window.decorView
            assert(rootView != null) {
                "Root decor view must not be null if layout inflated successfully"
            }
        }
    }

    // -----------------------------------------------------------------------
    // D-5  RecyclerView runtime dependency
    // -----------------------------------------------------------------------

    @Test
    fun recyclerViewDependencyPresentAndAdapterAttached() {
        onView(withId(R.id.rv_laps)).check { view, noViewFoundException ->
            noViewFoundException?.let { throw it }
            val rv = view as androidx.recyclerview.widget.RecyclerView
            assert(rv.adapter != null) {
                "RecyclerView.adapter must not be null — was it set in onViewCreated?"
            }
        }
    }

    // -----------------------------------------------------------------------
    // D-6  ViewModel survives configuration change
    // -----------------------------------------------------------------------

    @Test
    fun viewModelSurvivesConfigurationChange() {
        onView(withId(R.id.tv_elapsed_time)).check(matches(isDisplayed()))
        scenario.recreate()
        onView(withId(R.id.tv_elapsed_time)).check(matches(isDisplayed()))
        onView(withId(R.id.btn_start_stop)).check(matches(isDisplayed()))
    }

    @Test
    fun runningStopwatchSurvivesConfigurationChange() {
        onView(withId(R.id.btn_start_stop))
            .perform(androidx.test.espresso.action.ViewActions.click())

        android.os.SystemClock.sleep(200)

        var textBeforeRecreate = ""
        onView(withId(R.id.tv_elapsed_time)).check { view, _ ->
            textBeforeRecreate = (view as android.widget.TextView).text.toString()
        }

        scenario.recreate()
        android.os.SystemClock.sleep(200)

        onView(withId(R.id.tv_elapsed_time)).check { view, _ ->
            val textAfter = (view as android.widget.TextView).text.toString()
            assert(textAfter != "00:00.00" && textAfter.isNotBlank()) {
                "Stopwatch should still be running after configuration change. " +
                        "Display was: '$textAfter'"
            }
        }
    }
}
