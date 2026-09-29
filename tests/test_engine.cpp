#include "../engine/core/types.hpp"
#include "../engine/orderbook/order_book.hpp"
#include "../engine/queue/queue_tracker.hpp"
#include "../engine/features/microstructure_engine.hpp"
#include "../engine/adverse_selection/adverse_selection_engine.hpp"
#include "../engine/strategies/market_maker.hpp"
#include "../engine/execution/execution_simulator.hpp"
#include <cassert>
#include <iostream>
#include <vector>
#include <cmath>

using namespace liquidity_lens;

// Test 1: Fixed-Point Price representation, Tick conversions & Ordering
void test_fixed_point_price_conversions_and_ordering() {
    std::cout << "[Test 1] Fixed-Point Price & Deterministic Tick Ordering... ";
    double tick_size = 0.01;

    Price p1 = double_to_ticks(100.10, tick_size);
    Price p2 = double_to_ticks(100.20, tick_size);
    Price p3 = double_to_ticks(100.30, tick_size);

    assert(p1 == 10010);
    assert(p2 == 10020);
    assert(p3 == 10030);
    assert(p1 < p2 && p2 < p3);

    assert(std::abs(ticks_to_double(p1, tick_size) - 100.10) < 1e-9);
    assert(std::abs(ticks_to_double(p2, tick_size) - 100.20) < 1e-9);
    assert(std::abs(ticks_to_double(p3, tick_size) - 100.30) < 1e-9);

    // Spread in ticks and decimal
    Price spread_ticks = p3 - p1;
    assert(spread_ticks == 20);
    assert(std::abs(ticks_to_double(spread_ticks, tick_size) - 0.20) < 1e-9);

    std::cout << "PASSED\n";
}

// Test 2: Order Book Invariant Validation and Depth Tracking
void test_order_book_invariants_and_depth() {
    std::cout << "[Test 2] Order Book Depth & Invariant Validation... ";
    double tick_size = 0.50;
    LimitOrderBook book("BTC-USDT", tick_size);

    Price bid_1 = double_to_ticks(65000.0, tick_size);
    Price bid_2 = double_to_ticks(64999.5, tick_size);
    Price ask_1 = double_to_ticks(65000.5, tick_size);
    Price ask_2 = double_to_ticks(65001.0, tick_size);

    book.add_order(1, Side::BUY, bid_1, 50, 1000);
    book.add_order(2, Side::BUY, bid_1, 30, 2000);
    book.add_order(3, Side::BUY, bid_2, 100, 3000);

    book.add_order(4, Side::SELL, ask_1, 40, 4000);
    book.add_order(5, Side::SELL, ask_2, 80, 5000);

    assert(book.get_best_bid() == bid_1);
    assert(book.get_best_ask() == ask_1);
    assert(book.get_best_bid_qty() == 80);
    assert(book.get_best_ask_qty() == 40);
    assert(book.get_spread_ticks() == 1);
    assert(std::abs(book.get_spread_decimal() - 0.50) < 1e-6);
    assert(std::abs(book.get_mid_price_decimal() - 65000.25) < 1e-6);

    // Validate invariant (sum of active orders == price level quantity, uncrossed book)
    assert(book.validate_invariants());
    std::cout << "PASSED\n";
}

// Test 3: Priority Cancellations and Modifications
void test_cancellations_and_modifications() {
    std::cout << "[Test 3] FIFO Priority Size Reductions & Cancellations... ";
    double tick_size = 0.01;
    LimitOrderBook book("BTC-USDT", tick_size);
    Price price = double_to_ticks(100.0, tick_size);

    book.add_order(10, Side::BUY, price, 50, 1000);
    book.add_order(11, Side::BUY, price, 25, 2000);
    book.add_order(12, Side::BUY, price, 25, 3000);

    assert(book.get_best_bid_qty() == 100);

    // Cancel order 11
    bool cancel_res = book.cancel_order(11);
    assert(cancel_res);
    assert(book.get_best_bid_qty() == 75);

    // Modify order 10 size downwards (50 -> 30) maintaining head priority
    bool mod_res = book.modify_order(10, 30);
    assert(mod_res);
    assert(book.get_best_bid_qty() == 55);

    // Modifying size upwards loses queue priority and moves to tail
    bool mod_up = book.modify_order(10, 40);
    assert(mod_up);
    assert(book.get_best_bid_qty() == 65);

    assert(book.validate_invariants());
    std::cout << "PASSED\n";
}

