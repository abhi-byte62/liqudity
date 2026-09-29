#pragma once

#include "price_level.hpp"
#include <map>
#include <functional>
#include <unordered_map>
#include <vector>
#include <string>
#include <limits>
#include <stdexcept>
#include <cmath>

namespace liquidity_lens {

class LimitOrderBook {
public:
    LimitOrderBook(const std::string& symbol = "BTC-USDT", double tick_size = 0.01)
        : symbol_(symbol), tick_size_(tick_size) {}

    double get_tick_size() const { return tick_size_; }
    void set_tick_size(double ts) { if (ts > 0.0) tick_size_ = ts; }

    // Process a single market event
    bool process_event(const MarketEvent& event) {
        last_timestamp_ns_ = event.timestamp_ns;

        switch (event.event_type) {
            case EventType::ADD:
                return add_order(event.order_id, event.side, event.price, event.quantity, event.timestamp_ns);
            case EventType::CANCEL:
                return cancel_order(event.order_id, event.quantity);
            case EventType::MODIFY:
                return modify_order(event.order_id, event.quantity);
            case EventType::TRADE:
                return process_trade(event.side, event.price, event.quantity);
            case EventType::SNAPSHOT:
                return true;
        }
        return false;
    }

    bool add_order(OrderId order_id, Side side, Price price, Quantity quantity, TimestampNs ts) {
        if (quantity == 0 || price <= 0) return false;
        if (side != Side::BUY && side != Side::SELL) return false;

        // Register in order index
        order_location_[order_id] = {side, price};

        Order order(order_id, side, price, quantity, ts);
        if (side == Side::BUY) {
            auto it = bids_.find(price);
            if (it == bids_.end()) {
                bids_.emplace(std::piecewise_construct,
                              std::forward_as_tuple(price),
                              std::forward_as_tuple(price, tick_size_));
            }
            bids_[price].add_order(order);
        } else if (side == Side::SELL) {
            auto it = asks_.find(price);
            if (it == asks_.end()) {
                asks_.emplace(std::piecewise_construct,
                              std::forward_as_tuple(price),
                              std::forward_as_tuple(price, tick_size_));
            }
            asks_[price].add_order(order);
        }

        total_orders_processed_++;
        return true;
    }

    bool cancel_order(OrderId order_id, Quantity cancel_qty = 0) {
        auto it = order_location_.find(order_id);
        if (it == order_location_.end()) {
            return false;
        }

        Side side = it->second.first;
        Price price = it->second.second;

        bool success = false;
        if (side == Side::BUY) {
            auto level_it = bids_.find(price);
            if (level_it != bids_.end()) {
                success = level_it->second.cancel_order(order_id, cancel_qty);
                if (level_it->second.empty()) {
                    bids_.erase(level_it);
                }
            }
        } else if (side == Side::SELL) {
            auto level_it = asks_.find(price);
            if (level_it != asks_.end()) {
                success = level_it->second.cancel_order(order_id, cancel_qty);
                if (level_it->second.empty()) {
                    asks_.erase(level_it);
                }
            }
        }

        if (cancel_qty == 0 || success) {
            order_location_.erase(it);
        }

        total_cancels_processed_++;
        return success;
    }

    bool modify_order(OrderId order_id, Quantity new_qty) {
        auto it = order_location_.find(order_id);
        if (it == order_location_.end()) return false;

        Side side = it->second.first;
        Price price = it->second.second;

        if (new_qty == 0) {
            return cancel_order(order_id, 0);
        }

        if (side == Side::BUY) {
            auto level_it = bids_.find(price);
            if (level_it != bids_.end()) {
                return level_it->second.modify_order(order_id, new_qty);
            }
        } else if (side == Side::SELL) {
            auto level_it = asks_.find(price);
            if (level_it != asks_.end()) {
                return level_it->second.modify_order(order_id, new_qty);
            }
        }
        return false;
    }

