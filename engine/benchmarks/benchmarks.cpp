#include "../core/types.hpp"
#include "../orderbook/order_book.hpp"
#include "../queue/queue_tracker.hpp"
#include "../features/microstructure_engine.hpp"
#include "../execution/execution_simulator.hpp"
#include <chrono>
#include <vector>
#include <iostream>
#include <iomanip>
#include <random>
#include <algorithm>
#include <fstream>

using namespace liquidity_lens;

struct LatencyStats {
    double p50_ns{0.0};
    double p90_ns{0.0};
    double p95_ns{0.0};
    double p99_ns{0.0};
    double p99_9_ns{0.0};
    double avg_ns{0.0};
    double min_ns{0.0};
    double max_ns{0.0};
    double throughput_eps{0.0}; // Events per second
};

LatencyStats compute_stats(std::vector<uint64_t>& latencies_ns, double total_time_sec, size_t total_events) {
    LatencyStats s;
    if (latencies_ns.empty()) return s;

    std::sort(latencies_ns.begin(), latencies_ns.end());
    size_t n = latencies_ns.size();

    s.min_ns = static_cast<double>(latencies_ns.front());
    s.max_ns = static_cast<double>(latencies_ns.back());
    s.p50_ns = static_cast<double>(latencies_ns[n * 50 / 100]);
    s.p90_ns = static_cast<double>(latencies_ns[n * 90 / 100]);
    s.p95_ns = static_cast<double>(latencies_ns[n * 95 / 100]);
    s.p99_ns = static_cast<double>(latencies_ns[n * 99 / 100]);
    s.p99_9_ns = static_cast<double>(latencies_ns[n * 999 / 1000]);

    double sum = 0.0;
    for (uint64_t lat : latencies_ns) sum += static_cast<double>(lat);
    s.avg_ns = sum / static_cast<double>(n);
    s.throughput_eps = total_time_sec > 0 ? (static_cast<double>(total_events) / total_time_sec) : 0.0;

    return s;
}

