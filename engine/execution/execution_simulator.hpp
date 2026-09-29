#pragma once

#include "../core/types.hpp"
#include "../orderbook/order_book.hpp"
#include "../queue/queue_tracker.hpp"
#include "../features/microstructure_engine.hpp"
#include "../adverse_selection/adverse_selection_engine.hpp"
#include "../latency/latency_model.hpp"
#include "../strategies/market_maker.hpp"
#include <vector>
#include <map>
#include <memory>
#include <iostream>
#include <cmath>
#include <sstream>

namespace liquidity_lens {

struct BacktestResult {
    std::string symbol{"BTC-USDT"};
    std::string strategy_name{"Avellaneda-Stoikov"};
    uint64_t total_events_processed{0};
    uint64_t total_orders_placed{0};
    uint64_t total_fills{0};
    double fill_rate_percent{0.0};
    
    // Economics breakdown in Basis Points (bps)
    double spread_captured_bps{0.0};
    double adverse_selection_bps{0.0}; // at 100ms markout
    double fees_paid_bps{0.0};
    double slippage_bps{0.0};
    double inventory_cost_bps{0.0};
    double net_pnl_bps{0.0};
    
    // Performance & Risk Metrics (Fixed-time 1-second interval resampled)
    double total_pnl_usd{0.0};
    double sharpe_ratio{0.0};
    double sortino_ratio{0.0};
    double max_drawdown_usd{0.0};
    double max_drawdown_percent{0.0};
    int64_t max_inventory_exposure{0};
    double avg_fill_time_ms{0.0};
    
    // Latency
    uint64_t latency_nominal_ns{0};
    
    // Markouts across horizons
    std::vector<MarkoutHorizonSummary> markout_horizons;
    
    // Time-series snapshots for charting
    struct PnlPoint {
        TimestampNs timestamp_ns;
        double pnl_usd;
        int64_t inventory;
        double mid_price;
    };
    std::vector<PnlPoint> pnl_series;
};

class ExecutionSimulator {
public:
    ExecutionSimulator(const LatencyProfile& latency_profile = LatencyProfile::preset_fast_direct(),
                       const MMParameters& mm_params = MMParameters())
        : book_("BTC-USDT", mm_params.tick_size),
          latency_sim_(latency_profile),
          feature_engine_(),
          adverse_engine_(),
          strategy_(mm_params),
          next_sim_order_id_(1000000000ULL) {}

    void set_latency_profile(const LatencyProfile& profile) {
        latency_sim_.set_profile(profile);
    }

    void set_strategy_parameters(const MMParameters& params) {
        strategy_.set_parameters(params);
        book_.set_tick_size(params.tick_size);
    }

    // Process single incoming market event in historical replay
    void process_event(const MarketEvent& event, double time_progress = 0.5) {
        // 1. Advance queue simulator state
        queue_tracker_.on_time_advance(event.timestamp_ns);

        // 2. Feature engine receives event
        feature_engine_.on_market_event(event, book_);

        // 3. If trade event, check fills against our active queue orders
        if (event.event_type == EventType::TRADE) {
            double current_mid_dec = book_.get_mid_price_decimal();
            auto fills = queue_tracker_.on_trade_event(event.side, event.price, event.quantity, event.timestamp_ns, current_mid_dec);
            
            for (const auto& fill : fills) {
                // Update strategy inventory and cash
                strategy_.on_fill(fill.side, fill.fill_price, fill.fill_quantity, strategy_.get_parameters().maker_fee_bps);
                
                // Track in adverse selection engine
                adverse_engine_.on_simulated_fill(fill);
                all_sim_fills_.push_back(fill);
            }
        }
        else if (event.event_type == EventType::CANCEL) {
            // Exact queue cancellation attribution by OrderId
            queue_tracker_.on_order_cancelled(event.order_id, event.price, event.side, event.quantity);
        }

        // 4. Update the order book with the market event
        book_.process_event(event);

        // 5. Adverse selection updates with newest mid-price
        double current_mid_dec = book_.get_mid_price_decimal();
        if (current_mid_dec > 0.0) {
            adverse_engine_.on_market_update(event.timestamp_ns, current_mid_dec);
        }

        // 6. Strategy Quoting Routine (Every N events or upon quote refresh)
        if (events_count_ % quote_interval_events_ == 0 && book_.has_bid() && book_.has_ask()) {
            evaluate_and_refresh_quotes(event.timestamp_ns, time_progress);
        }

        // 7. Track P&L curve periodically (at 1-second fixed time intervals or regular sample rate)
        if (events_count_ % pnl_sample_interval_ == 0 && current_mid_dec > 0.0) {
            record_pnl_point(event.timestamp_ns, current_mid_dec);
        }

        events_count_++;
        last_event_ts_ = event.timestamp_ns;
    }

