#pragma once

#include "../core/types.hpp"
#include <vector>
#include <map>
#include <numeric>
#include <cmath>
#include <iostream>
#include <algorithm>

namespace liquidity_lens {

struct MarkoutHorizonSummary {
    uint64_t horizon_ns{0};
    std::string horizon_label{"1ms"};
    size_t total_fills_evaluated{0};
    size_t adverse_fills_count{0};
    double adverse_probability{0.0};       // P(Delta Mid moves against maker)
    double mean_markout_bps{0.0};          // Average price move in maker's perspective (positive = favorable, negative = adverse)
    double mean_adverse_loss_bps{0.0};     // Average loss on adverse fills
    double median_markout_bps{0.0};
};

struct PendingFillEvaluation {
    SimulatedFill fill;
    std::map<uint64_t, double> horizon_mids; // horizon_ns -> mid at t0 + horizon (decimal)
    bool completed{false};
};

class AdverseSelectionEngine {
public:
    AdverseSelectionEngine() {
        // Default horizons: 1ms, 5ms, 10ms, 50ms, 100ms, 500ms, 1000ms
        horizons_ = {
            {1000000ULL, "1ms"},
            {5000000ULL, "5ms"},
            {10000000ULL, "10ms"},
            {50000000ULL, "50ms"},
            {100000000ULL, "100ms"},
            {500000000ULL, "500ms"},
            {1000000000ULL, "1000ms"}
        };
    }

    void on_simulated_fill(const SimulatedFill& fill) {
        PendingFillEvaluation pending;
        pending.fill = fill;
        pending.completed = false;
        pending_fills_.push_back(pending);
    }

    // Called on every market price update to populate post-fill markouts
    void on_market_update(TimestampNs current_ts, double current_mid_decimal) {
        if (current_mid_decimal <= 0.0) return;

        for (auto& pf : pending_fills_) {
            if (pf.completed) continue;

            // Strict look-ahead check: current event must be strictly after the fill
            if (current_ts < pf.fill.fill_timestamp_ns) continue;

            uint64_t elapsed_ns = current_ts - pf.fill.fill_timestamp_ns;
            for (const auto& h : horizons_) {
                if (elapsed_ns >= h.first && pf.horizon_mids.find(h.first) == pf.horizon_mids.end()) {
                    pf.horizon_mids[h.first] = current_mid_decimal;
                }
            }

            // If largest horizon reached, finalize evaluation
            if (pf.horizon_mids.size() == horizons_.size() || elapsed_ns > horizons_.back().first) {
                pf.completed = true;
                completed_fills_.push_back(pf);
            }
        }

        // Clean up completed from pending list
        pending_fills_.erase(
            std::remove_if(pending_fills_.begin(), pending_fills_.end(), [](const PendingFillEvaluation& p) { return p.completed; }),
            pending_fills_.end()
        );
    }

    // Force finalize any remaining fills at end of dataset with latest mid
    void flush(TimestampNs final_ts, double final_mid_decimal) {
        (void)final_ts;
        for (auto& pf : pending_fills_) {
            for (const auto& h : horizons_) {
                if (pf.horizon_mids.find(h.first) == pf.horizon_mids.end()) {
                    pf.horizon_mids[h.first] = final_mid_decimal;
                }
            }
            pf.completed = true;
            completed_fills_.push_back(pf);
        }
        pending_fills_.clear();
    }

    // Compute Markout summary across all horizons
    std::vector<MarkoutHorizonSummary> compute_horizon_summaries() const {
        std::vector<MarkoutHorizonSummary> results;

        for (const auto& h : horizons_) {
            uint64_t h_ns = h.first;
            MarkoutHorizonSummary summary;
            summary.horizon_ns = h_ns;
            summary.horizon_label = h.second;

            std::vector<double> markouts;
            size_t adverse_count = 0;
            double adverse_sum = 0.0;

            for (const auto& pf : completed_fills_) {
                auto it = pf.horizon_mids.find(h_ns);
                if (it == pf.horizon_mids.end()) continue;

                double post_mid = it->second;
                double fill_mid = pf.fill.mid_at_fill_decimal;
                if (fill_mid <= 0.0 || post_mid <= 0.0) continue;

                // Markout from liquidity provider perspective (positive = favorable, negative = adverse)
                // Maker BUY at Bid: Price drop (post_mid < fill_mid) is adverse
                // Maker SELL at Ask: Price rise (post_mid > fill_mid) is adverse
                double markout_bps = 0.0;
                if (pf.fill.side == Side::BUY) {
                    markout_bps = ((post_mid - fill_mid) / fill_mid) * 10000.0;
                } else if (pf.fill.side == Side::SELL) {
                    markout_bps = ((fill_mid - post_mid) / fill_mid) * 10000.0;
                }

                markouts.push_back(markout_bps);
                if (markout_bps < 0.0) {
                    adverse_count++;
                    adverse_sum += -markout_bps; // Magnitude of loss
                }
            }

            summary.total_fills_evaluated = markouts.size();
            summary.adverse_fills_count = adverse_count;
            if (!markouts.empty()) {
                summary.adverse_probability = static_cast<double>(adverse_count) / markouts.size();
                summary.mean_markout_bps = std::accumulate(markouts.begin(), markouts.end(), 0.0) / markouts.size();
                summary.mean_adverse_loss_bps = adverse_count > 0 ? (adverse_sum / adverse_count) : 0.0;
                
                std::vector<double> sorted = markouts;
                std::sort(sorted.begin(), sorted.end());
                summary.median_markout_bps = sorted[sorted.size() / 2];
            }

            results.push_back(summary);
        }

        return results;
    }

    const std::vector<PendingFillEvaluation>& get_completed_fills() const {
        return completed_fills_;
    }

    void reset() {
        pending_fills_.clear();
        completed_fills_.clear();
    }

private:
    std::vector<std::pair<uint64_t, std::string>> horizons_;
    std::vector<PendingFillEvaluation> pending_fills_;
    std::vector<PendingFillEvaluation> completed_fills_;
};

} // namespace liquidity_lens
