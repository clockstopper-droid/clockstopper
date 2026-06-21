package com.clockstopper.app

import androidx.navigation.Navigation
import androidx.navigation.testing.TestNavHostController
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.matcher.ViewMatchers.*
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.MediumTest
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * NavigationSmokeTest — verifies that:
 *   1. The Jetpack Navigation graph inflates without error.
 *   2. The declared start destination is reached on launch.
 *   3. The NavController is findable from the Activity's view hierarchy.
 *
 * Run with:  ./gradlew connectedAndroidTest
 */
@RunWith(AndroidJUnit4::class)
@MediumTest
class NavigationSmokeTest {

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
    // NavController reachability
    // -----------------------------------------------------------------------

    /**
     * A NavController must be attached to the NavHostFragment container.
     */
    @Test
    fun navControllerIsAttachedToHost() {
        scenario.onActivity { activity ->
            val navHostView = activity.findViewById<android.view.View>(R.id.nav_host_fragment)
            val controller = Navigation.findNavController(navHostView)
            assert(controller != null) { "NavController must not be null" }
        }
    }

    /**
     * The NavController's current destination must not be null immediately
     * after launch.
     */
    @Test
    fun startDestinationIsReachedOnLaunch() {
        scenario.onActivity { activity ->
            val navHostView = activity.findViewById<android.view.View>(R.id.nav_host_fragment)
            val controller = Navigation.findNavController(navHostView)
            val currentDest = controller.currentDestination
            assert(currentDest != null) {
                "NavController.currentDestination must not be null after launch"
            }
        }
    }

    /**
     * The start destination ID resolved from the graph must match the actual
     * current destination.
     */
    @Test
    fun currentDestinationMatchesStartDestination() {
        scenario.onActivity { activity ->
            val navHostView = activity.findViewById<android.view.View>(R.id.nav_host_fragment)
            val controller = Navigation.findNavController(navHostView)
            val graph = controller.graph
            val startId = graph.startDestinationId
            val currentId = controller.currentDestination?.id

            assert(startId == currentId) {
                "Expected currentDestination (id=$currentId) to equal " +
                        "startDestination (id=$startId)"
            }
        }
    }

    // -----------------------------------------------------------------------
    // TestNavHostController — isolated graph inflation test
    // -----------------------------------------------------------------------

    /**
     * Inflates the navigation graph in isolation using [TestNavHostController].
     * Catches XML parse errors, missing destination IDs, or bad action references.
     */
    @Test
    fun navGraphInflatesWithoutError() {
        val testNavController = TestNavHostController(
            ApplicationProvider.getApplicationContext()
        )
        testNavController.setGraph(R.navigation.nav_graph)

        val startDest = testNavController.currentDestination
        assert(startDest != null) {
            "TestNavHostController.currentDestination should not be null after setGraph"
        }
    }
}
