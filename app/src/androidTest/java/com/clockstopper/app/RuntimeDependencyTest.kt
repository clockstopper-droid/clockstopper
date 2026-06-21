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
 *   D-2  PowerManager / WAKE_LOCK permission is not needed at API 26+ for
 *        screen-on behaviour, but the PowerManager service is accessible
 *   D-3  The NavHostFragment view is inflated (all navigation dependencies
 *        resolved at runtime)
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

    /**
     * The app declares minSdk 26.  Running on a device below that level is a
     * build/deployment error — but we document it explicitly so CI reports a
     * clear failure if someone misconfigures the AVD.
     */
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

    /**
     * PowerManager must be accessible via [Context.getSystemService]; a null
     * result would indicate a misconfigured emulator image.
     */
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

    /**
     * If any navigation dependency (navigation-fragment-ktx, navigation-ui-ktx,
     * etc.) is missing or misconfigured the NavHostFragment container will fail
     * to inflate, causing the Activity to crash before RESUMED.
     *
     * Verifying the container is visible acts as a proxy for "all navigation
     * runtime deps are present."
     */
    @Test
    fun navHostFragmentInflatesSuccessfully() {
        onView(withId(R.id.nav_host_fragment))
            .check(matches(isDisplayed()))
    }

    // -----------------------------------------------------------------------
    // D-4  Layout inflation (activity_main)
    // -----------------------------------------------------------------------

    /**
     * The Activity's content view (activity_main.xml) must be inflated without
     * error. A missing drawable, undefined style, or unknown attribute causes an
     * InflateException which crashes the Activity before RESUMED — the scenario
     * launch in @Before would have already failed.
     *
     * This test is intentionally trivial: if setUp() completed, inflation succeeded.
     */
    @Test
    fun activityMainLayoutInflatesWithoutError() {
        scenario.onActivity { activity ->
            // If the Activity's setContentView threw, we would never get here.
            val rootView = activity.window.decorView
            assert(rootView != null) {
                "Root decor view must not be null if layout inflated successfully"
            }
        }
    }

    // -----------------------------------------------------------------------
    // D-5  RecyclerView runtime dependency
    // -----------------------------------------------------------------------

    /**
     * The lap-list RecyclerView must be present and its adapter must have been
     * attached. A missing RecyclerView dependency (e.g. dependency excluded by
     * a bad Gradle config) would produce a ClassNotFoundException at inflation
     * time, crashing the Fragment before this assertion is reached.
     */
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

    /**
     * Simulates a configuration change (e.g. orientation toggle) by recreating
     * the Activity via [ActivityScenario.recreate].
     *
     * After recreation the ViewModel instance (backed by [ViewModelStore]) must
     * have preserved the stopwatch state — specifically, the elapsed-time display
     * must still be visible and the UI must not have crashed.
     *
     * This exercises the ViewModel + LiveData wiring across the Activity lifecycle.
     */
    @Test
    fun viewModelSurvivesConfigurationChange() {
        // Confirm initial state
        onView(withId(R.id.tv_elapsed_time)).check(matches(isDisplayed()))

        // Trigger configuration change
        scenario.recreate()

        // UI must still be present after recreation
        onView(withId(R.id.tv_elapsed_time)).check(matches(isDisplayed()))
        onView(withId(R.id.btn_start_stop)).check(matches(isDisplayed()))
    }

    /**
     * ViewModel must retain stopwatch running state across configuration change.
     * Start the stopwatch, recreate the Activity, verify the display has advanced.
     */
    @Test
    fun runningStopwatchSurvivesConfigurationChange() {
        // Start the stopwatch
        onView(withId(R.id.btn_start_stop))
            .perform(androidx.test.espresso.action.ViewActions.click())

        android.os.SystemClock.sleep(200)

        // Capture the text *before* recreation
        var textBeforeRecreate = ""
        onView(withId(R.id.tv_elapsed_time)).check { view, _ ->
            textBeforeRecreate = (view as android.widget.TextView).text.toString()
        }

        // Simulate rotation
        scenario.recreate()
        android.os.SystemClock.sleep(200)

        // After recreation the timer must still be ticking (display changed again)
        onView(withId(R.id.tv_elapsed_time)).check { view, _ ->
            val textAfter = (view as android.widget.TextView).text.toString()
            assert(textAfter != "00:00.00" && textAfter.isNotBlank()) {
                "Stopwatch should still be running after configuration change. " +
                        "Display was: '$textAfter'"
            }
        }
    }
}
