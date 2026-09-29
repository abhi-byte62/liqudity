#pragma once

#include "../core/types.hpp"
#include "../orderbook/order_book.hpp"
#include "../features/microstructure_engine.hpp"
#include <string>
#include <vector>
#include <cmath>
#include <algorithm>

namespace liquidity_lens {

enum class StrategyType : uint8_t {
    SYMMETRIC_ADAPTIVE = 1,
    AVELLANEDA_STOIKOV = 2,
    HAWKES_SKEWED = 3
};

inline std::string strategy_type_to_string(StrategyType type) {
    switch (type) {
        case StrategyType::SYMMETRIC_ADAPTIVE: return "Symmetric Adaptive MM";
        case StrategyType::AVELLANEDA_STOIKOV: return "Avellaneda-Stoikov Inventory MM";
        case StrategyType::HAWKES_SKEWED: return "Hawkes OBI-Skewed MM";
        default: return "Unknown";
    }
}

struct QuoteDecision {
    bool place_bid{false};
    bool place_ask{false};
    Price bid_price{0}; // in integer ticks
    Price ask_price{0}; // in integer ticks
    double bid_price_decimal{0.0};
    double ask_price_decimal{0.0};
    Quantity bid_qty{0};
    Quantity ask_qty{0};
    double reservation_price_decimal{0.0};
    double spread_bps{0.0};
};

struct MMParameters {
    StrategyType type{StrategyType::AVELLANEDA_STOIKOV};
    Quantity default_quote_size{10};
    int64_t max_inventory{100};
    double gamma_risk_aversion{0.1};   // Risk aversion parameter gamma
    double kappa_order_intensity{1.5}; // Order arrival intensity kappa
    double terminal_time_horizon{1.0}; // T in normalized time
    double tick_size{0.01};
    double maker_fee_bps{-0.2};        // Rebate or fee (negative = maker rebate)
    double taker_fee_bps{1.0};
    double inventory_penalty_bps{0.05};
};

class MarketMakingStrategy {
public:
    MarketMakingStrategy(const MMParameters& params = MMParameters())
        : params_(params), inventory_(0), cash_(0.0), realized_pnl_(0.0) {}

    void set_parameters(const MMParameters& params) { params_ = params; }
    const MMParameters& get_parameters() const { return params_; }

    int64_t get_inventory() const { return inventory_; }
    double get_cash() const { return cash_; }
    double get_realized_pnl() const { return realized_pnl_; }

    double get_unrealized_pnl(double current_mid_decimal) const {
        return static_cast<double>(inventory_) * current_mid_decimal;
    }

    double get_total_pnl(double current_mid_decimal) const {
        return cash_ + get_unrealized_pnl(current_mid_decimal);
    }

    // Update on fill
    void on_fill(Side side, Price price_ticks, Quantity qty, double fee_bps = 0.0) {
        double price_decimal = ticks_to_double(price_ticks, params_.tick_size);
        double notional = price_decimal * static_cast<double>(qty);
        double fee_cost = notional * (fee_bps / 10000.0);

        if (side == Side::BUY) {
            inventory_ += static_cast<int64_t>(qty);
            cash_ -= notional + fee_cost;
        } else if (side == Side::SELL) {
            inventory_ -= static_cast<int64_t>(qty);
            cash_ += notional - fee_cost;
        }

        total_volume_traded_ += qty;
        fill_count_++;
    }

