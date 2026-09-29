#pragma once

#include "../core/types.hpp"
#include "../orderbook/order_book.hpp"
#include <deque>
#include <vector>
#include <cmath>
#include <numeric>
#include <algorithm>

namespace liquidity_lens {

struct MicrostructureFeatures {
    TimestampNs timestamp_ns{0};
    Price best_bid{0};
    Price best_ask{0};
    double best_bid_decimal{0.0};
    double best_ask_decimal{0.0};
    double mid_price_decimal{0.0};
    double spread_decimal{0.0};
    double spread_bps{0.0};
    double micro_price_decimal{0.0};
    double top_obi{0.0};
    double depth_5_obi{0.0};
    double depth_10_obi{0.0};
    double depth_20_obi{0.0};
    
    double trade_flow_imbalance{0.0}; // Aggressive buy vs sell volume over window
    double order_arrival_rate{0.0};   // Events per second
    double cancel_rate{0.0};          // Cancelled / Added volume ratio
    double realized_volatility{0.0};  // Short-term annualized/bps volatility
    double hawkes_intensity{0.0};     // Real-time Hawkes clustering intensity
};

class MicrostructureEngine {
public:
    struct Config {
        uint64_t window_ns{1000000000ULL}; // 1-second rolling window
        double hawkes_mu{10.0};              // Baseline arrival rate
        double hawkes_alpha{0.8};           // Excitation jump
        double hawkes_beta{5.0};            // Decay rate
    };

    MicrostructureEngine()
        : config_(), hawkes_intensity_(10.0), last_event_ts_(0) {}

    explicit MicrostructureEngine(const Config& config)
        : config_(config), hawkes_intensity_(config.hawkes_mu), last_event_ts_(0) {}

    void on_market_event(const MarketEvent& event, const LimitOrderBook& book) {
        decay_hawkes(event.timestamp_ns);

        // Update statistics
        recent_events_.push_back({event.timestamp_ns, event.event_type, event.side, event.quantity, event.price});
        
        if (event.event_type == EventType::ADD) {
            total_added_volume_window_ += event.quantity;
            hawkes_intensity_ += config_.hawkes_alpha;
        } else if (event.event_type == EventType::CANCEL) {
            total_cancelled_volume_window_ += event.quantity;
            hawkes_intensity_ += config_.hawkes_alpha * 0.5;
        } else if (event.event_type == EventType::TRADE) {
            if (event.side == Side::BUY) {
                aggressive_buy_vol_window_ += event.quantity;
            } else if (event.side == Side::SELL) {
                aggressive_sell_vol_window_ += event.quantity;
            }
            hawkes_intensity_ += config_.hawkes_alpha * 1.5;
        }

        // Mid-price history for volatility
        double mid = book.get_mid_price_decimal();
        if (mid > 0.0) {
            if (price_history_.empty() || std::abs(price_history_.back().second - mid) > 1e-7) {
                price_history_.push_back({event.timestamp_ns, mid});
            }
        }

        // Purge old events from rolling window
        prune_window(event.timestamp_ns);

        last_event_ts_ = event.timestamp_ns;
    }

    MicrostructureFeatures compute_features(const LimitOrderBook& book, TimestampNs current_time_ns) {
        prune_window(current_time_ns);
        decay_hawkes(current_time_ns);

        MicrostructureFeatures f;
        f.timestamp_ns = current_time_ns;
        f.best_bid = book.get_best_bid();
        f.best_ask = book.get_best_ask();
        f.best_bid_decimal = book.get_best_bid_decimal();
        f.best_ask_decimal = book.get_best_ask_decimal();
        f.mid_price_decimal = book.get_mid_price_decimal();
        f.spread_decimal = book.get_spread_decimal();
        f.spread_bps = book.get_spread_bps();
        f.micro_price_decimal = book.get_micro_price_decimal();
        f.top_obi = book.get_top_obi();
        f.depth_5_obi = book.get_depth_obi(5);
        f.depth_10_obi = book.get_depth_obi(10);
        f.depth_20_obi = book.get_depth_obi(20);

        // Trade flow imbalance: (BuyVol - SellVol) / (BuyVol + SellVol)
        uint64_t total_trade_vol = aggressive_buy_vol_window_ + aggressive_sell_vol_window_;
        if (total_trade_vol > 0) {
            f.trade_flow_imbalance = static_cast<double>(static_cast<int64_t>(aggressive_buy_vol_window_) - 
                                                         static_cast<int64_t>(aggressive_sell_vol_window_)) / total_trade_vol;
        } else {
            f.trade_flow_imbalance = 0.0;
        }

        // Order arrival rate (events / sec)
        double window_sec = static_cast<double>(config_.window_ns) / 1e9;
        f.order_arrival_rate = recent_events_.size() / window_sec;

        // Cancel rate
        if (total_added_volume_window_ > 0) {
            f.cancel_rate = static_cast<double>(total_cancelled_volume_window_) / total_added_volume_window_;
        } else {
            f.cancel_rate = 0.0;
        }

        // Short-term realized volatility (log-returns stddev in bps)
        f.realized_volatility = calculate_realized_volatility();
        f.hawkes_intensity = hawkes_intensity_;

        return f;
    }