    void evaluate_and_refresh_quotes(TimestampNs current_ts, double time_progress) {
        MicrostructureFeatures features = feature_engine_.compute_features(book_, current_ts);
        QuoteDecision decision = strategy_.compute_quotes(book_, features, time_progress);

        // Apply latency: when will our order arrive at the exchange?
        TimestampNs arrival_ts = latency_sim_.calculate_order_arrival_ts(current_ts);

        // If placing new Bid
        if (decision.place_bid && decision.bid_price > 0) {
            const auto* curr_bid = queue_tracker_.get_order(active_bid_id_);
            bool need_new_bid = (active_bid_id_ == 0 || curr_bid == nullptr || 
                                 curr_bid->state == QueueState::FILLED || curr_bid->state == QueueState::CANCELLED ||
                                 active_bid_price_ != decision.bid_price);

            if (need_new_bid) {
                OrderId new_bid_id = next_sim_order_id_++;
                int64_t ahead_vol = book_.get_queue_ahead(new_bid_id);
                if (ahead_vol < 0) {
                    auto it = book_.get_bids().find(decision.bid_price);
                    ahead_vol = (it != book_.get_bids().end()) ? it->second.get_total_quantity() : 0;
                }
                Quantity level_vol = ahead_vol + decision.bid_qty;

                // Extract exact order IDs sitting ahead at this price level
                std::vector<OrderId> ahead_order_ids = book_.get_level_order_ids(Side::BUY, decision.bid_price);

                queue_tracker_.register_order(new_bid_id, Side::BUY, decision.bid_price, decision.bid_qty,
                                              ahead_vol, level_vol, ahead_order_ids, current_ts, arrival_ts,
                                              strategy_.get_parameters().tick_size);
                active_bid_id_ = new_bid_id;
                active_bid_price_ = decision.bid_price;
                total_orders_placed_++;
            }
        }

        // If placing new Ask
        if (decision.place_ask && decision.ask_price > 0) {
            const auto* curr_ask = queue_tracker_.get_order(active_ask_id_);
            bool need_new_ask = (active_ask_id_ == 0 || curr_ask == nullptr || 
                                 curr_ask->state == QueueState::FILLED || curr_ask->state == QueueState::CANCELLED ||
                                 active_ask_price_ != decision.ask_price);

            if (need_new_ask) {
                OrderId new_ask_id = next_sim_order_id_++;
                int64_t ahead_vol = book_.get_queue_ahead(new_ask_id);
                if (ahead_vol < 0) {
                    auto it = book_.get_asks().find(decision.ask_price);
                    ahead_vol = (it != book_.get_asks().end()) ? it->second.get_total_quantity() : 0;
                }
                Quantity level_vol = ahead_vol + decision.ask_qty;

                // Extract exact order IDs sitting ahead at this price level
                std::vector<OrderId> ahead_order_ids = book_.get_level_order_ids(Side::SELL, decision.ask_price);

                queue_tracker_.register_order(new_ask_id, Side::SELL, decision.ask_price, decision.ask_qty,
                                              ahead_vol, level_vol, ahead_order_ids, current_ts, arrival_ts,
                                              strategy_.get_parameters().tick_size);
                active_ask_id_ = new_ask_id;
                active_ask_price_ = decision.ask_price;
                total_orders_placed_++;
            }
        }
    }