// Test 4: Exact Queue Cancellation Attribution (Ahead vs Behind)
void test_exact_queue_cancellation_attribution() {
    std::cout << "[Test 4] Exact Queue Cancellation Attribution (Ahead vs Behind)... ";
    QueueTracker tracker;
    double tick_size = 0.50;
    Price price = double_to_ticks(65000.0, tick_size);

    // Queue at price:
    // Order A (id 101, qty 50) - Ahead
    // Order B (id 102, qty 30) - Ahead
    // YOU (id 999, qty 20)
    // Order C (id 103, qty 100) - Behind
    // Order D (id 104, qty 50) - Behind

    std::vector<OrderId> ahead_ids = {101, 102};
    OrderId my_order_id = 999;
    tracker.register_order(my_order_id, Side::BUY, price, 20, 80, 250, ahead_ids, 1000, 1000, tick_size);

    const auto* ord = tracker.get_order(my_order_id);
    assert(ord != nullptr);
    assert(ord->current_queue_ahead == 80);

    // Case 1: Order C (103) cancels 100 units BEHIND us
    tracker.on_order_cancelled(103, price, Side::BUY, 100);
    // CRITICAL: Queue ahead MUST REMAIN 80! It was behind us!
    assert(ord->current_queue_ahead == 80);
    assert(ord->behind_volume_cancelled == 100);

    // Case 2: Order B (102) cancels 30 units AHEAD of us
    tracker.on_order_cancelled(102, price, Side::BUY, 30);
    // Queue ahead drops from 80 -> 50!
    assert(ord->current_queue_ahead == 50);
    assert(ord->ahead_volume_cancelled == 30);

    // Case 3: Order A (101) partially cancels 20 units AHEAD of us
    tracker.on_order_cancelled(101, price, Side::BUY, 20);
    // Queue ahead drops from 50 -> 30!
    assert(ord->current_queue_ahead == 30);
    assert(ord->ahead_volume_cancelled == 50);

    std::cout << "PASSED\n";
}

// Test 5: FIFO Trade Consumption, Partial Fills and Complete Fill
void test_fifo_trade_consumption_and_fills() {
    std::cout << "[Test 5] FIFO Trade Consumption & Partial/Complete Fills... ";
    QueueTracker tracker;
    double tick_size = 0.50;
    Price price = double_to_ticks(65000.0, tick_size);

    std::vector<OrderId> ahead_ids = {201};
    OrderId my_order_id = 888;
    tracker.register_order(my_order_id, Side::BUY, price, 20, 30, 50, ahead_ids, 1000, 1000, tick_size);
    const auto* ord = tracker.get_order(my_order_id);

    // Trade of 20 units arrives (eats part of 30 ahead)
    auto fills1 = tracker.on_trade_event(Side::SELL, price, 20, 2000, 65000.25);
    assert(fills1.empty());
    assert(ord->current_queue_ahead == 10);
    assert(ord->remaining_quantity == 20);
    assert(ord->state == QueueState::ACTIVE);

    // Trade of 25 units arrives (eats remaining 10 ahead + 15 of our order)
    auto fills2 = tracker.on_trade_event(Side::SELL, price, 25, 3000, 65000.25);
    assert(fills2.size() == 1);
    assert(fills2[0].fill_quantity == 15);
    assert(ord->current_queue_ahead == 0);
    assert(ord->remaining_quantity == 5);
    assert(ord->filled_quantity == 15);
    assert(ord->state == QueueState::PARTIALLY_FILLED);

    // Trade of 10 units arrives (completes our remaining 5)
    auto fills3 = tracker.on_trade_event(Side::SELL, price, 10, 4000, 65000.25);
    assert(fills3.size() == 1);
    assert(fills3[0].fill_quantity == 5);
    assert(ord->remaining_quantity == 0);
    assert(ord->filled_quantity == 20);
    assert(ord->state == QueueState::FILLED);

    std::cout << "PASSED\n";
}

