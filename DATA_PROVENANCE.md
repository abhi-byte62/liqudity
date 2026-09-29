# 📊 Market Data Provenance & Ingestion Specifications

This document defines the exact origin, structure, normalization rules, and methodological constraints for all market data used in the **LiquidityLens** research workstation and C++ execution simulation engine.

---

## 1. Primary Market Datasets

| Dataset Identifier | Classification | Source / Mechanism | Instrument | Format | Record Count |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `real_binance_btcusdt` | **REAL** | Binance Public Spot REST/Depth API | `BTCUSDT` | CSV / Parquet | 1,100 records |
| `btc_liquid_balanced` | **SYNTHETIC** | Multivariate Hawkes L3 Generator | `BTC-USDT` (Simulated) | CSV / Parquet | 30,028 events |
| `btc_high_volatility` | **SYNTHETIC** | Multivariate Hawkes L3 Generator | `BTC-USDT` (Simulated) | CSV / Parquet | 24,837 events |
| `btc_trending_momentum`| **SYNTHETIC** | Multivariate Hawkes L3 Generator | `BTC-USDT` (Simulated) | CSV / Parquet | 30,028 events |
| `btc_liquidity_drought` | **SYNTHETIC** | Multivariate Hawkes L3 Generator | `BTC-USDT` (Simulated) | CSV / Parquet | 25,731 events |

---

## 2. Real Binance Spot Ingestion Specifications

### A. Origin & Endpoints
- **Provider:** Binance Public Spot REST API (`api.binance.com`)
- **Endpoints Utilized:**
  1. `/api/v3/trades` — Fetches real executed trade ticks (limit: 1,000 consecutive trades).
  2. `/api/v3/depth` — Fetches real top-of-book L2 depth snapshot (limit: 100 levels: top 50 bids, top 50 asks).
- **Asset Pair:** `BTCUSDT` (Spot)
- **Base Currency:** Bitcoin (BTC)
- **Quote Currency:** Tether (USDT)

### B. Field Mapping & Normalization
Incoming exchange feeds are normalized into the unified event schema:
```text
[timestamp_ns, event_type, side, price, quantity, order_id, symbol]
```

1. **Depth Seeding (Initial Book Reconstruction):**
   - The top 50 bids and top 50 asks from `/api/v3/depth` are ingested as initial `ADD` events.
   - Initial depth timestamps are aligned exactly $1\,\text{ms}$ prior to the first historical trade ($t_0 - 1\,\text{ms}$) to guarantee a valid, non-empty uncrossed initial book state before trade replay.
   - Price levels are converted to discrete fixed-point integer ticks ($Price = \text{round}(P / \text{tick\_size})$ where $\text{tick\_size} = 0.01$).
   - Fractional Bitcoin volumes are scaled by $100$ into integer lot units ($Quantity = \max(1, \text{round}(Q \times 100))$).

2. **Trade Ticks Ingestion:**
   - Real trade events are ingested with `event_type = TRADE`.
   - **Aggressor Side Determination:** Binance trade schema includes `isBuyerMaker: bool`.
     - When `isBuyerMaker == True`, the buyer posted a passive limit order (maker) and the seller initiated an aggressive market order; hence `aggressor_side = SELL`.
     - When `isBuyerMaker == False`, the buyer initiated an aggressive market order; hence `aggressor_side = BUY`.
   - Timestamps provided in milliseconds by Binance are converted to nanoseconds ($t_{\text{ns}} = t_{\text{ms}} \times 10^6$).

### C. Known Data Constraints & Limitations
- **L2 vs. L3 Granularity:** Binance public spot endpoints provide **L2 aggregated depth snapshots** and public trade ticks. Binance does not publish individual anonymous order lifecycle IDs (`ADD`, `MODIFY`, `CANCEL`) on public feeds.
- **Queue Attribution Boundary:** For real Binance feeds, simulated passive orders place themselves behind the initial aggregated volume at that price level ($Q_{\text{ahead}} = \text{DepthLevelVolume}$). Market trades eat $Q_{\text{ahead}}$ in FIFO order. True per-order cancellation attribution requires private exchange market-by-order (MBO) feeds.
- **Timestamp Resolution:** Exchange trade timestamps possess millisecond ($1\,\text{ms}$) resolution, converted to nanoseconds for uniform pipeline processing.

---

## 3. Synthetic L3 Market-by-Order Generator

### A. Hawkes Process Dynamics
Synthetic regimes are generated using mutually-exciting multivariate Hawkes point processes:
$$\lambda_m(t) = \mu_m + \sum_{j} \sum_{t_k < t} \alpha_{m,j} e^{-\beta (t - t_k)}$$
where each event type $m \in \{\text{AddBid}, \text{AddAsk}, \text{CancelBid}, \text{CancelAsk}, \text{TradeBuy}, \text{TradeSell}\}$ triggers conditional intensity clustering in subsequent order arrivals.

### B. Microstructure Simulation Regimes
1. **Liquid Balanced:** Symmetrical liquidity provision, $1$-tick spreads, balanced order flow imbalance ($\text{OBI} \approx 0$).
2. **High Volatility:** Elevated Hawkes excitation coefficients ($\alpha / \beta \approx 0.85$), wide multi-tick spreads, intense order cancellation rates.
3. **Trending Momentum:** Asymmetric arrival intensities with persistent positive order book imbalance ($\text{OBI} \approx +0.45$) producing sustained directional drift.
4. **Liquidity Drought:** Sparse order arrival, wide spreads ($>6$ ticks), high adverse selection upon execution.

---

## 4. Determinism & Reproducibility

1. **Re-generating Real Binance Dataset:**
   ```bash
   python data/real_data_adapter.py
   ```
2. **Re-generating Synthetic Hawkes Datasets:**
   ```bash
   python data/generator.py
   ```
3. **Running Full Research Experiments:**
   ```bash
   python research/experiments.py
   ```
4. **Deterministic Invariant Validation:**
   All datasets processed by the C++ engine (`engine/simulator/event_replay_engine.hpp`) guarantee:
   - Zero look-ahead bias: Quoting logic at time $t$ evaluates strictly past events ($\tau \le t$).
   - Strict uncrossed book integrity ($P_{\text{best\_bid}} < P_{\text{best\_ask}}$).
   - Invariant conservation ($\text{Total PnL} = \text{Cash} + \text{Inventory} \times P_{\text{mid}}$).