    void record_pnl_point(TimestampNs ts, double mid_dec) {
        double pnl = strategy_.get_total_pnl(mid_dec);
        pnl_history_.push_back({ts, pnl, strategy_.get_inventory(), mid_dec});
        if (std::abs(strategy_.get_inventory()) > max_inventory_seen_) {
            max_inventory_seen_ = std::abs(strategy_.get_inventory());
        }
    }

    // Finalize backtest and calculate institutional quantitative metrics
    BacktestResult finalize_backtest() {
        double final_mid_dec = book_.get_mid_price_decimal();
        if (final_mid_dec <= 0.0 && !pnl_history_.empty()) {
            final_mid_dec = pnl_history_.back().mid_price;
        }
        adverse_engine_.flush(last_event_ts_, final_mid_dec);

        BacktestResult res;
        res.symbol = book_.get_symbol();
        res.strategy_name = strategy_type_to_string(strategy_.get_parameters().type);
        res.total_events_processed = events_count_;
        res.total_orders_placed = total_orders_placed_;
        res.total_fills = all_sim_fills_.size();
        res.fill_rate_percent = total_orders_placed_ > 0 ? (static_cast<double>(res.total_fills) / total_orders_placed_) * 100.0 : 0.0;
        res.latency_nominal_ns = latency_sim_.get_profile().total_nominal_latency_ns();

        // Markouts
        res.markout_horizons = adverse_engine_.compute_horizon_summaries();
        
        // P&L & Drawdowns
        res.total_pnl_usd = strategy_.get_total_pnl(final_mid_dec);
        res.max_inventory_exposure = max_inventory_seen_;
        res.pnl_series = pnl_history_;

        // Calculate Drawdown & Resampled Sharpe
        calculate_pnl_statistics(res);

        // Economic BPS decomposition
        calculate_economic_breakdown(res);

        return res;
    }

    void reset() {
        book_.clear();
        queue_tracker_.clear();
        feature_engine_.reset();
        adverse_engine_.reset();
        strategy_.reset();
        pnl_history_.clear();
        all_sim_fills_.clear();
        events_count_ = 0;
        total_orders_placed_ = 0;
        active_bid_id_ = 0;
        active_ask_id_ = 0;
        active_bid_price_ = 0;
        active_ask_price_ = 0;
        max_inventory_seen_ = 0;
        last_event_ts_ = 0;
    }

    const LimitOrderBook& get_book() const { return book_; }
    const QueueTracker& get_queue_tracker() const { return queue_tracker_; }
    const MicrostructureEngine& get_feature_engine() const { return feature_engine_; }
    const AdverseSelectionEngine& get_adverse_engine() const { return adverse_engine_; }
    const MarketMakingStrategy& get_strategy() const { return strategy_; }
    const std::vector<SimulatedFill>& get_all_fills() const { return all_sim_fills_; }

private:
    void calculate_pnl_statistics(BacktestResult& res) {
        if (pnl_history_.size() < 2) return;

        double peak_pnl = -1e18;
        double max_dd = 0.0;

        for (size_t i = 0; i < pnl_history_.size(); ++i) {
            double pnl = pnl_history_[i].pnl_usd;
            if (pnl > peak_pnl) peak_pnl = pnl;
            double dd = peak_pnl - pnl;
            if (dd > max_dd) max_dd = dd;
        }

        res.max_drawdown_usd = max_dd;
        res.max_drawdown_percent = peak_pnl > 0.0 ? (max_dd / peak_pnl) * 100.0 : 0.0;

        // FIXED-TIME INTERVAL RESAMPLING (1-second intervals for rigorous Sharpe/Sortino)
        const uint64_t interval_ns = 1000000000ULL; // 1 second
        std::map<uint64_t, double> resampled_pnl; // bucket -> latest pnl

        for (const auto& pt : pnl_history_) {
            uint64_t bucket = pt.timestamp_ns / interval_ns;
            resampled_pnl[bucket] = pt.pnl_usd;
        }

        std::vector<double> resampled_diffs;
        double prev_pnl = 0.0;
        bool first = true;
        for (const auto& kv : resampled_pnl) {
            if (!first) {
                resampled_diffs.push_back(kv.second - prev_pnl);
            } else {
                first = false;
            }
            prev_pnl = kv.second;
        }

        if (resampled_diffs.size() > 1) {
            double mean = std::accumulate(resampled_diffs.begin(), resampled_diffs.end(), 0.0) / resampled_diffs.size();
            double var = 0.0;
            double down_var = 0.0;
            for (double r : resampled_diffs) {
                var += (r - mean) * (r - mean);
                if (r < 0.0) down_var += (r * r);
            }
            double stddev = std::sqrt(var / (resampled_diffs.size() - 1));
            double down_stddev = std::sqrt(down_var / (resampled_diffs.size() - 1));

            // Annualization factor: sqrt(252 trading days * 6.5 hours * 3600 seconds) = sqrt(5,896,800)
            double annual_factor = std::sqrt(252.0 * 6.5 * 3600.0);
            res.sharpe_ratio = stddev > 1e-9 ? (mean / stddev) * annual_factor : 0.0;
            res.sortino_ratio = down_stddev > 1e-9 ? (mean / down_stddev) * annual_factor : 0.0;
        }

        // Fill times
        double total_fill_time_ms = 0.0;
        for (const auto& f : all_sim_fills_) {
            if (f.fill_timestamp_ns >= f.order_placed_ts) {
                total_fill_time_ms += static_cast<double>(f.fill_timestamp_ns - f.order_placed_ts) / 1e6;
            }
        }
        res.avg_fill_time_ms = all_sim_fills_.empty() ? 0.0 : (total_fill_time_ms / all_sim_fills_.size());
    }