// Test 6: Multi-Horizon Adverse Selection Markouts (BUY and SELL)
void test_adverse_selection_buy_and_sell_markouts() {
    std::cout << "[Test 6] Multi-Horizon Markouts for BUY and SELL Fills... ";
    AdverseSelectionEngine engine;
    double tick_size = 0.50;

    // Maker BUY fill @ 65000 when mid was 65000.25
    SimulatedFill buy_fill;
    buy_fill.order_id = 1;
    buy_fill.side = Side::BUY;
    buy_fill.fill_price = double_to_ticks(65000.0, tick_size);
    buy_fill.fill_price_decimal = 65000.0;
    buy_fill.fill_quantity = 10;
    buy_fill.fill_timestamp_ns = 1000000000ULL; // t0 = 1s
    buy_fill.mid_at_fill_decimal = 65000.25;
    engine.on_simulated_fill(buy_fill);

    // Maker SELL fill @ 65001 when mid was 65000.50
    SimulatedFill sell_fill;
    sell_fill.order_id = 2;
    sell_fill.side = Side::SELL;
    sell_fill.fill_price = double_to_ticks(65001.0, tick_size);
    sell_fill.fill_price_decimal = 65001.0;
    sell_fill.fill_quantity = 10;
    sell_fill.fill_timestamp_ns = 1000000000ULL; // t0 = 1s
    sell_fill.mid_at_fill_decimal = 65000.50;
    engine.on_simulated_fill(sell_fill);

    // 10ms later (t0 + 10ms): price drops to 64998.0
    // For BUY maker: price drop is ADVERSE (bought high, now lower) -> negative markout
    // For SELL maker: price drop is FAVORABLE (sold high, now lower) -> positive markout
    engine.on_market_update(1000000000ULL + 10000000ULL, 64998.0);
    engine.flush(1000000000ULL + 2000000000ULL, 64998.0);

    auto summaries = engine.compute_horizon_summaries();
    assert(!summaries.empty());

    bool found_10ms = false;
    for (const auto& s : summaries) {
        if (s.horizon_label == "10ms") {
            found_10ms = true;
            assert(s.total_fills_evaluated == 2);
            // 1 adverse fill (BUY) and 1 favorable fill (SELL) -> 50% adverse probability
            assert(std::abs(s.adverse_probability - 0.50) < 1e-4);
        }
    }
    assert(found_10ms);
    std::cout << "PASSED\n";
}

// Test 7: Latency Delayed Activation & Queue Integrity
void test_latency_delayed_activation() {
    std::cout << "[Test 7] Latency In-Flight Delayed Order Activation... ";
    QueueTracker tracker;
    double tick_size = 0.50;
    Price price = double_to_ticks(65000.0, tick_size);

    // Order sent at t = 1,000,000 ns, latency 50,000 ns -> active at t = 1,050,000 ns
    TimestampNs placed_ts = 1000000ULL;
    TimestampNs active_ts = 1050000ULL;
    OrderId id = 777;
    tracker.register_order(id, Side::BUY, price, 10, 0, 10, {}, placed_ts, active_ts, tick_size);

    const auto* ord = tracker.get_order(id);
    assert(ord->state == QueueState::PENDING);

    // Trade arrives at t = 1,020,000 ns (while order is still in-flight/pending!)
    auto fills = tracker.on_trade_event(Side::SELL, price, 10, 1020000ULL, 65000.25);
    // Must NOT fill because order has not arrived at exchange matching engine yet!
    assert(fills.empty());
    assert(ord->state == QueueState::PENDING);

    // Advance time past active_ts (t = 1,060,000 ns)
    tracker.on_time_advance(1060000ULL);
    assert(ord->state == QueueState::ACTIVE);

    // Now trade at t = 1,070,000 ns generates fill
    auto fills_active = tracker.on_trade_event(Side::SELL, price, 10, 1070000ULL, 65000.25);
    assert(fills_active.size() == 1);
    assert(ord->state == QueueState::FILLED);

    std::cout << "PASSED\n";
}

