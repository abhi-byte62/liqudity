# LiquidityLens

**Event-driven market microstructure research and execution simulator.**

LiquidityLens is a quantitative research platform and C++ simulation engine designed to analyze limit-order-book dynamics, liquidity provision, queue priority, execution probability, and adverse selection.

Instead of attempting naive directional price forecasting, LiquidityLens models the structural market-making problem:

> *When a liquidity provider posts a passive limit order, what is the probability that the order executes immediately before the market moves against the trader?*

The system reconstructs deterministic order-book states from market event feeds, models FIFO queue positioning with order-level cancellation attribution, simulates multi-stage microsecond latency budgets ($10\,\mu\text{s} \to 500\,\mu\text{s}$), and computes multi-horizon post-fill markouts with zero look-ahead bias.

---

## 1. System Architecture

```text
                    MARKET DATA
                  /             \
             REAL L2          SYNTHETIC L3
          (Binance Spot)    (Hawkes Process)
                \               /
                 +------+------+
                        |
                  EVENT REPLAY
             (Deterministic Stream)
                        |
                LIMIT ORDER BOOK
             (Fixed-Point int64_t)
                        |
          +-------------+-------------+
          |             |             |
     QUEUE MODEL   MICROSTRUCTURE   LATENCY MODEL
     (Exact FIFO     FEATURES      (4-Stage Delay
     Attribution)  (OBI, Micro-P)   10μs - 500μs)
          |             |             |
          +-------------+-------------+
                        |
               EXECUTION SIMULATOR
             (Passive Fill Allocation)
                        |
                 STRATEGY ENGINE
             (Avellaneda-Stoikov / Hawkes)
                        |
                    BACKTEST
             (1s Resampled Return Series)
                        |
             +----------+----------+
             |                     |
       P&L ACCOUNTING        RESEARCH LAB
     (Cash + Inv * Mid)     (EXP-001..007)
             |                     |
             +----------+----------+
                        |
                   FASTAPI API
                        |
              REACT QUANT TERMINAL
```

---

## 2. Core Capabilities & Methodology

### A. Fixed-Point Integer Price Engine
All prices are represented as discrete fixed-point integer ticks:
```cpp
using Price = int64_t;
```
Floating-point comparisons are eliminated from order matching and book state maintenance. Conversion helpers translate between floating-point input decimals and internal integer ticks deterministically based on instrument `tick_size`.

### B. Exact FIFO Queue Tracking & Cancellation Attribution
When placing a hypothetical passive limit order at price level $P$:
1. The engine indexes the exact set of resting market `OrderId`s sitting ahead in the FIFO queue (`orders_ahead`).
2. Incoming cancellations are evaluated individually:
   - If $\text{order\_id} \in \text{orders\_ahead}$, queue ahead volume is decremented by $\min(Q_{\text{ahead}}, Q_{\text{cancelled}})$.
   - If $\text{order\_id} \notin \text{orders\_ahead}$, the cancellation occurred behind the simulated order (or at another price level); queue ahead volume is preserved.
3. Aggressive market trades deplete volume ahead first before allocating partial or full fills to the simulated order.

### C. Zero Look-Ahead Multi-Horizon Markouts
Post-fill price movement is evaluated across 7 discrete observation horizons ($\tau \in \{1\text{ms}, 5\text{ms}, 10\text{ms}, 50\text{ms}, 100\text{ms}, 500\text{ms}, 1\text{s}\}$):
$$\text{Markout}_{\text{BUY}}(\tau) = \frac{\text{Mid}(t_{\text{fill}} + \tau) - \text{Mid}(t_{\text{fill}})}{\text{Mid}(t_{\text{fill}})} \times 10^4 \quad (\text{bps})$$
$$\text{Markout}_{\text{SELL}}(\tau) = \frac{\text{Mid}(t_{\text{fill}}) - \text{Mid}(t_{\text{fill}} + \tau)}{\text{Mid}(t_{\text{fill}})} \times 10^4 \quad (\text{bps})$$
Quoting strategies strictly receive market state information at or before decision timestamp $t \le t_{\text{decision}}$. Future observation windows $\tau$ are computed post-hoc for statistical markout curves without influencing quoting decisions.