    void reset() {
        recent_events_.clear();
        price_history_.clear();
        total_added_volume_window_ = 0;
        total_cancelled_volume_window_ = 0;
        aggressive_buy_vol_window_ = 0;
        aggressive_sell_vol_window_ = 0;
        hawkes_intensity_ = config_.hawkes_mu;
        last_event_ts_ = 0;
    }

private:
    struct WindowEvent {
        TimestampNs ts;
        EventType type;
        Side side;
        Quantity qty;
        Price price;
    };

    void decay_hawkes(TimestampNs current_ts) {
        if (last_event_ts_ > 0 && current_ts > last_event_ts_) {
            double dt = static_cast<double>(current_ts - last_event_ts_) / 1e9;
            hawkes_intensity_ = config_.hawkes_mu + (hawkes_intensity_ - config_.hawkes_mu) * std::exp(-config_.hawkes_beta * dt);
        }
    }

    void prune_window(TimestampNs current_ts) {
        TimestampNs cutoff = (current_ts > config_.window_ns) ? (current_ts - config_.window_ns) : 0;

        while (!recent_events_.empty() && recent_events_.front().ts < cutoff) {
            const auto& ev = recent_events_.front();
            if (ev.type == EventType::ADD) {
                total_added_volume_window_ = (total_added_volume_window_ >= ev.qty) ? (total_added_volume_window_ - ev.qty) : 0;
            } else if (ev.type == EventType::CANCEL) {
                total_cancelled_volume_window_ = (total_cancelled_volume_window_ >= ev.qty) ? (total_cancelled_volume_window_ - ev.qty) : 0;
            } else if (ev.type == EventType::TRADE) {
                if (ev.side == Side::BUY) {
                    aggressive_buy_vol_window_ = (aggressive_buy_vol_window_ >= ev.qty) ? (aggressive_buy_vol_window_ - ev.qty) : 0;
                } else if (ev.side == Side::SELL) {
                    aggressive_sell_vol_window_ = (aggressive_sell_vol_window_ >= ev.qty) ? (aggressive_sell_vol_window_ - ev.qty) : 0;
                }
            }
            recent_events_.pop_front();
        }

        while (!price_history_.empty() && price_history_.front().first < cutoff) {
            price_history_.pop_front();
        }
    }

    double calculate_realized_volatility() const {
        if (price_history_.size() < 3) return 0.0;

        std::vector<double> log_returns;
        log_returns.reserve(price_history_.size() - 1);

        for (size_t i = 1; i < price_history_.size(); ++i) {
            double p0 = price_history_[i-1].second;
            double p1 = price_history_[i].second;
            if (p0 > 0.0 && p1 > 0.0) {
                log_returns.push_back(std::log(p1 / p0));
            }
        }

        if (log_returns.size() < 2) return 0.0;

        double mean = std::accumulate(log_returns.begin(), log_returns.end(), 0.0) / log_returns.size();
        double var = 0.0;
        for (double r : log_returns) {
            var += (r - mean) * (r - mean);
        }
        var /= (log_returns.size() - 1);

        // Convert standard deviation to basis points
        return std::sqrt(var) * 10000.0;
    }

    Config config_;
    std::deque<WindowEvent> recent_events_;
    std::deque<std::pair<TimestampNs, double>> price_history_;

    uint64_t total_added_volume_window_{0};
    uint64_t total_cancelled_volume_window_{0};
    uint64_t aggressive_buy_vol_window_{0};
    uint64_t aggressive_sell_vol_window_{0};

    double hawkes_intensity_{10.0};
    TimestampNs last_event_ts_{0};
};

} // namespace liquidity_lens