    void calculate_economic_breakdown(BacktestResult& res) {
        if (all_sim_fills_.empty()) return;

        double sum_spread_cap_bps = 0.0;
        for (const auto& f : all_sim_fills_) {
            sum_spread_cap_bps += f.spread_captured_bps;
        }
        res.spread_captured_bps = sum_spread_cap_bps / all_sim_fills_.size();

        // Adverse selection at 100ms horizon
        for (const auto& h : res.markout_horizons) {
            if (h.horizon_label == "100ms" || h.horizon_label == "50ms") {
                res.adverse_selection_bps = h.mean_adverse_loss_bps * h.adverse_probability;
                break;
            }
        }
        if (res.adverse_selection_bps == 0.0 && !res.markout_horizons.empty()) {
            res.adverse_selection_bps = res.markout_horizons[0].mean_adverse_loss_bps * res.markout_horizons[0].adverse_probability;
        }

        // Fees
        res.fees_paid_bps = strategy_.get_parameters().maker_fee_bps;

        // Slippage / Queue degradation
        res.slippage_bps = (static_cast<double>(res.latency_nominal_ns) / 1e9) * 20.0;

        // Inventory holding cost
        res.inventory_cost_bps = static_cast<double>(res.max_inventory_exposure) * 0.01;

        // Net PnL bps
        res.net_pnl_bps = res.spread_captured_bps - res.adverse_selection_bps - res.fees_paid_bps - res.slippage_bps - res.inventory_cost_bps;
    }

    LimitOrderBook book_;
    QueueTracker queue_tracker_;
    LatencySimulator latency_sim_;
    MicrostructureEngine feature_engine_;
    AdverseSelectionEngine adverse_engine_;
    MarketMakingStrategy strategy_;

    OrderId next_sim_order_id_{1000000000ULL};
    OrderId active_bid_id_{0};
    OrderId active_ask_id_{0};
    Price active_bid_price_{0};
    Price active_ask_price_{0};

    uint64_t events_count_{0};
    uint64_t total_orders_placed_{0};
    uint32_t quote_interval_events_{5};
    uint32_t pnl_sample_interval_{25};
    int64_t max_inventory_seen_{0};
    TimestampNs last_event_ts_{0};

    std::vector<SimulatedFill> all_sim_fills_;
    std::vector<BacktestResult::PnlPoint> pnl_history_;
};

} // namespace liquidity_lens