    // Process aggressive trade hitting the book
    bool process_trade(Side aggressor_side, Price trade_price, Quantity trade_qty) {
        Quantity remaining = trade_qty;
        std::vector<std::pair<OrderId, Quantity>> fills;

        if (aggressor_side == Side::BUY) {
            // Aggressive buyer matches against Ask book (lowest ask first)
            while (remaining > 0 && !asks_.empty()) {
                auto ask_it = asks_.begin();
                if (trade_price > 0 && ask_it->first > trade_price) {
                    break; // Price limit reached
                }
                remaining = ask_it->second.match_trade(remaining, fills);
                if (ask_it->second.empty()) {
                    asks_.erase(ask_it);
                }
            }
        } else if (aggressor_side == Side::SELL) {
            // Aggressive seller matches against Bid book (highest bid first)
            while (remaining > 0 && !bids_.empty()) {
                auto bid_it = bids_.begin();
                if (trade_price > 0 && bid_it->first < trade_price) {
                    break; // Price limit reached
                }
                remaining = bid_it->second.match_trade(remaining, fills);
                if (bid_it->second.empty()) {
                    bids_.erase(bid_it);
                }
            }
        }

        // Clean up filled order index
        for (const auto& fill : fills) {
            auto it = order_location_.find(fill.first);
            if (it != order_location_.end()) {
                order_location_.erase(it);
            }
        }

        total_trades_processed_++;
        return true;
    }

    // Best quotes
    bool has_bid() const { return !bids_.empty(); }
    bool has_ask() const { return !asks_.empty(); }

    Price get_best_bid() const {
        return bids_.empty() ? 0 : bids_.begin()->first;
    }

    Price get_best_ask() const {
        return asks_.empty() ? 0 : asks_.begin()->first;
    }

    double get_best_bid_decimal() const {
        return ticks_to_double(get_best_bid(), tick_size_);
    }

    double get_best_ask_decimal() const {
        return ticks_to_double(get_best_ask(), tick_size_);
    }

    Quantity get_best_bid_qty() const {
        return bids_.empty() ? 0 : bids_.begin()->second.get_total_quantity();
    }

    Quantity get_best_ask_qty() const {
        return asks_.empty() ? 0 : asks_.begin()->second.get_total_quantity();
    }

    Price get_spread_ticks() const {
        if (!has_bid() || !has_ask()) return 0;
        return get_best_ask() - get_best_bid();
    }

    double get_spread_decimal() const {
        return ticks_to_double(get_spread_ticks(), tick_size_);
    }

    double get_mid_price_decimal() const {
        if (!has_bid() || !has_ask()) return 0.0;
        return (get_best_bid_decimal() + get_best_ask_decimal()) * 0.5;
    }

    double get_spread_bps() const {
        double mid = get_mid_price_decimal();
        if (mid <= 0.0) return 0.0;
        return (get_spread_decimal() / mid) * 10000.0;
    }

    // Micro-price weighted by top level volumes:
    // P_micro = (Q_bid * P_ask + Q_ask * P_bid) / (Q_bid + Q_ask)
    double get_micro_price_decimal() const {
        if (!has_bid() || !has_ask()) return 0.0;
        Quantity q_b = get_best_bid_qty();
        Quantity q_a = get_best_ask_qty();
        if (q_b + q_a == 0) return get_mid_price_decimal();
        return (static_cast<double>(q_b) * get_best_ask_decimal() + static_cast<double>(q_a) * get_best_bid_decimal()) / (q_b + q_a);
    }

    // Order Book Imbalance (OBI) on Top Level: (Q_bid - Q_ask) / (Q_bid + Q_ask)
    double get_top_obi() const {
        Quantity q_b = get_best_bid_qty();
        Quantity q_a = get_best_ask_qty();
        if (q_b + q_a == 0) return 0.0;
        return static_cast<double>(static_cast<int64_t>(q_b) - static_cast<int64_t>(q_a)) / (q_b + q_a);
    }

    // Depth Imbalance across N levels
    double get_depth_obi(size_t depth_levels) const {
        Quantity total_b = 0;
        Quantity total_a = 0;

        size_t count = 0;
        for (auto it = bids_.begin(); it != bids_.end() && count < depth_levels; ++it, ++count) {
            total_b += it->second.get_total_quantity();
        }

        count = 0;
        for (auto it = asks_.begin(); it != asks_.end() && count < depth_levels; ++it, ++count) {
            total_a += it->second.get_total_quantity();
        }

        if (total_b + total_a == 0) return 0.0;
        return static_cast<double>(static_cast<int64_t>(total_b) - static_cast<int64_t>(total_a)) / (total_b + total_a);
    }

