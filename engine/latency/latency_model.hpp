#pragma once

#include "../core/types.hpp"
#include <random>
#include <algorithm>

namespace liquidity_lens {

struct LatencyProfile {
    uint64_t market_data_latency_ns{5000};      // 5 us
    uint64_t strategy_compute_latency_ns{5000};  // 5 us
    uint64_t network_latency_ns{10000};          // 10 us
    uint64_t exchange_processing_latency_ns{5000}; // 5 us
    double jitter_stddev_ns{1000.0};             // Jitter standard deviation

    uint64_t total_nominal_latency_ns() const {
        return market_data_latency_ns + strategy_compute_latency_ns + network_latency_ns + exchange_processing_latency_ns;
    }

    static LatencyProfile preset_ultra_low() { // 10 us total
        LatencyProfile p;
        p.market_data_latency_ns = 2000;
        p.strategy_compute_latency_ns = 1000;
        p.network_latency_ns = 5000;
        p.exchange_processing_latency_ns = 2000;
        p.jitter_stddev_ns = 500.0;
        return p;
    }

    static LatencyProfile preset_hft_colocated() { // 25 us total
        LatencyProfile p;
        p.market_data_latency_ns = 5000;
        p.strategy_compute_latency_ns = 3000;
        p.network_latency_ns = 12000;
        p.exchange_processing_latency_ns = 5000;
        p.jitter_stddev_ns = 1000.0;
        return p;
    }

    static LatencyProfile preset_fast_direct() { // 50 us total
        LatencyProfile p;
        p.market_data_latency_ns = 10000;
        p.strategy_compute_latency_ns = 5000;
        p.network_latency_ns = 25000;
        p.exchange_processing_latency_ns = 10000;
        p.jitter_stddev_ns = 2000.0;
        return p;
    }

    static LatencyProfile preset_standard_mm() { // 100 us total
        LatencyProfile p;
        p.market_data_latency_ns = 20000;
        p.strategy_compute_latency_ns = 10000;
        p.network_latency_ns = 50000;
        p.exchange_processing_latency_ns = 20000;
        p.jitter_stddev_ns = 5000.0;
        return p;
    }

    static LatencyProfile preset_cloud_hosted() { // 250 us total
        LatencyProfile p;
        p.market_data_latency_ns = 50000;
        p.strategy_compute_latency_ns = 25000;
        p.network_latency_ns = 125000;
        p.exchange_processing_latency_ns = 50000;
        p.jitter_stddev_ns = 10000.0;
        return p;
    }

    static LatencyProfile preset_retail_api() { // 500 us total
        LatencyProfile p;
        p.market_data_latency_ns = 100000;
        p.strategy_compute_latency_ns = 50000;
        p.network_latency_ns = 250000;
        p.exchange_processing_latency_ns = 100000;
        p.jitter_stddev_ns = 20000.0;
        return p;
    }
};

class LatencySimulator {
public:
    LatencySimulator(const LatencyProfile& profile = LatencyProfile::preset_fast_direct(), uint32_t seed = 42)
        : profile_(profile), rng_(seed), dist_(0.0, profile.jitter_stddev_ns) {}

    void set_profile(const LatencyProfile& profile) {
        profile_ = profile;
        dist_ = std::normal_distribution<double>(0.0, profile_.jitter_stddev_ns);
    }

    const LatencyProfile& get_profile() const { return profile_; }

    // Calculate arrival timestamp of an order sent by strategy at send_ts
    TimestampNs calculate_order_arrival_ts(TimestampNs send_ts) {
        int64_t jitter = static_cast<int64_t>(dist_(rng_));
        int64_t total = static_cast<int64_t>(profile_.total_nominal_latency_ns()) + jitter;
        if (total < 1000) total = 1000; // Minimum 1 us physical floor
        return send_ts + static_cast<uint64_t>(total);
    }

    // Calculate when market data event at event_ts becomes visible to strategy
    TimestampNs calculate_market_data_ingress_ts(TimestampNs event_ts) {
        return event_ts + profile_.market_data_latency_ns;
    }

private:
    LatencyProfile profile_;
    std::mt19937 rng_;
    std::normal_distribution<double> dist_;
};

} // namespace liquidity_lens
