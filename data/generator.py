"""
LiquidityLens Synthetic High-Frequency L3 Market Data Generator
Generates realistic limit-order-book event feeds with Hawkes process event clustering,
queue dynamics, adverse selection moves, and configurable market microstructure regimes.
"""

import os
import time
import numpy as np
import pandas as pd
from typing import List, Dict, Any

class MarketDataGenerator:
    def __init__(self, symbol: str = "BTC-USDT", base_price: float = 65000.0, tick_size: float = 0.5):
        self.symbol = symbol
        self.base_price = base_price
        self.tick_size = tick_size

    def generate_events(
        self,
        num_events: int = 50000,
        regime: str = "liquid_balanced",
        seed: int = 42
    ) -> pd.DataFrame:
        """
        Generates simulated L3 market events: ADD, CANCEL, MODIFY, TRADE.
        Regimes: 'liquid_balanced', 'high_volatility', 'trending_momentum', 'liquidity_drought'
        """
        np.random.seed(seed)
        
        # Regime configurations
        if regime == "liquid_balanced":
            volatility = 0.0001
            drift = 0.0
            spread_ticks = 1
            cancel_prob = 0.35
            trade_prob = 0.18
            hawkes_alpha = 0.6
            hawkes_beta = 8.0
        elif regime == "high_volatility":
            volatility = 0.0005
            drift = 0.0
            spread_ticks = 3
            cancel_prob = 0.45
            trade_prob = 0.28
            hawkes_alpha = 1.2
            hawkes_beta = 4.0
        elif regime == "trending_momentum":
            volatility = 0.0002
            drift = 0.00015  # Upward drift with strong buyer aggression
            spread_ticks = 1
            cancel_prob = 0.30
            trade_prob = 0.25
            hawkes_alpha = 0.9
            hawkes_beta = 6.0
        elif regime == "liquidity_drought":
            volatility = 0.0003
            drift = -0.00005
            spread_ticks = 6
            cancel_prob = 0.50
            trade_prob = 0.15
            hawkes_alpha = 0.5
            hawkes_beta = 5.0
        else:
            raise ValueError(f"Unknown regime: {regime}")

        # State variables
        start_ts = 1710000000_000_000_000  # Nanoseconds
        current_ts = start_ts
        mid_price = self.base_price
        order_id_counter = 1000
        active_bids = {}  # order_id -> (price, qty)
        active_asks = {}

        events = []
        intensity = 1000.0  # Events per second

        # Seed initial order book
        for i in range(1, 15):
            bid_p = round(mid_price - i * self.tick_size, 2)
            ask_p = round(mid_price + i * self.tick_size, 2)
            bid_q = np.random.randint(10, 100)
            ask_q = np.random.randint(10, 100)

            order_id_counter += 1
            active_bids[order_id_counter] = (bid_p, bid_q)
            events.append({
                "timestamp_ns": current_ts,
                "event_type": "ADD",
                "side": "BUY",
                "price": bid_p,
                "quantity": bid_q,
                "order_id": order_id_counter,
                "symbol": self.symbol
            })

            order_id_counter += 1
            active_asks[order_id_counter] = (ask_p, ask_q)
            events.append({
                "timestamp_ns": current_ts,
                "event_type": "ADD",
                "side": "SELL",
                "price": ask_p,
                "quantity": ask_q,
                "order_id": order_id_counter,
                "symbol": self.symbol
            })

        # Main event simulation loop
        for _ in range(num_events):
            # Hawkes inter-arrival time (stochastic nanoseconds)
            dt_sec = np.random.exponential(1.0 / max(50.0, intensity))
            dt_ns = int(dt_sec * 1e9)
            current_ts += max(100, dt_ns)

            # Intensity decay
            intensity = 500.0 + (intensity - 500.0) * np.exp(-hawkes_beta * dt_sec)

            # Random price drift
            price_shock = mid_price * (drift * dt_sec + volatility * np.sqrt(dt_sec) * np.random.randn())
            mid_price = max(10.0, mid_price + price_shock)

            # Action selection
            rand_action = np.random.rand()

            if rand_action < trade_prob:
                # TRADE (Aggressive market sweep)
                intensity += hawkes_alpha * 200.0  # Self-excitation jump
                
                # Side influenced by drift and regime
                buy_bias = 0.5 + (0.2 if regime == "trending_momentum" else 0.0)
                side = "BUY" if np.random.rand() < buy_bias else "SELL"
                trade_qty = np.random.randint(5, 50)

                if side == "BUY":
                    # Trade hits asks
                    trade_price = round(mid_price + spread_ticks * self.tick_size * 0.5, 2)
                else:
                    # Trade hits bids
                    trade_price = round(mid_price - spread_ticks * self.tick_size * 0.5, 2)

                events.append({
                    "timestamp_ns": current_ts,
                    "event_type": "TRADE",
                    "side": side,
                    "price": trade_price,
                    "quantity": trade_qty,
                    "order_id": 0,
                    "symbol": self.symbol
                })

            elif rand_action < trade_prob + cancel_prob:
                # CANCEL
                if np.random.rand() < 0.5 and active_bids:
                    cancel_id = np.random.choice(list(active_bids.keys()))
                    p, q = active_bids.pop(cancel_id)
                    events.append({
                        "timestamp_ns": current_ts,
                        "event_type": "CANCEL",
                        "side": "BUY",
                        "price": p,
                        "quantity": q,
                        "order_id": cancel_id,
                        "symbol": self.symbol
                    })
                elif active_asks:
                    cancel_id = np.random.choice(list(active_asks.keys()))
                    p, q = active_asks.pop(cancel_id)
                    events.append({
                        "timestamp_ns": current_ts,
                        "event_type": "CANCEL",
                        "side": "SELL",
                        "price": p,
                        "quantity": q,
                        "order_id": cancel_id,
                        "symbol": self.symbol
                    })

            else:
                # ADD (Limit Order)
                side = "BUY" if np.random.rand() < 0.5 else "SELL"
                qty = np.random.randint(5, 75)
                level_offset = np.random.geometric(p=0.4)  # Clustered closer to touch

                if side == "BUY":
                    price = round(mid_price - level_offset * self.tick_size, 2)
                    order_id_counter += 1
                    active_bids[order_id_counter] = (price, qty)
                else:
                    price = round(mid_price + level_offset * self.tick_size, 2)
                    order_id_counter += 1
                    active_asks[order_id_counter] = (price, qty)

                events.append({
                    "timestamp_ns": current_ts,
                    "event_type": "ADD",
                    "side": side,
                    "price": price,
                    "quantity": qty,
                    "order_id": order_id_counter,
                    "symbol": self.symbol
                })

        df = pd.DataFrame(events)
        return df

def generate_all_datasets():
    os.makedirs("data/raw", exist_ok=True)
    os.makedirs("data/processed", exist_ok=True)

    gen = MarketDataGenerator(symbol="BTC-USDT", base_price=65000.0, tick_size=0.5)

    regimes = [
        ("liquid_balanced", "btc_liquid_balanced"),
        ("high_volatility", "btc_high_volatility"),
        ("trending_momentum", "btc_trending_momentum"),
        ("liquidity_drought", "btc_liquidity_drought"),
    ]

    for regime_name, file_slug in regimes:
        print(f"Generating dataset for regime: {regime_name}...")
        df = gen.generate_events(num_events=30000, regime=regime_name, seed=42)
        
        csv_path = f"data/processed/{file_slug}.csv"
        parquet_path = f"data/processed/{file_slug}.parquet"
        
        df.to_csv(csv_path, index=False)
        df.to_parquet(parquet_path, index=False)
        print(f"  -> Saved {len(df)} events to {csv_path} and {parquet_path}")

if __name__ == "__main__":
    generate_all_datasets()