int main(int argc, char* argv[]) {
    size_t num_events = 150000;
    if (argc > 1) {
        try { num_events = std::stoull(argv[1]); } catch (...) {}
    }

    double tick_size = 0.50;
    Price base_mid_ticks = double_to_ticks(65000.0, tick_size);

    std::cout << "========================================================\n";
    std::cout << "  LiquidityLens C++ Core Performance Benchmark Suite   \n";
    std::cout << "========================================================\n";
    std::cout << "Generating " << num_events << " synthetic high-frequency market events...\n";

    std::vector<MarketEvent> test_events;
    test_events.reserve(num_events);

    std::mt19937_64 rng(1337);
    std::uniform_int_distribution<uint64_t> qty_dist(1, 100);
    std::uniform_int_distribution<int> type_dist(1, 100);
    std::uniform_int_distribution<int> level_dist(1, 20);

    TimestampNs current_ts = 1700000000000000000ULL;
    OrderId order_counter = 1;
    Price current_mid = base_mid_ticks;

    for (size_t i = 0; i < num_events; ++i) {
        current_ts += 500; // 500 ns interval (~2M events/sec arrival)
        int r = type_dist(rng);
        
        // Slight drift
        if (i % 200 == 0) {
            current_mid += (rng() % 3 == 0) ? 1 : ((rng() % 3 == 1) ? -1 : 0);
        }

        if (r <= 60) {
            // 60% Add limit orders (strictly uncrossed)
            bool is_buy = (rng() % 2 == 0);
            Side side = is_buy ? Side::BUY : Side::SELL;
            Price price = is_buy ? (current_mid - level_dist(rng)) : (current_mid + level_dist(rng));
            Quantity qty = qty_dist(rng);
            test_events.emplace_back(current_ts, EventType::ADD, side, price, qty, order_counter++);
        } else if (r <= 85) {
            // 25% Cancel
            OrderId cancel_id = (order_counter > 200) ? (order_counter - (rng() % 150) - 1) : 1;
            Side side = (rng() % 2 == 0) ? Side::BUY : Side::SELL;
            Price price = (side == Side::BUY) ? (current_mid - 1) : (current_mid + 1);
            test_events.emplace_back(current_ts, EventType::CANCEL, side, price, qty_dist(rng), cancel_id);
        } else {
            // 15% Trade (hits touch)
            bool is_buy_aggr = (rng() % 2 == 0);
            Side side = is_buy_aggr ? Side::BUY : Side::SELL;
            Price price = is_buy_aggr ? (current_mid + 1) : (current_mid - 1);
            Quantity qty = qty_dist(rng);
            test_events.emplace_back(current_ts, EventType::TRADE, side, price, qty, 0);
        }
    }

    std::cout << "Starting Limit Order Book throughput & latency benchmark..." << std::endl;

    LimitOrderBook book("BTC-USDT", tick_size);
    std::vector<uint64_t> latencies_ns;
    size_t batch_size = 500;
    size_t num_batches = num_events / batch_size;
    latencies_ns.reserve(num_batches);

    auto start_time = std::chrono::high_resolution_clock::now();

    for (size_t b = 0; b < num_batches; ++b) {
        auto t0 = std::chrono::high_resolution_clock::now();
        size_t start_idx = b * batch_size;
        for (size_t j = 0; j < batch_size; ++j) {
            book.process_event(test_events[start_idx + j]);
        }
        auto t1 = std::chrono::high_resolution_clock::now();
        uint64_t batch_dur_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(t1 - t0).count();
        latencies_ns.push_back(batch_dur_ns / batch_size);
    }

    auto end_time = std::chrono::high_resolution_clock::now();
    double total_sec = std::chrono::duration<double>(end_time - start_time).count();

    LatencyStats book_stats = compute_stats(latencies_ns, total_sec, num_events);

    std::cout << "\n---------------- [ ORDER BOOK RESULTS ] ----------------\n";
    std::cout << std::fixed << std::setprecision(2);
    std::cout << "Throughput      : " << book_stats.throughput_eps / 1e6 << " Million events/sec\n";
    std::cout << "Total Time      : " << total_sec * 1000.0 << " ms\n";
    std::cout << "Average Latency : " << book_stats.avg_ns << " ns (" << book_stats.avg_ns / 1000.0 << " us)\n";
    std::cout << "p50 Latency     : " << book_stats.p50_ns << " ns\n";
    std::cout << "p90 Latency     : " << book_stats.p90_ns << " ns\n";
    std::cout << "p95 Latency     : " << book_stats.p95_ns << " ns\n";
    std::cout << "p99 Latency     : " << book_stats.p99_ns << " ns\n";
    std::cout << "p99.9 Latency   : " << book_stats.p99_9_ns << " ns\n";
    std::cout << "Active Levels   : Bids=" << book.get_bid_level_count() << ", Asks=" << book.get_ask_level_count() << "\n";
    std::cout << "Active Orders   : " << book.get_total_active_orders() << "\n";
    std::cout << "Book Invariants : " << (book.validate_invariants() ? "VALID (PASSED)" : "FAILED") << "\n";

    // Full End-to-End Simulation Benchmark
    std::cout << "\nStarting Full End-to-End Simulation (LOB + Queue + Features + Strategy + Markouts)...\n";

    MMParameters mm_params;
    mm_params.tick_size = tick_size;
    ExecutionSimulator sim(LatencyProfile::preset_fast_direct(), mm_params);

    auto sim_start = std::chrono::high_resolution_clock::now();
    for (size_t i = 0; i < test_events.size(); ++i) {
        sim.process_event(test_events[i], static_cast<double>(i) / test_events.size());
    }
    BacktestResult res = sim.finalize_backtest();
    auto sim_end = std::chrono::high_resolution_clock::now();
    double sim_total_sec = std::chrono::duration<double>(sim_end - sim_start).count();

    std::cout << "\n------------- [ SIMULATOR ENGINE RESULTS ] -------------\n";
    std::cout << "Throughput      : " << (num_events / sim_total_sec) / 1e6 << " Million events/sec\n";
    std::cout << "Total Sim Time  : " << sim_total_sec * 1000.0 << " ms\n";
    std::cout << "Fills Simulated : " << res.total_fills << " fills\n";
    std::cout << "Fill Rate       : " << res.fill_rate_percent << " %\n";
    std::cout << "Spread Captured : " << res.spread_captured_bps << " bps\n";
    std::cout << "Adverse Sel.    : " << res.adverse_selection_bps << " bps\n";
    std::cout << "Net PnL         : " << res.net_pnl_bps << " bps\n";
    std::cout << "Total PnL       : $" << res.total_pnl_usd << "\n";
    std::cout << "Sharpe Ratio    : " << res.sharpe_ratio << "\n";
    std::cout << "========================================================\n";

    // Write JSON file for frontend/backend ingestion
    std::ofstream json_out("engine_benchmark_results.json");
    if (json_out.is_open()) {
        json_out << "{\n";
        json_out << "  \"total_events\": " << num_events << ",\n";
        json_out << "  \"lob_throughput_meps\": " << (book_stats.throughput_eps / 1e6) << ",\n";
        json_out << "  \"lob_avg_ns\": " << book_stats.avg_ns << ",\n";
        json_out << "  \"lob_p50_ns\": " << book_stats.p50_ns << ",\n";
        json_out << "  \"lob_p90_ns\": " << book_stats.p90_ns << ",\n";
        json_out << "  \"lob_p95_ns\": " << book_stats.p95_ns << ",\n";
        json_out << "  \"lob_p99_ns\": " << book_stats.p99_ns << ",\n";
        json_out << "  \"lob_p99_9_ns\": " << book_stats.p99_9_ns << ",\n";
        json_out << "  \"sim_throughput_meps\": " << ((num_events / sim_total_sec) / 1e6) << ",\n";
        json_out << "  \"sim_total_time_ms\": " << (sim_total_sec * 1000.0) << ",\n";
        json_out << "  \"total_fills\": " << res.total_fills << ",\n";
        json_out << "  \"net_pnl_bps\": " << res.net_pnl_bps << ",\n";
        json_out << "  \"sharpe_ratio\": " << res.sharpe_ratio << "\n";
        json_out << "}\n";
    }

    return 0;
}
