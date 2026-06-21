package com.clockstopper.app

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.clockstopper.app.databinding.ActivityMainBinding

/**
 * Entry-point Activity for the Clockstopper application.
 *
 * Responsibilities
 * ────────────────
 * • Inflate [R.layout.activity_main] via View Binding and set it as the
 *   content view.
 * • Host the single [FragmentContainerView] that holds all Fragment
 *   destinations for the app.
 *
 * This Activity intentionally stays thin: all business logic lives in
 * ViewModels and domain objects; all UI belongs in the hosted Fragments.
 */
class MainActivity : AppCompatActivity() {

    // View Binding reference — valid from onCreate() until the Activity is
    // destroyed (cleared on destroy, not on stop/pause).
    private lateinit var binding: ActivityMainBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Inflate the layout and hand the root view to the system.
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
    }
}
