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

LiquidityLens contains 7 quantitative microstructure experiments executed via `python research/experiments.py`. The platform maintains a strict distinction across methodology types:

| Experiment | Title | Methodology Type | Data Source |
| :--- | :--- | :--- | :--- |
| **EXP-001** | OBI vs. Future Mid-Price Return | Dynamic Event Replay | Synthetic LOB Stream (`btc_liquid_balanced.csv`) |
| **EXP-002** | Queue Position vs. Fill Probability | Controlled FIFO Simulation | Synthetic L3 Event Stream ($17,500$ Trials, Seed=42) |
| **EXP-003** | Latency vs. Adverse Selection Toxicity | Dynamic C++ Simulation | Binance Spot L2 + Real Trades ($10\,\mu\text{s} \to 500\,\mu\text{s}$) |
| **EXP-004** | Pure Spread MM vs. Skewed MM | Dynamic C++ Simulation | Real Binance Feed + High Volatility Stream |
| **EXP-005** | Hawkes Clustering Analysis | MLE Calibration Model | Trade Inter-Arrival Timestamps |
| **EXP-006** | Microstructure Regime Shifts | Cross-Regime Stress Test | 4 Distinct Microstructure Regime Streams |
| **EXP-007** | Synthetic vs. Real Feed Comparison | Distributional Comparison | Real Binance Spot L2 vs. Synthetic Hawkes L3 |

---

### EXP-001 — Order Book Imbalance vs. Future Mid-Price Return

- **Method:** Dynamic Event Replay (Strict Zero Look-Ahead)
- **Data Source:** Synthetic LOB stream (`data/processed/btc_liquid_balanced.csv`)
- **Execution Mechanism:**
  1. The Limit Order Book is reconstructed sequentially from the event stream.
  2. Quoting and book features evaluated at timestamp $t$ strictly use information available at or before $t$.
  3. Top-level Order Book Imbalance is calculated as:
     $$\text{OBI}(t) = \frac{Q_{\text{bid}}(t) - Q_{\text{ask}}(t)}{Q_{\text{bid}}(t) + Q_{\text{ask}}(t)}$$
  4. Depth-weighted OBI across the top 5 levels is also computed.
  5. Future mid-prices are evaluated across multiple horizons: $10\,\text{ms}, 25\,\text{ms}, 50\,\text{ms}, 100\,\text{ms}, 250\,\text{ms}, 500\,\text{ms}, 1000\,\text{ms}$.
  6. Pearson correlation $r$ and OLS linear regression are computed dynamically.

**Current $100\,\text{ms}$ Primary Horizon Result:**
- **Sample Count:** $7,975$ valid uncrossed book observations
- **Pearson $r$:** $-0.0157$ ($p = 0.162$)
- **Regression Slope:** $-0.0025\,\text{bps/OBI}$
- **$R^2$:** $0.0002$ (Standard Error: $0.0018$)

**Multi-Horizon Progression:**
- **$10\,\text{ms}$:** $N = 26,076$, $r = +0.0005$, $p = 0.941$
- **$25\,\text{ms}$:** $N = 21,317$, $r = +0.0297$, $p = 1.42 \times 10^{-5}$
- **$50\,\text{ms}$:** $N = 15,163$, $r = +0.0510$, $p = 3.41 \times 10^{-10}$
- **$100\,\text{ms}$:** $N = 7,975$, $r = -0.0157$, $p = 0.162$
- **$250\,\text{ms}$:** $N = 980$, $r = +0.2347$, $p = 9.98 \times 10^{-14}$

> *Methodological Note:* This experiment measures the observed association between order-book imbalance and subsequent mid-price returns within the evaluated synthetic market regime. The balanced synthetic regime produces a near-zero $100\,\text{ms}$ linear association, while longer horizons show stronger positive association. These results are specific to the generated market regime and should not be interpreted as universal real-market behavior.

---

### EXP-002 — Queue Position vs. Fill Probability

- **Method:** Controlled FIFO Simulation
- **Data Source:** Synthetic L3 event stream (`data/processed/btc_liquid_balanced.csv`)
- **Total Placements:** $17,500$ independent trials ($2,500$ trials across 7 queue-ahead tiers)
- **Random Seed:** $42$ (Deterministic reproduction)
- **Execution Mechanism:**
  1. For each trial, a simulated passive limit order of size $10$ is placed at the prevailing touch.
  2. Volume ahead is initialized to $Q_{\text{ahead}} \in [0, 25, 50, 100, 150, 200, 300]$.
  3. Subsequent market trade events deplete volume ahead first before allocating fills to the simulated order.
  4. Cancellations occurring ahead of the order decrement $Q_{\text{ahead}}$, while cancellations occurring behind leave $Q_{\text{ahead}}$ untouched.
  5. Fills, partial fills, cancellations, and fill times are recorded.
  6. 95% binomial confidence intervals are computed using the Wilson/normal approximation method.

**Empirical Queue Fill Results:**

| Queue Ahead ($Q_{\text{ahead}}$) | Placements | Fills | Fill Probability | 95% Confidence Interval | $P_{50}$ Fill Time | $P_{90}$ Fill Time |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **0 units (Head)** | 2,500 | 1,612 | **64.5%** | $[62.6\%, 66.4\%]$ | 0.08 ms | 3.37 ms |
| **25 units** | 2,500 | 1,557 | **62.3%** | $[60.4\%, 64.2\%]$ | 0.16 ms | 4.27 ms |
| **50 units** | 2,500 | 1,469 | **58.8%** | $[56.8\%, 60.7\%]$ | 0.26 ms | 4.64 ms |
| **100 units** | 2,500 | 1,395 | **55.8%** | $[53.8\%, 57.8\%]$ | 0.44 ms | 5.55 ms |
| **150 units** | 2,500 | 1,326 | **53.0%** | $[51.1\%, 55.0\%]$ | 0.65 ms | 6.47 ms |
| **200 units** | 2,500 | 1,320 | **52.8%** | $[50.8\%, 54.8\%]$ | 0.85 ms | 7.22 ms |
| **300 units (Tail)** | 2,500 | 1,229 | **49.2%** | $[47.2\%, 51.1\%]$ | 1.25 ms | 8.91 ms |

> *Methodological Note:* This captures the simulated relationship between queue-ahead volume and passive execution probability under the specified synthetic event-flow model. Queue priority provides a decisive execution edge before adverse price movement occurs.

---

### Research Integrity & Validation Principles

- **No Static Baseline Placeholders:** Experiment outputs are generated dynamically by executing the underlying simulation/replay scripts rather than loading manually curated summary values.
- **Deterministic Replication:** Simulations use explicit random seeds (`seed = 42`) to guarantee bit-for-bit identical outputs across consecutive runs.
- **Explicit Methodology Taxonomy:** All research outputs are explicitly classified as *Dynamic Event Replay*, *Controlled FIFO Simulation*, *Dynamic C++ Simulation*, *MLE Calibration*, or *Distributional Comparison*.
- **Scope Discipline:** Statistical associations and fill rates are reported strictly within their stated dataset parameters without making unproven universal real-market claims.

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