// Test 8: Avellaneda-Stoikov Inventory Skewing and Accounting Invariants
void test_avellaneda_stoikov_and_pnl_invariants() {
    std::cout << "[Test 8] Avellaneda-Stoikov Inventory Skew & PnL Accounting Invariants... ";
    MMParameters params;
    params.type = StrategyType::AVELLANEDA_STOIKOV;
    params.tick_size = 0.50;
    params.gamma_risk_aversion = 0.5;
    MarketMakingStrategy mm(params);

    LimitOrderBook book("BTC-USDT", params.tick_size);
    Price bid = double_to_ticks(65000.0, params.tick_size);
    Price ask = double_to_ticks(65001.0, params.tick_size);
    book.add_order(1, Side::BUY, bid, 50, 1000);
    book.add_order(2, Side::SELL, ask, 50, 1000);

    MicrostructureFeatures f;
    f.realized_volatility = 50.0;

    // Flat inventory
    auto q_flat = mm.compute_quotes(book, f, 0.5);
    assert(std::abs(q_flat.reservation_price_decimal - 65000.50) < 1e-4);

    // Become long +50 units
    mm.on_fill(Side::BUY, bid, 50, 0.0);
    auto q_long = mm.compute_quotes(book, f, 0.5);
    // Reservation price skews downward to incentivize selling
    assert(q_long.reservation_price_decimal < q_flat.reservation_price_decimal);

    // PnL Invariant: Total PnL == Cash + Inventory * MidPrice
    double current_mid = 65000.50;
    double expected_pnl = mm.get_cash() + mm.get_inventory() * current_mid;
    assert(std::abs(mm.get_total_pnl(current_mid) - expected_pnl) < 1e-6);

    std::cout << "PASSED\n";
}

// Test 9: Detailed Queue Tracker Edge Cases (Cancellations Ahead/Behind, Multi-Level, Position Reaching Head)
void test_queue_tracker_comprehensive_edge_cases() {
    std::cout << "[Test 9] Queue Tracker Edge Cases & Exact Attribution Boundaries... ";
    QueueTracker tracker;
    double tick_size = 0.01;
    Price price = double_to_ticks(100.0, tick_size);

    // Scenario:
    // Order 1 (ahead, qty 40)
    // Order 2 (ahead, qty 60)
    // Order 99 (OUR ORDER, qty 50)
    // Order 3 (behind, qty 100)
    // Order 4 (behind, qty 150)
    // Total level volume = 400, queue ahead = 100
    std::vector<OrderId> ahead_ids = {1, 2};
    tracker.register_order(99, Side::BUY, price, 50, 100, 400, ahead_ids, 1000, 1000, tick_size);

    const auto* ord = tracker.get_order(99);
    assert(ord != nullptr);
    assert(ord->current_queue_ahead == 100);
    assert(ord->remaining_quantity == 50);

    // Edge Case 1: Order 3 (behind) cancels 100
    tracker.on_order_cancelled(3, price, Side::BUY, 100);
    assert(ord->current_queue_ahead == 100); // Ahead untouched!
    assert(ord->behind_volume_cancelled == 100);

    // Edge Case 2: Order 4 (behind) cancels 150
    tracker.on_order_cancelled(4, price, Side::BUY, 150);
    assert(ord->current_queue_ahead == 100); // Ahead untouched!
    assert(ord->behind_volume_cancelled == 250);

    // Edge Case 3: Unknown / non-existent order cancels 50 (fallback conservative attribution)
    tracker.on_order_cancelled(99999, price, Side::BUY, 50);
    assert(ord->current_queue_ahead == 100); // Ahead untouched!
    assert(ord->behind_volume_cancelled == 300);

    // Edge Case 4: Order 1 (ahead) cancels full 40
    tracker.on_order_cancelled(1, price, Side::BUY, 40);
    assert(ord->current_queue_ahead == 60); // Drops from 100 -> 60
    assert(ord->ahead_volume_cancelled == 40);

    // Edge Case 5: Duplicate cancellation attempt for Order 1 (already removed from ahead set)
    tracker.on_order_cancelled(1, price, Side::BUY, 40);
    assert(ord->current_queue_ahead == 60); // Untouched!

    // Edge Case 6: Trade of 60 consumes remaining ahead volume -> Our order reaches FRONT OF QUEUE
    auto fills1 = tracker.on_trade_event(Side::SELL, price, 60, 2000, 100.005);
    assert(fills1.empty());
    assert(ord->current_queue_ahead == 0); // At head of queue!
    assert(ord->remaining_quantity == 50);
    assert(ord->state == QueueState::ACTIVE);

    // Edge Case 7: Trade of 20 against our front order -> PARTIAL FILL
    auto fills2 = tracker.on_trade_event(Side::SELL, price, 20, 3000, 100.005);
    assert(fills2.size() == 1);
    assert(fills2[0].fill_quantity == 20);
    assert(ord->remaining_quantity == 30);
    assert(ord->filled_quantity == 20);
    assert(ord->state == QueueState::PARTIALLY_FILLED);

    // Edge Case 8: Trade of 30 against our remaining -> COMPLETE FILL
    auto fills3 = tracker.on_trade_event(Side::SELL, price, 30, 4000, 100.005);
    assert(fills3.size() == 1);
    assert(fills3[0].fill_quantity == 30);
    assert(ord->remaining_quantity == 0);
    assert(ord->filled_quantity == 50);
    assert(ord->state == QueueState::FILLED);

    std::cout << "PASSED\n";
}

