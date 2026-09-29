"""
LiquidityLens Real Market Data Ingestion Adapter
Fetches and normalizes real exchange trade and order book tick data from Binance public endpoints.
Converts to the unified LiquidityLens event schema:
[timestamp_ns, event_type, side, price, quantity, order_id, symbol]
"""

import os
import json
import time
import requests
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional

class RealMarketDataAdapter:
    def __init__(self, symbol: str = "BTCUSDT", tick_size: float = 0.01):
        self.symbol = symbol
        self.tick_size = tick_size
        self.base_url = "https://api.binance.com"

    def fetch_real_trades(self, limit: int = 1000) -> List[Dict[str, Any]]:
        """
        Fetches real historical trade ticks from Binance public API.
        Fields: id, price, qty, time, isBuyerMaker
        """
        endpoint = f"{self.base_url}/api/v3/trades"
        params = {"symbol": self.symbol, "limit": limit}
        try:
            resp = requests.get(endpoint, params=params, timeout=10)
            if resp.status_code == 200:
                return resp.json()
            else:
                print(f"Failed to fetch Binance trades: HTTP {resp.status_code}")
                return []
        except Exception as e:
            print(f"Error fetching Binance data: {e}")
            return []

    def fetch_real_depth_snapshot(self, limit: int = 100) -> Dict[str, Any]:
        """
        Fetches real L2 depth snapshot from Binance public API.
        """
        endpoint = f"{self.base_url}/api/v3/depth"
        params = {"symbol": self.symbol, "limit": limit}
        try:
            resp = requests.get(endpoint, params=params, timeout=10)
            if resp.status_code == 200:
                return resp.json()
        except Exception as e:
            print(f"Error fetching depth snapshot: {e}")
        return {"bids": [], "asks": []}

    def convert_to_normalized_events(
        self,
        trades: List[Dict[str, Any]],
        depth: Optional[Dict[str, Any]] = None
    ) -> pd.DataFrame:
        """
        Converts real exchange trade ticks and depth into normalized LiquidityLens event stream.
        """
        events = []
        order_counter = 5000000000

        # 1. Seed initial order book from real L2 depth snapshot
        if depth and "bids" in depth and "asks" in depth:
            start_ts = int(time.time() * 1e9)
            if trades:
                start_ts = int(trades[0]["time"]) * 1000000 - 1000000  # 1ms before first trade

            for bid_entry in depth["bids"][:50]:
                p = float(bid_entry[0])
                q = float(bid_entry[1])
                qty_units = max(1, int(round(q * 100)))  # Scale fractional crypto to integer lots
                order_counter += 1
                events.append({
                    "timestamp_ns": start_ts,
                    "event_type": "ADD",
                    "side": "BUY",
                    "price": round(p, 2),
                    "quantity": qty_units,
                    "order_id": order_counter,
                    "symbol": self.symbol
                })

            for ask_entry in depth["asks"][:50]:
                p = float(ask_entry[0])
                q = float(ask_entry[1])
                qty_units = max(1, int(round(q * 100)))
                order_counter += 1
                events.append({
                    "timestamp_ns": start_ts,
                    "event_type": "ADD",
                    "side": "SELL",
                    "price": round(p, 2),
                    "quantity": qty_units,
                    "order_id": order_counter,
                    "symbol": self.symbol
                })

        # 2. Add real executed trades
        for t in trades:
            ts_ns = int(t["time"]) * 1000000  # Convert ms to ns
            price = float(t["price"])
            qty = float(t["qty"])
            qty_units = max(1, int(round(qty * 100)))
            trade_id = int(t["id"])

            # isBuyerMaker = True means the BUY order was passive (Maker), so the aggressive aggressor was SELLER
            aggressor_side = "SELL" if t.get("isBuyerMaker", False) else "BUY"

            events.append({
                "timestamp_ns": ts_ns,
                "event_type": "TRADE",
                "side": aggressor_side,
                "price": round(price, 2),
                "quantity": qty_units,
                "order_id": trade_id,
                "symbol": self.symbol
            })

        df = pd.DataFrame(events)
        if not df.empty:
            df.sort_values(by=["timestamp_ns", "event_type"], inplace=True)
        return df

    def save_dataset(self, df: pd.DataFrame, file_slug: str = "real_binance_btcusdt"):
        os.makedirs("data/processed", exist_ok=True)
        csv_path = f"data/processed/{file_slug}.csv"
        parquet_path = f"data/processed/{file_slug}.parquet"
        meta_path = f"data/processed/{file_slug}_metadata.json"

        df.to_csv(csv_path, index=False)
        df.to_parquet(parquet_path, index=False)

        metadata = {
            "dataset_type": "real",
            "source": "Binance Public Market Data Feed",
            "symbol": self.symbol,
            "data_type": "Real Executed Trades & L2 Depth Seed",
            "timestamp_resolution": "1 millisecond (converted to ns)",
            "total_events": len(df),
            "tick_size": self.tick_size,
            "start_time_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "limitations": "Binance public spot API provides L2 aggregated depth rather than individual anonymous L3 order IDs. Orders ahead are reconstructed from top-of-book volume queue."
        }

        with open(meta_path, "w") as f:
            json.dump(metadata, f, indent=2)

        print(f"Saved real dataset to {csv_path} and {parquet_path} ({len(df)} events).")
        return metadata

def ingest_real_market_data():
    adapter = RealMarketDataAdapter(symbol="BTCUSDT", tick_size=0.01)
    print("Ingesting real market trades from Binance...")
    trades = adapter.fetch_real_trades(limit=1000)
    print("Ingesting real L2 order book depth...")
    depth = adapter.fetch_real_depth_snapshot(limit=100)

    df = adapter.convert_to_normalized_events(trades, depth)
    meta = adapter.save_dataset(df, file_slug="real_binance_btcusdt")
    return meta

if __name__ == "__main__":
    ingest_real_market_data()
