package com.clockstopper.app

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.navigation.NavController
import androidx.navigation.fragment.NavHostFragment
import com.clockstopper.app.databinding.ActivityMainBinding

/**
 * Single-Activity host for the Clockstopper application.
 *
 * Responsibilities:
 *  - Inflate [ActivityMainBinding] which contains only the [NavHostFragment].
 *  - Expose the [NavController] for up-navigation (back-stack handling).
 *
 * All screen-level UI lives in Fragments managed by the Jetpack Navigation
 * component via [R.navigation.nav_graph].
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var navController: NavController

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Retrieve the NavController from the NavHostFragment declared in
        // activity_main.xml.  Using findNavController(R.id.nav_host_fragment)
        // on a FragmentContainerView requires going through the Fragment manager.
        val navHostFragment = supportFragmentManager
            .findFragmentById(R.id.nav_host_fragment) as NavHostFragment
        navController = navHostFragment.navController
    }

    /**
     * Delegate the system back-button to the NavController so the
     * navigation back-stack is handled correctly.
     */
    override fun onSupportNavigateUp(): Boolean =
        navController.navigateUp() || super.onSupportNavigateUp()
}