    // Get order IDs currently sitting at a level (for exact queue tracking)
    std::vector<OrderId> get_level_order_ids(Side side, Price price) const {
        if (side == Side::BUY) {
            auto it = bids_.find(price);
            if (it != bids_.end()) return it->second.get_current_order_ids();
        } else if (side == Side::SELL) {
            auto it = asks_.find(price);
            if (it != asks_.end()) return it->second.get_current_order_ids();
        }
        return {};
    }

    // Queue volume ahead for a specific simulated order
    int64_t get_queue_ahead(OrderId order_id) const {
        auto it = order_location_.find(order_id);
        if (it == order_location_.end()) return -1;

        Side side = it->second.first;
        Price price = it->second.second;

        if (side == Side::BUY) {
            auto level_it = bids_.find(price);
            if (level_it != bids_.end()) {
                return level_it->second.get_queue_ahead(order_id);
            }
        } else if (side == Side::SELL) {
            auto level_it = asks_.find(price);
            if (level_it != asks_.end()) {
                return level_it->second.get_queue_ahead(order_id);
            }
        }
        return -1;
    }

    // Get L2 depth snapshot
    L2Snapshot get_snapshot(size_t max_levels = 20) const {
        L2Snapshot snap;
        snap.timestamp_ns = last_timestamp_ns_;
        snap.best_bid = get_best_bid();
        snap.best_ask = get_best_ask();
        snap.best_bid_decimal = get_best_bid_decimal();
        snap.best_ask_decimal = get_best_ask_decimal();
        snap.mid_price_decimal = get_mid_price_decimal();
        snap.spread_decimal = get_spread_decimal();
        snap.spread_bps = get_spread_bps();
        snap.micro_price_decimal = get_micro_price_decimal();
        snap.obi = get_top_obi();

        size_t count = 0;
        for (auto it = bids_.begin(); it != bids_.end() && count < max_levels; ++it, ++count) {
            snap.bids.push_back(it->second.get_level_info());
        }

        count = 0;
        for (auto it = asks_.begin(); it != asks_.end() && count < max_levels; ++it, ++count) {
            snap.asks.push_back(it->second.get_level_info());
        }

        return snap;
    }

    // Check invariants (total level quantity == sum of orders, uncrossed book)
    bool validate_invariants() const {
        if (has_bid() && has_ask()) {
            if (get_best_bid() >= get_best_ask()) {
                return false; // Crossed book
            }
        }

        for (const auto& kv : bids_) {
            Quantity sum = 0;
            for (const auto& ord : kv.second.get_orders()) {
                sum += ord.quantity;
            }
            if (sum != kv.second.get_total_quantity()) return false;
        }

        for (const auto& kv : asks_) {
            Quantity sum = 0;
            for (const auto& ord : kv.second.get_orders()) {
                sum += ord.quantity;
            }
            if (sum != kv.second.get_total_quantity()) return false;
        }

        return true;
    }

    void clear() {
        bids_.clear();
        asks_.clear();
        order_location_.clear();
        total_orders_processed_ = 0;
        total_cancels_processed_ = 0;
        total_trades_processed_ = 0;
    }

    TimestampNs get_last_timestamp_ns() const { return last_timestamp_ns_; }
    const std::string& get_symbol() const { return symbol_; }

    size_t get_bid_level_count() const { return bids_.size(); }
    size_t get_ask_level_count() const { return asks_.size(); }
    size_t get_total_active_orders() const { return order_location_.size(); }

    const std::map<Price, PriceLevel, std::greater<Price>>& get_bids() const { return bids_; }
    const std::map<Price, PriceLevel, std::less<Price>>& get_asks() const { return asks_; }

private:
    std::string symbol_{"BTC-USDT"};
    double tick_size_{0.01};
    TimestampNs last_timestamp_ns_{0};

    // Bids descending (highest integer tick price first)
    std::map<Price, PriceLevel, std::greater<Price>> bids_;

    // Asks ascending (lowest integer tick price first)
    std::map<Price, PriceLevel, std::less<Price>> asks_;

    // Fast order index: OrderId -> (Side, Price in ticks)
    std::unordered_map<OrderId, std::pair<Side, Price>> order_location_;

    uint64_t total_orders_processed_{0};
    uint64_t total_cancels_processed_{0};
    uint64_t total_trades_processed_{0};
};

} // namespace liquidity_lens
