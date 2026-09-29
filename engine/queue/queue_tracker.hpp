#pragma once

#include "../core/types.hpp"
#include <string>
#include <vector>
#include <unordered_map>
#include <unordered_set>
#include <memory>
#include <algorithm>
#include <cmath>

namespace liquidity_lens {

enum class QueueState : uint8_t {
    PENDING = 0,
    ACTIVE = 1,
    PARTIALLY_FILLED = 2,
    FILLED = 3,
    CANCELLED = 4
};

inline std::string queue_state_to_string(QueueState state) {
    switch (state) {
        case QueueState::PENDING: return "PENDING";
        case QueueState::ACTIVE: return "ACTIVE";
        case QueueState::PARTIALLY_FILLED: return "PARTIALLY_FILLED";
        case QueueState::FILLED: return "FILLED";
        case QueueState::CANCELLED: return "CANCELLED";
        default: return "UNKNOWN";
    }
}

struct TrackedQueueOrder {
    OrderId order_id{0};
    Side side{Side::UNKNOWN};
    Price price{0}; // in integer ticks
    double tick_size{0.01};
    Quantity original_quantity{0};
    Quantity remaining_quantity{0};
    Quantity filled_quantity{0};
    
    int64_t initial_queue_ahead{0};
    int64_t current_queue_ahead{0};
    Quantity initial_level_volume{0};
    
    // Exact set of market OrderIds that were sitting ahead of us at the time of placement
    std::unordered_set<OrderId> orders_ahead;
    
    TimestampNs placed_timestamp_ns{0};
    TimestampNs activated_timestamp_ns{0};
    TimestampNs fill_timestamp_ns{0};
    
    QueueState state{QueueState::PENDING};
    
    // Statistics for research
    Quantity ahead_volume_traded{0};
    Quantity ahead_volume_cancelled{0};
    Quantity behind_volume_added{0};
    Quantity behind_volume_cancelled{0};
    
    double initial_queue_percent() const {
        if (initial_level_volume == 0) return 0.0;
        return (static_cast<double>(initial_queue_ahead) / initial_level_volume) * 100.0;
    }
    
    double current_queue_percent() const {
        int64_t total = current_queue_ahead + remaining_quantity;
        if (total <= 0) return 0.0;
        return (static_cast<double>(current_queue_ahead) / total) * 100.0;
    }
    
    double fill_progress_percent() const {
        if (original_quantity == 0) return 0.0;
        return (static_cast<double>(filled_quantity) / original_quantity) * 100.0;
    }
    
    uint64_t time_in_queue_ns(TimestampNs current_time_ns) const {
        if (state == QueueState::FILLED || state == QueueState::CANCELLED) {
            return (fill_timestamp_ns >= activated_timestamp_ns) ? (fill_timestamp_ns - activated_timestamp_ns) : 0;
        }
        return (current_time_ns >= activated_timestamp_ns) ? (current_time_ns - activated_timestamp_ns) : 0;
    }
};

class QueueTracker {
public:
    QueueTracker() = default;

    // Register a new simulated order with exact order IDs ahead
    void register_order(OrderId order_id, Side side, Price price, Quantity qty, 
                        int64_t queue_ahead, Quantity level_vol,
                        const std::vector<OrderId>& ahead_order_ids,
                        TimestampNs placed_ts, TimestampNs active_ts,
                        double tick_size = 0.01) {
        TrackedQueueOrder ord;
        ord.order_id = order_id;
        ord.side = side;
        ord.price = price;
        ord.tick_size = tick_size;
        ord.original_quantity = qty;
        ord.remaining_quantity = qty;
        ord.filled_quantity = 0;
        ord.initial_queue_ahead = queue_ahead;
        ord.current_queue_ahead = queue_ahead;
        ord.initial_level_volume = level_vol;
        ord.orders_ahead = std::unordered_set<OrderId>(ahead_order_ids.begin(), ahead_order_ids.end());
        ord.placed_timestamp_ns = placed_ts;
        ord.activated_timestamp_ns = active_ts;
        ord.state = (active_ts <= placed_ts) ? QueueState::ACTIVE : QueueState::PENDING;

        orders_[order_id] = ord;
    }

    // Check activation for in-flight orders due to latency
    void on_time_advance(TimestampNs current_time_ns) {
        for (auto& kv : orders_) {
            auto& ord = kv.second;
            if (ord.state == QueueState::PENDING && current_time_ns >= ord.activated_timestamp_ns) {
                ord.state = QueueState::ACTIVE;
            }
        }
    }

    // Update queue position when a cancellation happens at the price level
    // Exact attribution: ONLY reduce queue ahead if cancelled_order_id was in orders_ahead
    void on_order_cancelled(OrderId cancelled_order_id, Price price, Side side, Quantity cancel_qty) {
        for (auto& kv : orders_) {
            auto& ord = kv.second;
            if (ord.state != QueueState::ACTIVE && ord.state != QueueState::PARTIALLY_FILLED) continue;
            if (ord.side == side && ord.price == price) {
                if (cancelled_order_id > 0 && ord.orders_ahead.find(cancelled_order_id) != ord.orders_ahead.end()) {
                    // Exact match: this cancelled order was in front of us!
                    int64_t reduction = std::min(ord.current_queue_ahead, static_cast<int64_t>(cancel_qty));
                    ord.current_queue_ahead -= reduction;
                    ord.ahead_volume_cancelled += reduction;
                    ord.orders_ahead.erase(cancelled_order_id);
                } else if (cancelled_order_id > 0) {
                    // This order was BEHIND us in the queue or at another level. Queue ahead is unaffected!
                    ord.behind_volume_cancelled += cancel_qty;
                } else {
                    // Fallback for feeds without individual order IDs: conservative proportional or no deduction
                    ord.behind_volume_cancelled += cancel_qty;
                }
            }
        }
    }

