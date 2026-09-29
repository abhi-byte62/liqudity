#include "core/types.hpp"
#include "orderbook/order_book.hpp"
#include "queue/queue_tracker.hpp"
#include "features/microstructure_engine.hpp"
#include "adverse_selection/adverse_selection_engine.hpp"
#include "latency/latency_model.hpp"
#include "strategies/market_maker.hpp"
#include "execution/execution_simulator.hpp"
#include "simulator/event_replay_engine.hpp"
#include <iostream>
#include <fstream>
#include <string>
#include <vector>
#include <map>

using namespace liquidity_lens;

void print_help() {
    std::cout << "LiquidityLens C++ High-Frequency Order Book & Execution Simulator\n"
              << "Usage:\n"
              << "  liquidity_lens_engine [options]\n\n"
              << "Options:\n"
              << "  --input <path>          Path to market events CSV\n"
              << "  --strategy <type>       Strategy: symmetric, avellaneda, hawkes (default: avellaneda)\n"
              << "  --latency <ns|preset>   Latency profile: 10us, 25us, 50us, 100us, 250us, 500us\n"
              << "  --tick-size <float>     Tick size in decimal currency (default: 0.50)\n"
              << "  --max-inventory <num>   Max inventory threshold (default: 100)\n"
              << "  --gamma <float>         Risk aversion gamma for Avellaneda-Stoikov (default: 0.1)\n"
              << "  --output-json <path>    Export full backtest metrics to JSON file\n"
              << "  --help                  Show help\n";
}