### D. Statistically Sound Backtest & Invariant Accounting
- **1-Second Resampled Sharpe:** Return volatility and Sharpe ratios are computed from fixed-interval 1-second resampled mark-to-market equity snapshots rather than irregular event intervals.
- **Invariant Conservation:** Total equity at any timestamp satisfies $\text{Equity}(t) = \text{Cash}(t) + \text{Inventory}(t) \times \text{MidPrice}(t)$.

---

## 3. Data Provenance

LiquidityLens maintains a strict distinction between real and synthetic feeds:

| Dataset Identifier | Classification | Source | Description | Record Count |
| :--- | :--- | :--- | :--- | :--- |
| `real_binance_btcusdt` | **REAL** | Binance Public REST/Depth API | Real executed trades + Top 100 L2 depth seed | 1,100 events |
| `btc_liquid_balanced` | **SYNTHETIC** | Multivariate Hawkes Point Process | 1-tick tight spread, symmetric arrival flow | 30,028 events |
| `btc_high_volatility` | **SYNTHETIC** | Multivariate Hawkes Point Process | Volatility clustering, wide spreads, aggressive sweeps | 24,837 events |
| `btc_trending_momentum`| **SYNTHETIC** | Multivariate Hawkes Point Process | Asymmetric intensity, positive OBI (+0.45) drift | 30,028 events |
| `btc_liquidity_drought` | **SYNTHETIC** | Multivariate Hawkes Point Process | Sparse order flow, wide spreads (>6 ticks) | 25,731 events |

> **Data Limitation Note:** Binance public spot feeds provide aggregated Level-2 depth snapshots and executed trades. Binance does not publish individual anonymous order lifecycle IDs (`ADD`, `MODIFY`, `CANCEL`). True per-order cancellation attribution is evaluated on synthetic L3 streams. See [DATA_PROVENANCE.md](DATA_PROVENANCE.md) for full specifications.

---

## 4. Quantitative Research Experiments

All 7 research experiments are executed via `python research/experiments.py`:

* **EXP-001 (OBI vs. Short-Horizon Mid-Price Movement):** Replays the event stream dynamically with strict zero look-ahead bias, evaluating Pearson correlation $r$, regression slope, $R^2$, and $p$-value between top-level order-book imbalance ($\text{OBI} = \frac{Q_b - Q_a}{Q_b + Q_a}$) and forward mid-price returns across horizons from $10\,\text{ms}$ to $1\,\text{s}$.
* **EXP-002 (Queue Position vs. Fill Probability):** Executes a controlled FIFO simulation across 17,500 total simulated order placements ($2,500$ trials across 7 queue-ahead tiers under fixed seed $= 42$), measuring empirical fill probabilities, 95% Wilson binomial confidence intervals, and $P_{50}/P_{90}$ fill times.
* **EXP-003 & EXP-004 (Latency vs. Fill Rate & Adverse Selection):** Evaluates how order transmission delays ($10\,\mu\text{s} \to 500\,\mu\text{s}$) degrade passive fill rates and increase adverse selection markouts across 6 latency tiers.
* **EXP-005 (Spread vs. Expected P&L):** Analyzes the economic trade-off between quoting wider spreads (lower fill probability, higher edge per trade) versus narrower spreads (higher fill probability, higher adverse selection).
* **EXP-006 (Volatility vs. Adverse Selection):** Measures how local microstructure volatility scales the magnitude of post-fill adverse price movement.
* **EXP-007 (Synthetic vs. Real Market Data Comparison):** Cross-validates synthetic Hawkes microstructure distributions against real Binance trade flow.

---

## 5. C++ Core Benchmarks

Micro-benchmarked on $150,000$ market events under a local testing environment (Windows x86_64, MinGW GCC C++17 `-O3`):

