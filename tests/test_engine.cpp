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

    std::cout << "========================================================\n";
    std::cout << "   ALL 8 COMPREHENSIVE ENGINE TESTS PASSED CLEANLY!     \n";
    std::cout << "========================================================\n\n";
    return 0;
}
