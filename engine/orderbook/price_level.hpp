#pragma once

#include "../core/types.hpp"
#include <list>
#include <unordered_map>
#include <vector>
#include <algorithm>
#include <memory>

namespace liquidity_lens {

class PriceLevel {
public:
    explicit PriceLevel(Price price = 0, double tick_size = 0.01)
        : price_(price), tick_size_(tick_size), total_quantity_(0) {}

    Price get_price() const { return price_; }
    double get_price_decimal() const { return ticks_to_double(price_, tick_size_); }
    Quantity get_total_quantity() const { return total_quantity_; }
    size_t get_order_count() const { return orders_.size(); }
    bool empty() const { return orders_.empty(); }

    // Add order to tail (FIFO)
    void add_order(const Order& order) {
        orders_.push_back(order);
        auto it = --orders_.end();
        order_map_[order.order_id] = it;
        total_quantity_ += order.quantity;
    }

    // Cancel / remove order by order_id
    bool cancel_order(OrderId order_id, Quantity cancel_qty = 0) {
        auto it = order_map_.find(order_id);
        if (it == order_map_.end()) {
            return false;
        }

        auto list_it = it->second;
        if (cancel_qty == 0 || cancel_qty >= list_it->quantity) {
            // Full cancel
            total_quantity_ -= list_it->quantity;
            orders_.erase(list_it);
            order_map_.erase(it);
        } else {
            // Partial cancel
            list_it->quantity -= cancel_qty;
            total_quantity_ -= cancel_qty;
        }
        return true;
    }

    // Modify order quantity
    bool modify_order(OrderId order_id, Quantity new_qty) {
        auto it = order_map_.find(order_id);
        if (it == order_map_.end()) return false;

        auto list_it = it->second;
        if (new_qty <= list_it->quantity) {
            // Size reduction maintains queue priority in standard exchange rules
            total_quantity_ = total_quantity_ - list_it->quantity + new_qty;
            list_it->quantity = new_qty;
            if (new_qty == 0) {
                orders_.erase(list_it);
                order_map_.erase(it);
            }
        } else {
            // Size increase loses priority, moved to end of queue
            Order updated = *list_it;
            updated.quantity = new_qty;
            total_quantity_ -= list_it->quantity;
            orders_.erase(list_it);
            order_map_.erase(it);
            add_order(updated);
        }
        return true;
    }

    // Match incoming aggressive trade against queue (FIFO head-first)
    // Returns remaining unmatched trade quantity
    Quantity match_trade(Quantity trade_qty, std::vector<std::pair<OrderId, Quantity>>& fills) {
        Quantity remaining = trade_qty;

        while (remaining > 0 && !orders_.empty()) {
            auto& head_order = orders_.front();
            if (head_order.quantity <= remaining) {
                fills.emplace_back(head_order.order_id, head_order.quantity);
                remaining -= head_order.quantity;
                total_quantity_ -= head_order.quantity;
                order_map_.erase(head_order.order_id);
                orders_.pop_front();
            } else {
                fills.emplace_back(head_order.order_id, remaining);
                head_order.quantity -= remaining;
                total_quantity_ -= remaining;
                remaining = 0;
            }
        }

        return remaining;
    }

    // Calculate queue volume ahead of a specific order
    int64_t get_queue_ahead(OrderId order_id) const {
        auto it = order_map_.find(order_id);
        if (it == order_map_.end()) return -1;

        int64_t ahead_volume = 0;
        for (const auto& ord : orders_) {
            if (ord.order_id == order_id) {
                break;
            }
            ahead_volume += ord.quantity;
        }
        return ahead_volume;
    }

    // Get all order IDs currently in queue ahead of a newly arriving order (or all current order IDs)
    std::vector<OrderId> get_current_order_ids() const {
        std::vector<OrderId> ids;
        ids.reserve(orders_.size());
        for (const auto& ord : orders_) {
            ids.push_back(ord.order_id);
        }
        return ids;
    }

    // Total depth info
    LevelInfo get_level_info() const {
        LevelInfo info;
        info.price = price_;
        info.price_decimal = get_price_decimal();
        info.total_quantity = total_quantity_;
        info.order_count = static_cast<uint32_t>(orders_.size());
        return info;
    }

    const std::list<Order>& get_orders() const { return orders_; }

private:
    Price price_{0};
    double tick_size_{0.01};
    Quantity total_quantity_{0};
    std::list<Order> orders_;
    std::unordered_map<OrderId, std::list<Order>::iterator> order_map_;
};

} // namespace liquidity_lens