int main(int argc, char* argv[]) {
    std::string input_path = "";
    std::string strategy_type = "avellaneda";
    std::string latency_preset = "50us";
    std::string output_json = "";
    double tick_size = 0.50;
    int64_t max_inventory = 100;
    double gamma = 0.1;

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--input" && i + 1 < argc) input_path = argv[++i];
        else if (arg == "--strategy" && i + 1 < argc) strategy_type = argv[++i];
        else if (arg == "--latency" && i + 1 < argc) latency_preset = argv[++i];
        else if (arg == "--tick-size" && i + 1 < argc) tick_size = std::stod(argv[++i]);
        else if (arg == "--max-inventory" && i + 1 < argc) max_inventory = std::stoll(argv[++i]);
        else if (arg == "--gamma" && i + 1 < argc) gamma = std::stod(argv[++i]);
        else if (arg == "--output-json" && i + 1 < argc) output_json = argv[++i];
        else if (arg == "--help") { print_help(); return 0; }
    }

    LatencyProfile profile = LatencyProfile::preset_fast_direct();
    if (latency_preset == "10us" || latency_preset == "10") profile = LatencyProfile::preset_ultra_low();
    else if (latency_preset == "25us" || latency_preset == "25") profile = LatencyProfile::preset_hft_colocated();
    else if (latency_preset == "50us" || latency_preset == "50") profile = LatencyProfile::preset_fast_direct();
    else if (latency_preset == "100us" || latency_preset == "100") profile = LatencyProfile::preset_standard_mm();
    else if (latency_preset == "250us" || latency_preset == "250") profile = LatencyProfile::preset_cloud_hosted();
    else if (latency_preset == "500us" || latency_preset == "500") profile = LatencyProfile::preset_retail_api();

    MMParameters mm_params;
    if (strategy_type == "symmetric") mm_params.type = StrategyType::SYMMETRIC_ADAPTIVE;
    else if (strategy_type == "hawkes") mm_params.type = StrategyType::HAWKES_SKEWED;
    else mm_params.type = StrategyType::AVELLANEDA_STOIKOV;

    mm_params.tick_size = tick_size;
    mm_params.max_inventory = max_inventory;
    mm_params.gamma_risk_aversion = gamma;

    std::cout << "LiquidityLens Engine Initializing...\n"
              << "Strategy: " << strategy_type_to_string(mm_params.type) << "\n"
              << "Latency : " << profile.total_nominal_latency_ns() / 1000 << " us\n"
              << "TickSize: " << tick_size << "\n";

    ExecutionSimulator simulator(profile, mm_params);
    BacktestResult result;

    if (!input_path.empty()) {
        std::cout << "Loading market events from " << input_path << "...\n";
        auto events = EventReplayEngine::load_from_csv(input_path, tick_size);
        std::cout << "Replaying " << events.size() << " market events...\n";
        result = EventReplayEngine::run_replay(simulator, events);
    } else {
        std::cout << "No input file specified. Run with --help or provide --input <file.csv>\n";
        return 0;
    }

    std::cout << "\n================ [ SIMULATION RESULTS ] ================\n";
    std::cout << "Processed Events : " << result.total_events_processed << "\n";
    std::cout << "Simulated Fills  : " << result.total_fills << " (" << result.fill_rate_percent << "% fill rate)\n";
    std::cout << "Spread Captured  : " << result.spread_captured_bps << " bps\n";
    std::cout << "Adverse Sel. Loss: " << result.adverse_selection_bps << " bps\n";
    std::cout << "Fees & Slippage  : " << (result.fees_paid_bps + result.slippage_bps) << " bps\n";
    std::cout << "Net Expected PnL : " << result.net_pnl_bps << " bps\n";
    std::cout << "Total PnL (USD)  : $" << result.total_pnl_usd << "\n";
    std::cout << "Sharpe (1s res.) : " << result.sharpe_ratio << "\n";
    std::cout << "Max Drawdown     : $" << result.max_drawdown_usd << "\n";
    std::cout << "Max Inventory Exp: " << result.max_inventory_exposure << " units\n";
    std::cout << "========================================================\n";

    if (!output_json.empty()) {
        std::ofstream out(output_json);
        if (out.is_open()) {
            out << "{\n";
            out << "  \"symbol\": \"" << result.symbol << "\",\n";
            out << "  \"strategy\": \"" << result.strategy_name << "\",\n";
            out << "  \"events_processed\": " << result.total_events_processed << ",\n";
            out << "  \"total_orders_placed\": " << result.total_orders_placed << ",\n";
            out << "  \"total_fills\": " << result.total_fills << ",\n";
            out << "  \"fill_rate_percent\": " << result.fill_rate_percent << ",\n";
            out << "  \"spread_captured_bps\": " << result.spread_captured_bps << ",\n";
            out << "  \"adverse_selection_bps\": " << result.adverse_selection_bps << ",\n";
            out << "  \"fees_paid_bps\": " << result.fees_paid_bps << ",\n";
            out << "  \"slippage_bps\": " << result.slippage_bps << ",\n";
            out << "  \"inventory_cost_bps\": " << result.inventory_cost_bps << ",\n";
            out << "  \"net_pnl_bps\": " << result.net_pnl_bps << ",\n";
            out << "  \"total_pnl_usd\": " << result.total_pnl_usd << ",\n";
            out << "  \"sharpe_ratio\": " << result.sharpe_ratio << ",\n";
            out << "  \"sortino_ratio\": " << result.sortino_ratio << ",\n";
            out << "  \"max_drawdown_usd\": " << result.max_drawdown_usd << ",\n";
            out << "  \"max_inventory_exposure\": " << result.max_inventory_exposure << ",\n";
            out << "  \"avg_fill_time_ms\": " << result.avg_fill_time_ms << ",\n";
            out << "  \"latency_nominal_ns\": " << result.latency_nominal_ns << ",\n";

            // Markouts
            out << "  \"markouts\": [\n";
            for (size_t i = 0; i < result.markout_horizons.size(); ++i) {
                const auto& m = result.markout_horizons[i];
                out << "    {\"horizon\": \"" << m.horizon_label << "\", \"horizon_ns\": " << m.horizon_ns
                    << ", \"adverse_prob\": " << m.adverse_probability
                    << ", \"mean_markout_bps\": " << m.mean_markout_bps
                    << ", \"mean_adverse_loss_bps\": " << m.mean_adverse_loss_bps << "}"
                    << (i + 1 < result.markout_horizons.size() ? "," : "") << "\n";
            }
            out << "  ],\n";

            // Sampled PnL series for charts
            out << "  \"pnl_series\": [\n";
            for (size_t i = 0; i < result.pnl_series.size(); ++i) {
                const auto& pt = result.pnl_series[i];
                out << "    {\"ts\": " << pt.timestamp_ns << ", \"pnl\": " << pt.pnl_usd
                    << ", \"inv\": " << pt.inventory << ", \"mid\": " << pt.mid_price << "}"
                    << (i + 1 < result.pnl_series.size() ? "," : "") << "\n";
            }
            out << "  ]\n";
            out << "}\n";
            std::cout << "Exported results to " << output_json << "\n";
        }
    }

    return 0;
}