| Component / Metric | Floating-Point Baseline | Fixed-Point `int64_t` Core | Delta |
| :--- | :--- | :--- | :--- |
| **LOB Processing Throughput** | 2.42 Million events/sec | **4.51–5.08 Million events/sec** | **+86.4% to +110%** |
| **Average Event Latency** | 413.1 ns ($0.41\,\mu\text{s}$) | **196.7–221.7 ns ($<0.23\,\mu\text{s}$)** | **-46.3% to -52.4%** |
| **Tail Latency ($p_{90}$)** | 1,994 ns ($1.99\,\mu\text{s}$) | **1,098–1,108 ns ($1.10\,\mu\text{s}$)** | **-44.4%** |
| **Tail Latency ($p_{99}$)** | 3,046 ns ($3.05\,\mu\text{s}$) | **2,034–2,040 ns ($2.04\,\mu\text{s}$)** | **-33.0%** |
| **Book Invariants** | Unchecked | **100% Verified (Strictly Uncrossed)** | **Guaranteed** |

*Note: Benchmark results represent single-threaded C++ event processing throughput under the specified local test hardware and do not represent a production multi-cast network gateway.*

---

## 6. Reproduction & Build Instructions

### Quick Automated Reproduction (1-Command)
```bash
# Windows
reproduce.bat

# Linux / macOS
chmod +x reproduce.sh && ./reproduce.sh
```

### Manual Step-by-Step Execution

#### 1. Compile and Run C++ Test Suite (10 Comprehensive Suites)
```bash
g++ -std=c++17 -O3 -Wall -Wextra -I. tests/test_engine.cpp -o test_engine.exe
.\test_engine.exe
```

#### 2. Run C++ Performance Benchmark Suite
```bash
g++ -std=c++17 -O3 -Wall -Wextra -I. engine/benchmarks/benchmarks.cpp -o engine_benchmarks.exe
.\engine_benchmarks.exe 150000
```

#### 3. Ingest Market Data & Run Research Experiments
```bash
# Ingest real Binance trades and depth
python data/real_data_adapter.py

# Run all 7 quantitative experiments
python research/experiments.py
```

#### 4. Launch Backend API & Interactive Terminal
```bash
# Start FastAPI backend (Port 8000)
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000

# Start React Research Terminal (Port 5174)
cd frontend
npm install
npm run dev
```
Open browser at `http://localhost:5174/`.

#### 5. Docker Deployment
```bash
docker-compose up --build
```

---

## 7. Technology Stack

- **Core Engine:** C++17 (`<cstdint>`, `<unordered_map>`, `<map>`, `<chrono>`, zero external C++ dependencies).
- **Research Layer:** Python 3.10+, NumPy, Pandas, SciPy (Hawkes MLE, markout analytics, resampled returns).
- **Backend API:** FastAPI, Uvicorn, WebSocket streaming.
- **Research Dashboard:** React 19, Vite, Lucide-React, custom SVG time-series & queue depth rendering.
- **Containerization:** Docker multi-stage build, Docker Compose.

---

## 8. Portfolio Summary

> **LiquidityLens — Market Microstructure Research Engine**
> Event-driven C++ market microstructure simulator for studying limit-order-book dynamics, queue position, adverse selection, latency sensitivity, and market-making execution.
> - Implemented fixed-point `int64_t` price representations and deterministic FIFO queue tracking with order-level cancellation attribution.
> - Built latency-aware execution simulation ($10\,\mu\text{s} \to 500\,\mu\text{s}$) and market-making strategies (Avellaneda-Stoikov & Hawkes skew) with strict invariant P&L accounting.
> - Evaluated queue position, order-book imbalance, latency sensitivity, and adverse selection markouts using real Binance L2/trade data and synthetic Hawkes L3 simulations.
> - Benchmarked C++ engine achieving 4.5M+ events/sec throughput and ~220ns latency under controlled local test conditions.

---

## 9. License

MIT License. See [LICENSE](LICENSE) for details.