    // Update queue position when an aggressive trade occurs
    // Returns any fills generated for our simulated orders
    std::vector<SimulatedFill> on_trade_event(Side aggressor_side, Price trade_price, Quantity trade_qty, 
                                             TimestampNs trade_ts, double current_mid_decimal) {
        std::vector<SimulatedFill> fills;

        for (auto& kv : orders_) {
            auto& ord = kv.second;
            if (ord.state != QueueState::ACTIVE && ord.state != QueueState::PARTIALLY_FILLED) continue;

            // Aggressive BUY hits ASK orders; Aggressive SELL hits BID orders
            bool matches_side = (aggressor_side == Side::BUY && ord.side == Side::SELL) ||
                                (aggressor_side == Side::SELL && ord.side == Side::BUY);

            if (!matches_side) continue;

            // Price condition: aggressive buy matches ask if trade_price >= ord.price; aggressive sell matches bid if trade_price <= ord.price
            bool price_matched = (ord.side == Side::BUY && (trade_price == 0 || trade_price <= ord.price)) ||
                                 (ord.side == Side::SELL && (trade_price == 0 || trade_price >= ord.price));

            if (!price_matched) continue;

            // The aggressive trade first eats volume ahead of us
            if (ord.current_queue_ahead > 0) {
                int64_t eaten_ahead = std::min(ord.current_queue_ahead, static_cast<int64_t>(trade_qty));
                ord.current_queue_ahead -= eaten_ahead;
                ord.ahead_volume_traded += eaten_ahead;
                int64_t remaining_trade = trade_qty - eaten_ahead;

                if (remaining_trade > 0) {
                    // Trades into our order
                    Quantity fill_qty = std::min(ord.remaining_quantity, static_cast<Quantity>(remaining_trade));
                    ord.filled_quantity += fill_qty;
                    ord.remaining_quantity -= fill_qty;

                    SimulatedFill fill;
                    fill.order_id = ord.order_id;
                    fill.side = ord.side;
                    fill.fill_price = ord.price;
                    fill.fill_price_decimal = ticks_to_double(ord.price, ord.tick_size);
                    fill.fill_quantity = fill_qty;
                    fill.fill_timestamp_ns = trade_ts;
                    fill.order_placed_ts = ord.placed_timestamp_ns;
                    fill.latency_applied_ns = (ord.activated_timestamp_ns >= ord.placed_timestamp_ns) ? (ord.activated_timestamp_ns - ord.placed_timestamp_ns) : 0;
                    fill.is_maker = true;
                    fill.mid_at_fill_decimal = current_mid_decimal;
                    
                    // Spread captured relative to mid at fill
                    if (current_mid_decimal > 0.0) {
                        double order_p_dec = ticks_to_double(ord.price, ord.tick_size);
                        if (ord.side == Side::BUY) {
                            fill.spread_captured_bps = ((current_mid_decimal - order_p_dec) / current_mid_decimal) * 10000.0;
                        } else {
                            fill.spread_captured_bps = ((order_p_dec - current_mid_decimal) / current_mid_decimal) * 10000.0;
                        }
                    }
                    fills.push_back(fill);

                    if (ord.remaining_quantity == 0) {
                        ord.state = QueueState::FILLED;
                        ord.fill_timestamp_ns = trade_ts;
                    } else {
                        ord.state = QueueState::PARTIALLY_FILLED;
                    }
                }
            } else {
                // Queue ahead is 0! Direct fill
                Quantity fill_qty = std::min(ord.remaining_quantity, trade_qty);
                ord.filled_quantity += fill_qty;
                ord.remaining_quantity -= fill_qty;

                SimulatedFill fill;
                fill.order_id = ord.order_id;
                fill.side = ord.side;
                fill.fill_price = ord.price;
                fill.fill_price_decimal = ticks_to_double(ord.price, ord.tick_size);
                fill.fill_quantity = fill_qty;
                fill.fill_timestamp_ns = trade_ts;
                fill.order_placed_ts = ord.placed_timestamp_ns;
                fill.latency_applied_ns = (ord.activated_timestamp_ns >= ord.placed_timestamp_ns) ? (ord.activated_timestamp_ns - ord.placed_timestamp_ns) : 0;
                fill.is_maker = true;
                fill.mid_at_fill_decimal = current_mid_decimal;

                if (current_mid_decimal > 0.0) {
                    double order_p_dec = ticks_to_double(ord.price, ord.tick_size);
                    if (ord.side == Side::BUY) {
                        fill.spread_captured_bps = ((current_mid_decimal - order_p_dec) / current_mid_decimal) * 10000.0;
                    } else {
                        fill.spread_captured_bps = ((order_p_dec - current_mid_decimal) / current_mid_decimal) * 10000.0;
                    }
                }
                fills.push_back(fill);

                if (ord.remaining_quantity == 0) {
                    ord.state = QueueState::FILLED;
                    ord.fill_timestamp_ns = trade_ts;
                } else {
                    ord.state = QueueState::PARTIALLY_FILLED;
                }
            }
        }

        return fills;
    }

    const TrackedQueueOrder* get_order(OrderId id) const {
        auto it = orders_.find(id);
        if (it != orders_.end()) return &(it->second);
        return nullptr;
    }

    const std::unordered_map<OrderId, TrackedQueueOrder>& get_all_orders() const {
        return orders_;
    }

    void clear() {
        orders_.clear();
    }

private:
    std::unordered_map<OrderId, TrackedQueueOrder> orders_;
};

} // namespace liquidity_lens