// Test 10: Order Book Defensive Error Handling and Empty/Crossed Book Edge Cases
void test_order_book_error_handling_and_edge_cases() {
    std::cout << "[Test 10] Empty Book, Malformed Orders & Defensive Boundaries... ";
    double tick_size = 0.01;
    LimitOrderBook book("BTC-USDT", tick_size);

    // 1. Querying an empty book should be safe and return standard zero/defaults
    assert(!book.has_bid());
    assert(!book.has_ask());
    assert(book.get_best_bid() == 0);
    assert(book.get_best_ask() == 0);
    assert(book.get_best_bid_qty() == 0);
    assert(book.get_best_ask_qty() == 0);
    assert(book.get_spread_ticks() == 0);
    assert(book.get_mid_price_decimal() == 0.0);
    assert(book.get_micro_price_decimal() == 0.0);
    assert(book.get_top_obi() == 0.0);
    assert(book.validate_invariants()); // Empty book is valid

    // 2. Reject zero or negative quantities / prices
    Price p100 = double_to_ticks(100.0, tick_size);
    assert(!book.add_order(1, Side::BUY, p100, 0, 1000)); // Zero qty rejected
    assert(!book.add_order(2, Side::BUY, -10, 50, 1000)); // Negative price rejected
    assert(!book.add_order(3, Side::UNKNOWN, p100, 50, 1000)); // Unknown side rejected

    // 3. Cancelling non-existent order returns false
    assert(!book.cancel_order(99999));
    assert(!book.modify_order(99999, 100));

    // 4. Populate book
    book.add_order(10, Side::BUY, p100, 50, 1000);
    Price p101 = double_to_ticks(101.0, tick_size);
    book.add_order(20, Side::SELL, p101, 50, 1000);
    assert(book.validate_invariants());
    assert(book.get_total_active_orders() == 2);

    // 5. Modify order quantity to 0 should cancel the order safely
    bool mod_zero = book.modify_order(10, 0);
    assert(mod_zero);
    assert(!book.has_bid());
    assert(book.get_total_active_orders() == 1);

    // 6. Trade exceeding available depth should safely consume level and leave book empty on that side
    book.process_trade(Side::BUY, p101, 100); // Buy trade of 100 against ask of 50
    assert(!book.has_ask());
    assert(book.get_total_active_orders() == 0);
    assert(book.validate_invariants());

    std::cout << "PASSED\n";
}

int main() {
    std::cout << "\n========================================================\n";
    std::cout << "    Running Comprehensive LiquidityLens Engine Tests    \n";
    std::cout << "========================================================\n";

    test_fixed_point_price_conversions_and_ordering();
    test_order_book_invariants_and_depth();
    test_cancellations_and_modifications();
    test_exact_queue_cancellation_attribution();
    test_fifo_trade_consumption_and_fills();
    test_adverse_selection_buy_and_sell_markouts();
    test_latency_delayed_activation();
    test_avellaneda_stoikov_and_pnl_invariants();
    test_queue_tracker_comprehensive_edge_cases();
    test_order_book_error_handling_and_edge_cases();

    std::cout << "========================================================\n";
    std::cout << "   ALL 10 COMPREHENSIVE ENGINE TESTS PASSED CLEANLY!    \n";
    std::cout << "========================================================\n\n";
    return 0;
}

