#pragma once

#include "../core/types.hpp"
#include "../execution/execution_simulator.hpp"
#include <fstream>
#include <sstream>
#include <vector>
#include <string>
#include <chrono>
#include <iostream>

namespace liquidity_lens {

class EventReplayEngine {
public:
    EventReplayEngine() = default;

    // Load market events from CSV
    // Format: timestamp_ns,event_type,side,price,quantity,order_id,symbol
    static std::vector<MarketEvent> load_from_csv(const std::string& csv_path, double tick_size = 0.01, size_t max_events = 0) {
        std::vector<MarketEvent> events;
        std::ifstream file(csv_path);
        if (!file.is_open()) {
            std::cerr << "Failed to open market data file: " << csv_path << std::endl;
            return events;
        }

        std::string line;
        // Check if header present
        if (std::getline(file, line)) {
            if (line.find("timestamp") == std::string::npos && line.find("ts") == std::string::npos) {
                MarketEvent ev = parse_csv_line(line, tick_size);
                if (ev.price > 0) events.push_back(ev);
            }
        }

        while (std::getline(file, line)) {
            if (line.empty()) continue;
            MarketEvent ev = parse_csv_line(line, tick_size);
            if (ev.price > 0) {
                events.push_back(ev);
                if (max_events > 0 && events.size() >= max_events) {
                    break;
                }
            }
        }

        return events;
    }

    // Run replay and return full backtest analytics
    static BacktestResult run_replay(ExecutionSimulator& simulator, const std::vector<MarketEvent>& events) {
        simulator.reset();
        size_t total = events.size();

        for (size_t i = 0; i < total; ++i) {
            double progress = (total > 0) ? (static_cast<double>(i) / total) : 0.0;
            simulator.process_event(events[i], progress);
        }

        return simulator.finalize_backtest();
    }

private:
    static MarketEvent parse_csv_line(const std::string& line, double tick_size) {
        MarketEvent ev;
        std::stringstream ss(line);
        std::string token;

        // 1. timestamp_ns
        if (std::getline(ss, token, ',')) {
            try { ev.timestamp_ns = std::stoull(token); } catch (...) { ev.timestamp_ns = 0; }
        }
        // 2. event_type
        if (std::getline(ss, token, ',')) {
            ev.event_type = string_to_event_type(token);
        }
        // 3. side
        if (std::getline(ss, token, ',')) {
            ev.side = string_to_side(token);
        }
        // 4. price (convert decimal string to integer ticks)
        if (std::getline(ss, token, ',')) {
            try {
                double p_dec = std::stod(token);
                ev.price = double_to_ticks(p_dec, tick_size);
            } catch (...) { ev.price = 0; }
        }
        // 5. quantity
        if (std::getline(ss, token, ',')) {
            try { ev.quantity = std::stoull(token); } catch (...) { ev.quantity = 0; }
        }
        // 6. order_id
        if (std::getline(ss, token, ',')) {
            try { ev.order_id = std::stoull(token); } catch (...) { ev.order_id = 0; }
        }
        // 7. symbol
        if (std::getline(ss, token, ',')) {
            ev.symbol = token;
        }

        return ev;
    }
};

} // namespace liquidity_lens
