package com.clockstopper.app

import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith

/**
 * Instrumented test placeholder – runs on a connected Android device or emulator.
 * Run with:  ./gradlew connectedAndroidTest
 */
@RunWith(AndroidJUnit4::class)
class ExampleInstrumentedTest {
    @Test
    fun useAppContext() {
        val appContext = InstrumentationRegistry.getInstrumentation().targetContext
        // The base package name is the same across all build variants; only the
        // applicationIdSuffix differs (e.g. ".debug" in debug builds).
        assertTrue(
            "Expected package to start with com.clockstopper.app, was: ${appContext.packageName}",
            appContext.packageName.startsWith("com.clockstopper.app"),
        )
    }
}
