package com.clockstopper.app

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.recyclerview.widget.LinearLayoutManager
import com.clockstopper.app.databinding.FragmentStopwatchBinding

/**
 * StopwatchFragment
 * ─────────────────
 * The primary (and sole) Fragment destination in the navigation graph.
 * Renders the stopwatch display, start/stop/lap/reset controls, and the
 * scrollable lap list.
 *
 * Architecture contract
 * ─────────────────────
 * - **No business logic** lives here; all operations are delegated to
 *   [StopwatchViewModel].
 * - The Fragment is purely reactive: it observes [LiveData] from the ViewModel
 *   and updates Views accordingly.
 * - Button click listeners translate user intent into ViewModel commands and
 *   nothing else.
 *
 * View binding
 * ────────────
 * Binding is inflated in [onCreateView] and released in [onDestroyView] to
 * avoid retaining a reference to Views beyond their valid lifecycle window.
 *
 * UI state mapping
 * ────────────────
 * | ViewModel LiveData      | View(s) updated                              |
 * |-------------------------|----------------------------------------------|
 * | elapsedTime             | tv_elapsed_time text                         |
 * | isRunning = true        | btn_start_stop text → "Stop"                 |
 * |                         | btn_lap enabled                              |
 * | isRunning = false       | btn_start_stop text → "Start"                |
 * |                         | btn_lap disabled                             |
 * | laps (non-empty list)   | rv_laps adapter updated via submitList()     |
 * | laps (empty list)       | rv_laps adapter cleared                      |
 */
class StopwatchFragment : Fragment() {

    // -----------------------------------------------------------------------
    // ViewModel
    // -----------------------------------------------------------------------

    private val viewModel: StopwatchViewModel by viewModels()

    // -----------------------------------------------------------------------
    // View binding
    // -----------------------------------------------------------------------

    private var _binding: FragmentStopwatchBinding? = null

    /** Non-null only between [onCreateView] and [onDestroyView]. */
    private val binding: FragmentStopwatchBinding
        get() = _binding!!

    // -----------------------------------------------------------------------
    // RecyclerView adapter
    // -----------------------------------------------------------------------

    private val lapAdapter = LapAdapter()

    // -----------------------------------------------------------------------
    // Fragment lifecycle
    // -----------------------------------------------------------------------

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
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
        // Detach the adapter before clearing the binding to avoid a potential
        // memory leak where the RecyclerView holds a reference to the adapter
        // which in turn holds a reference to old View references.
        binding.rvLaps.adapter = null
        _binding = null
    }

    // -----------------------------------------------------------------------
    // Setup helpers
    // -----------------------------------------------------------------------

    private fun setupRecyclerView() {
        binding.rvLaps.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = lapAdapter
            // Laps are prepended (newest first); a fixed size optimisation is
            // not appropriate here because the item count changes frequently.
            setHasFixedSize(false)
        }
    }

    private fun setupClickListeners() {
        binding.btnStartStop.setOnClickListener { viewModel.onStartStop() }
        binding.btnLap.setOnClickListener { viewModel.onLap() }
        binding.btnReset.setOnClickListener { viewModel.onReset() }
    }

    private fun observeViewModel() {
        // ── Elapsed time display ────────────────────────────────────────────
        viewModel.elapsedTime.observe(viewLifecycleOwner) { formattedTime ->
            binding.tvElapsedTime.text = formattedTime
        }

        // ── Running state → button labels + lap button enable/disable ───────
        viewModel.isRunning.observe(viewLifecycleOwner) { running ->
            binding.btnStartStop.setText(
                if (running) R.string.btn_stop else R.string.btn_start
            )
            binding.btnLap.isEnabled = running
        }

        // ── Lap list ────────────────────────────────────────────────────────
        viewModel.laps.observe(viewLifecycleOwner) { lapSummaries ->
            lapAdapter.submitList(lapSummaries)
        }
    }
}
