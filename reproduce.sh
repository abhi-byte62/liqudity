#!/usr/bin/env bash
set -e

echo "====================================================================="
echo "   LiquidityLens -- End-to-End Automated Pipeline Reproduction"
echo "====================================================================="

echo ""
echo "[Step 1/5] Compiling and running C++ unit and invariant tests..."
g++ -std=c++17 -O3 -Wall -Wextra -I. tests/test_engine.cpp -o test_engine
./test_engine

echo ""
echo "[Step 2/5] Compiling and running C++ performance benchmarks..."
g++ -std=c++17 -O3 -Wall -Wextra -I. engine/benchmarks/benchmarks.cpp -o engine_benchmarks
./engine_benchmarks 150000

echo ""
echo "[Step 3/5] Compiling C++ simulator CLI binary..."
g++ -std=c++17 -O3 -Wall -Wextra -I. engine/main.cpp -o liquidity_lens_engine
echo "[OK] C++ simulator CLI built successfully."

echo ""
echo "[Step 4/5] Ingesting real Binance market data feed..."
python3 data/real_data_adapter.py || echo "[WARNING] Live Binance fetch skipped/failed. Using processed cache."

echo ""
echo "[Step 5/5] Executing quantitative research experiments (EXP-001..007)..."
python3 research/experiments.py

echo ""
echo "====================================================================="
echo "   [SUCCESS] Full LiquidityLens Pipeline Reproduced Successfully!"
echo "====================================================================="
