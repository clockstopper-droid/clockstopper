package com.clockstopper.app

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.recyclerview.widget.LinearLayoutManager
import com.clockstopper.app.databinding.FragmentStopwatchBinding
import com.clockstopper.app.domain.StopwatchState

/**
 * Primary stopwatch screen.
 *
 * Observes [StopwatchViewModel] LiveData and drives the UI:
 *  - Elapsed-time text view
 *  - Current-lap label (visible only while running or paused)
 *  - Lap history RecyclerView (via [LapAdapter])
 *  - Start/Stop, Lap, and Reset buttons (enabled/disabled per state)
 *
 * Business logic lives entirely in the ViewModel and domain layer;
 * this Fragment only handles view binding and user-event delegation.
 */
class StopwatchFragment : Fragment() {

    // ── View binding ─────────────────────────────────────────────────────────

    private var _binding: FragmentStopwatchBinding? = null
    /** Non-null between [onCreateView] and [onDestroyView]. */
    private val binding get() = _binding!!

    // ── ViewModel ────────────────────────────────────────────────────────────

    private val viewModel: StopwatchViewModel by viewModels()

    // ── RecyclerView adapter ─────────────────────────────────────────────────

    private val lapAdapter = LapAdapter()

    // ── Fragment lifecycle ────────────────────────────────────────────────────

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentStopwatchBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupRecyclerView()
        setupClickListeners()
        observeViewModel()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        // Avoid memory leaks by nulling the binding reference.
        _binding = null
    }

    // ── Setup helpers ─────────────────────────────────────────────────────────

    private fun setupRecyclerView() {
        binding.rvLaps.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter        = lapAdapter
            // Disable item animator to prevent flicker on frequent updates.
            itemAnimator   = null
            setHasFixedSize(false)
        }
    }

    private fun setupClickListeners() {
        binding.btnStartStop.setOnClickListener { viewModel.onStartStop() }
        binding.btnLap.setOnClickListener       { viewModel.onLap() }
        binding.btnReset.setOnClickListener     { viewModel.onReset() }
    }

    private fun observeViewModel() {
        // Elapsed time display
        viewModel.elapsedTime.observe(viewLifecycleOwner) { time ->
            binding.tvElapsedTime.text = time
        }

        // Current-lap label (null → hide; non-null → show)
        viewModel.currentLapLabel.observe(viewLifecycleOwner) { label ->
            binding.tvCurrentLap.isVisible = (label != null)
            binding.tvCurrentLap.text      = label ?: ""
        }

        // Lap list
        viewModel.laps.observe(viewLifecycleOwner) { rankedLaps ->
            lapAdapter.submitList(rankedLaps)
        }

        // Button states driven by stopwatch lifecycle state
        viewModel.state.observe(viewLifecycleOwner) { state ->
            updateButtonStates(state)
        }
    }

    // ── UI state helpers ──────────────────────────────────────────────────────

    /**
     * Adjusts button labels and enabled-states to match the current
     * [StopwatchState], mirroring the behaviour of the web-app JavaScript UI.
     *
     * | State   | Start/Stop label | Lap enabled | Reset enabled |
     * |---------|-----------------|-------------|---------------|
     * | IDLE    | Start           | false       | false         |
     * | RUNNING | Stop            | true        | false         |
     * | PAUSED  | Start           | false       | true          |
     */
    private fun updateButtonStates(state: StopwatchState) {
        when (state) {
            StopwatchState.IDLE -> {
                binding.btnStartStop.setText(R.string.btn_start)
                binding.btnStartStop.contentDescription = getString(R.string.cd_btn_start)
                binding.btnLap.isEnabled   = false
                binding.btnReset.isEnabled = false
            }
            StopwatchState.RUNNING -> {
                binding.btnStartStop.setText(R.string.btn_stop)
                binding.btnStartStop.contentDescription = getString(R.string.cd_btn_stop)
                binding.btnLap.isEnabled   = true
                binding.btnReset.isEnabled = false
            }
            StopwatchState.PAUSED -> {
                binding.btnStartStop.setText(R.string.btn_start)
                binding.btnStartStop.contentDescription = getString(R.string.cd_btn_resume)
                binding.btnLap.isEnabled   = false
                binding.btnReset.isEnabled = true
            }
        }
    }
}
