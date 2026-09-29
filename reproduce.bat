@echo off
echo =====================================================================
echo    LiquidityLens -- End-to-End Automated Pipeline Reproduction
echo =====================================================================

echo [Step 1/5] Compiling and running C++ unit and invariant tests...
g++ -std=c++17 -O3 -Wall -Wextra -I. tests/test_engine.cpp -o test_engine.exe
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] test_engine compilation failed.
    exit /b %ERRORLEVEL%
)
.\test_engine.exe
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] test_engine tests failed.
    exit /b %ERRORLEVEL%
)

echo [Step 2/5] Compiling and running C++ performance benchmarks...
g++ -std=c++17 -O3 -Wall -Wextra -I. engine/benchmarks/benchmarks.cpp -o engine_benchmarks.exe
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] engine_benchmarks compilation failed.
    exit /b %ERRORLEVEL%
)
.\engine_benchmarks.exe 150000

echo [Step 3/5] Compiling C++ simulator CLI binary...
g++ -std=c++17 -O3 -Wall -Wextra -I. engine/main.cpp -o liquidity_lens_engine.exe
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] liquidity_lens_engine compilation failed.
    exit /b %ERRORLEVEL%
)
echo [OK] C++ simulator CLI built successfully.

echo [Step 4/5] Ingesting real Binance market data feed...
python data/real_data_adapter.py
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Real Binance ingestion failed. Using cached dataset.
)

echo [Step 5/5] Executing quantitative research experiments EXP-001 through EXP-007...
python research/experiments.py
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Research experiments execution failed.
    exit /b %ERRORLEVEL%
)

echo =====================================================================
echo    [SUCCESS] Full LiquidityLens Pipeline Reproduced Successfully!
echo =====================================================================
