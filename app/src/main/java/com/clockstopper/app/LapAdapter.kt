package com.clockstopper.app

import android.content.res.ColorStateList
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.clockstopper.app.databinding.ItemLapBinding
import com.clockstopper.app.domain.LapAnalyzer
import com.clockstopper.app.domain.LapSummary
import com.clockstopper.app.domain.TimeFormatter
import com.google.android.material.color.MaterialColors

/**
 * RecyclerView adapter that displays the lap history list.
 *
 * Each row shows:
 *  - Lap number label ("Lap N")
 *  - Lap split formatted as MM:SS.mmm
 *  - Cumulative elapsed time formatted as MM:SS.mmm
 *
 * The fastest lap split is coloured with [colorPrimary]; the slowest with
 * [colorError]; all other laps use the default [colorOnSurface].
 *
 * Uses [ListAdapter] + [DiffUtil] for efficient, animated list updates.
 */
class LapAdapter : ListAdapter<Pair<LapSummary, LapAnalyzer.Rank>, LapAdapter.LapViewHolder>(DIFF) {

    // ── ViewHolder ───────────────────────────────────────────────────────────

    inner class LapViewHolder(
        private val binding: ItemLapBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(item: Pair<LapSummary, LapAnalyzer.Rank>) {
            val (lap, rank) = item

            binding.tvLapNumber.text = itemView.context.getString(
                R.string.lap_number_template,
                lap.lapNumber
            )
            binding.tvLapSplit.text      = TimeFormatter.formatSplit(lap.splitMs)
            binding.tvLapCumulative.text = TimeFormatter.formatSplit(lap.cumulativeMs)

            // Highlight best/worst laps using theme-aware colours.
            val splitColour = when (rank) {
                LapAnalyzer.Rank.BEST   -> MaterialColors.getColor(
                    itemView, com.google.android.material.R.attr.colorPrimary
                )
                LapAnalyzer.Rank.WORST  -> MaterialColors.getColor(
                    itemView, com.google.android.material.R.attr.colorError
                )
                LapAnalyzer.Rank.NORMAL -> MaterialColors.getColor(
                    itemView, com.google.android.material.R.attr.colorOnSurface
                )
            }
            binding.tvLapSplit.setTextColor(splitColour)
            binding.tvLapNumber.setTextColor(
                // Tint the lap label to match the split colour for best/worst.
                if (rank == LapAnalyzer.Rank.NORMAL)
                    MaterialColors.getColor(itemView, com.google.android.material.R.attr.colorOnSurface)
                else splitColour
            )
        }
    }

    // ── Adapter overrides ────────────────────────────────────────────────────

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): LapViewHolder {
        val binding = ItemLapBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return LapViewHolder(binding)
    }

    override fun onBindViewHolder(holder: LapViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    // ── DiffUtil ─────────────────────────────────────────────────────────────

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<Pair<LapSummary, LapAnalyzer.Rank>>() {
            override fun areItemsTheSame(
                old: Pair<LapSummary, LapAnalyzer.Rank>,
                new: Pair<LapSummary, LapAnalyzer.Rank>
            ) = old.first.lapNumber == new.first.lapNumber

            override fun areContentsTheSame(
                old: Pair<LapSummary, LapAnalyzer.Rank>,
                new: Pair<LapSummary, LapAnalyzer.Rank>
            ) = old == new
        }
    }
}