    // Generate quotes based strictly on information available at current time t (No look-ahead!)
    QuoteDecision compute_quotes(const LimitOrderBook& book, const MicrostructureFeatures& features, double time_progress = 0.5) {
        QuoteDecision q;
        if (!book.has_bid() || !book.has_ask()) return q;

        Price best_bid = book.get_best_bid();
        Price best_ask = book.get_best_ask();
        double best_bid_dec = book.get_best_bid_decimal();
        double best_ask_dec = book.get_best_ask_decimal();
        double mid_dec = book.get_mid_price_decimal();
        double sigma = std::max(0.001, features.realized_volatility / 10000.0); // Daily/unit volatility
        double ts = params_.tick_size;

        if (params_.type == StrategyType::SYMMETRIC_ADAPTIVE) {
            // Symmetric adaptive: quotes at/inside touch
            q.bid_price = best_bid;
            q.ask_price = best_ask;
            q.reservation_price_decimal = mid_dec;
            q.place_bid = (inventory_ < params_.max_inventory);
            q.place_ask = (inventory_ > -params_.max_inventory);
            q.bid_qty = params_.default_quote_size;
            q.ask_qty = params_.default_quote_size;
        }
        else if (params_.type == StrategyType::AVELLANEDA_STOIKOV) {
            // Avellaneda-Stoikov reservation price & optimal spread
            double T_minus_t = std::max(0.01, params_.terminal_time_horizon * (1.0 - time_progress));
            double q_inv = static_cast<double>(inventory_);
            double gamma = params_.gamma_risk_aversion;
            double kappa = params_.kappa_order_intensity;

            // Reservation price: r(s, q, t) = s - q * gamma * sigma^2 * (T - t)
            double reservation_price = mid_dec - (q_inv * gamma * (sigma * sigma) * T_minus_t * mid_dec * 0.01);
            q.reservation_price_decimal = reservation_price;

            // Optimal half-spread: delta = (1/gamma) * ln(1 + gamma/kappa) scaled to tick size
            double raw_delta = (1.0 / std::max(0.01, gamma)) * std::log(1.0 + (gamma / std::max(0.1, kappa)));
            double delta_dec = std::max(ts, std::min(5.0 * ts, raw_delta * ts));

            // Asymmetric bid/ask distances
            double skew_adjustment = (q_inv * gamma * ts * 0.2);
            double delta_bid = delta_dec + skew_adjustment;
            double delta_ask = delta_dec - skew_adjustment;

            double target_bid_dec = std::min(best_bid_dec, reservation_price - delta_bid);
            if (target_bid_dec < best_bid_dec - 3 * ts) {
                target_bid_dec = best_bid_dec;
            }

            double target_ask_dec = std::max(best_ask_dec, reservation_price + delta_ask);
            if (target_ask_dec > best_ask_dec + 3 * ts) {
                target_ask_dec = best_ask_dec;
            }

            q.bid_price = double_to_ticks(target_bid_dec, ts);
            q.ask_price = double_to_ticks(target_ask_dec, ts);

            q.place_bid = (inventory_ < params_.max_inventory && q.bid_price > 0);
            q.place_ask = (inventory_ > -params_.max_inventory && q.ask_price > q.bid_price);
            q.bid_qty = params_.default_quote_size;
            q.ask_qty = params_.default_quote_size;
        }
        else if (params_.type == StrategyType::HAWKES_SKEWED) {
            // Hawkes & OBI-aware Skewing:
            // When OBI > 0 (strong buy pressure), skew quotes upward
            double obi = features.top_obi;
            double skew_shift_dec = obi * ts * 2.0;

            q.reservation_price_decimal = mid_dec + skew_shift_dec;
            double target_bid_dec = best_bid_dec + skew_shift_dec * 0.5;
            double target_ask_dec = best_ask_dec + skew_shift_dec * 0.5;

            q.bid_price = double_to_ticks(target_bid_dec, ts);
            q.ask_price = double_to_ticks(target_ask_dec, ts);

            if (q.ask_price <= q.bid_price) {
                q.ask_price = q.bid_price + 1; // At least 1 tick higher
            }

            q.place_bid = (inventory_ < params_.max_inventory);
            q.place_ask = (inventory_ > -params_.max_inventory);
            q.bid_qty = params_.default_quote_size;
            q.ask_qty = params_.default_quote_size;
        }

        q.bid_price_decimal = ticks_to_double(q.bid_price, ts);
        q.ask_price_decimal = ticks_to_double(q.ask_price, ts);

        if (q.ask_price > q.bid_price && q.bid_price > 0 && mid_dec > 0.0) {
            q.spread_bps = ((q.ask_price_decimal - q.bid_price_decimal) / mid_dec) * 10000.0;
        }

        return q;
    }

    void reset() {
        inventory_ = 0;
        cash_ = 0.0;
        realized_pnl_ = 0.0;
        total_volume_traded_ = 0;
        fill_count_ = 0;
    }

    uint64_t get_fill_count() const { return fill_count_; }
    uint64_t get_total_volume_traded() const { return total_volume_traded_; }

private:
    MMParameters params_;
    int64_t inventory_{0};
    double cash_{0.0};
    double realized_pnl_{0.0};
    uint64_t total_volume_traded_{0};
    uint64_t fill_count_{0};
};

} // namespace liquidity_lens
