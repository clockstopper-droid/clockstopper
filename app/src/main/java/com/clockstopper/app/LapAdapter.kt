package com.clockstopper.app

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.clockstopper.app.databinding.ItemLapBinding
import com.clockstopper.app.domain.LapSummary

/**
 * LapAdapter
 * ──────────
 * [ListAdapter] that binds a list of [LapSummary] domain objects to rows in the
 * lap-list [RecyclerView] in [StopwatchFragment].
 *
 * Uses [DiffUtil] for efficient incremental updates: only newly added (or
 * changed) items trigger a partial rebind, keeping scrolling smooth even when
 * the list grows long.
 *
 * Layout
 * ──────
 * Each row is inflated from `item_lap.xml` and bound via [ItemLapBinding]
 * (ViewBinding).  The row shows:
 *   - Lap number          e.g. "Lap 3"
 *   - Split time          e.g. "00:12.34"
 *   - Cumulative time     e.g. "01:05.67"
 */
class LapAdapter : ListAdapter<LapSummary, LapAdapter.LapViewHolder>(DIFF_CALLBACK) {

    // -----------------------------------------------------------------------
    // ViewHolder
    // -----------------------------------------------------------------------

    inner class LapViewHolder(
        private val binding: ItemLapBinding,
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(summary: LapSummary) {
            binding.tvLapNumber.text =
                binding.root.context.getString(R.string.lap_number_label, summary.lapNumber)
            binding.tvLapSplit.text = summary.formattedSplit
            binding.tvLapCumulative.text = summary.formattedCumulative
        }
    }

    // -----------------------------------------------------------------------
    // Adapter overrides
    // -----------------------------------------------------------------------

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): LapViewHolder {
        val binding = ItemLapBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false,
        )
        return LapViewHolder(binding)
    }

    override fun onBindViewHolder(holder: LapViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    // -----------------------------------------------------------------------
    // DiffUtil callback
    // -----------------------------------------------------------------------

    companion object {
        private val DIFF_CALLBACK = object : DiffUtil.ItemCallback<LapSummary>() {
            override fun areItemsTheSame(oldItem: LapSummary, newItem: LapSummary): Boolean =
                oldItem.lapNumber == newItem.lapNumber

            override fun areContentsTheSame(oldItem: LapSummary, newItem: LapSummary): Boolean =
                oldItem == newItem
        }
    }
}
