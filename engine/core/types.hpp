#pragma once

#include <cstdint>
#include <string>
#include <vector>
#include <iostream>
#include <iomanip>
#include <sstream>
#include <cmath>
#include <algorithm>

namespace liquidity_lens {

using OrderId = uint64_t;
using Quantity = uint64_t;
using TimestampNs = uint64_t; // Nanoseconds timestamp

// Fixed-point integer ticks for deterministic order-book matching
// 1 tick = tick_size in decimal currency (e.g. tick_size = 0.01 -> 100.25 is 10025 ticks)
using Price = int64_t;

// Standard conversion helpers between decimal prices and integer ticks
inline Price double_to_ticks(double price_decimal, double tick_size = 0.01) {
    if (tick_size <= 0.0) tick_size = 0.01;
    return static_cast<Price>(std::llround(price_decimal / tick_size));
}

inline double ticks_to_double(Price price_ticks, double tick_size = 0.01) {
    return static_cast<double>(price_ticks) * tick_size;
}

enum class Side : int8_t {
    BUY = 1,
    SELL = -1,
    UNKNOWN = 0
};

inline std::string side_to_string(Side side) {
    switch (side) {
        case Side::BUY: return "BUY";
        case Side::SELL: return "SELL";
        default: return "UNKNOWN";
    }
}

inline Side string_to_side(const std::string& str) {
    if (str == "BUY" || str == "buy" || str == "B" || str == "1") return Side::BUY;
    if (str == "SELL" || str == "sell" || str == "S" || str == "-1" || str == "ASK" || str == "ask") return Side::SELL;
    return Side::UNKNOWN;
}

enum class EventType : uint8_t {
    ADD = 1,
    CANCEL = 2,
    MODIFY = 3,
    TRADE = 4,
    SNAPSHOT = 5
};

inline std::string event_type_to_string(EventType type) {
    switch (type) {
        case EventType::ADD: return "ADD";
        case EventType::CANCEL: return "CANCEL";
        case EventType::MODIFY: return "MODIFY";
        case EventType::TRADE: return "TRADE";
        case EventType::SNAPSHOT: return "SNAPSHOT";
        default: return "UNKNOWN";
    }
}

inline EventType string_to_event_type(const std::string& str) {
    if (str == "ADD" || str == "add" || str == "A") return EventType::ADD;
    if (str == "CANCEL" || str == "cancel" || str == "C") return EventType::CANCEL;
    if (str == "MODIFY" || str == "modify" || str == "M") return EventType::MODIFY;
    if (str == "TRADE" || str == "trade" || str == "T") return EventType::TRADE;
    if (str == "SNAPSHOT" || str == "snapshot" || str == "S") return EventType::SNAPSHOT;
    return EventType::ADD;
}

// Internal Limit Order representation
struct Order {
    OrderId order_id{0};
    Side side{Side::UNKNOWN};
    Price price{0}; // in integer ticks
    Quantity quantity{0};
    TimestampNs timestamp_ns{0};
    uint32_t queue_index{0}; // Position in the level queue

    Order() = default;
    Order(OrderId id, Side s, Price p, Quantity q, TimestampNs ts)
        : order_id(id), side(s), price(p), quantity(q), timestamp_ns(ts), queue_index(0) {}
};

// Compact Market Event structure for streaming & replay
struct MarketEvent {
    TimestampNs timestamp_ns{0};
    EventType event_type{EventType::ADD};
    Side side{Side::UNKNOWN};
    Price price{0}; // in integer ticks
    Quantity quantity{0};
    OrderId order_id{0};
    std::string symbol{"BTC-USDT"};

    MarketEvent() = default;
    MarketEvent(TimestampNs ts, EventType type, Side s, Price p, Quantity q, OrderId id, const std::string& sym = "BTC-USDT")
        : timestamp_ns(ts), event_type(type), side(s), price(p), quantity(q), order_id(id), symbol(sym) {}
};

struct LevelInfo {
    Price price{0};
    double price_decimal{0.0};
    Quantity total_quantity{0};
    uint32_t order_count{0};
};

struct L2Snapshot {
    TimestampNs timestamp_ns{0};
    Price best_bid{0};
    Price best_ask{0};
    double best_bid_decimal{0.0};
    double best_ask_decimal{0.0};
    double mid_price_decimal{0.0};
    double spread_decimal{0.0};
    double spread_bps{0.0};
    double micro_price_decimal{0.0};
    double obi{0.0}; // Order Book Imbalance (-1 to +1)
    std::vector<LevelInfo> bids;
    std::vector<LevelInfo> asks;
};

struct SimulatedFill {
    OrderId order_id{0};
    Side side{Side::UNKNOWN};
    Price fill_price{0};
    double fill_price_decimal{0.0};
    Quantity fill_quantity{0};
    TimestampNs fill_timestamp_ns{0};
    TimestampNs order_placed_ts{0};
    uint64_t latency_applied_ns{0};
    bool is_maker{true};
    double mid_at_fill_decimal{0.0};
    double spread_captured_bps{0.0};
    double adverse_selection_1ms_bps{0.0};
    double adverse_selection_5ms_bps{0.0};
    double adverse_selection_10ms_bps{0.0};
    double adverse_selection_50ms_bps{0.0};
    double adverse_selection_100ms_bps{0.0};
    double adverse_selection_500ms_bps{0.0};
    double adverse_selection_1s_bps{0.0};
    double net_pnl_bps{0.0};
};

} // namespace liquidity_lens
