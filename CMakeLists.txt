cmake_minimum_required(VERSION 3.16)
project(LiquidityLens VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(MSVC)
    add_compile_options(/W4 /O2)
else()
    add_compile_options(-Wall -Wextra -Wpedantic -O3 -mavx2)
endif()

include_directories(${CMAKE_CURRENT_SOURCE_DIR}/engine)

# Main Engine Executable
add_executable(liquidity_lens_engine
    engine/main.cpp
)

# Test Suite Executable
add_executable(test_engine
    tests/test_engine.cpp
)

# Performance Benchmark Executable
add_executable(engine_benchmarks
    engine/benchmarks/benchmarks.cpp
)
