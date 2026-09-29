# Multi-stage Dockerfile for LiquidityLens
# Stage 1: Build C++ Engine & Tools
FROM gcc:13 AS cpp-builder
WORKDIR /app
COPY engine/ engine/
COPY tests/ tests/
RUN g++ -std=c++14 -O3 -Wall -Wextra -Wpedantic engine/main.cpp -o liquidity_lens_engine
RUN g++ -std=c++14 -O3 -Wall -Wextra -Wpedantic engine/benchmarks/benchmarks.cpp -o engine_benchmarks
RUN g++ -std=c++14 -O3 -Wall -Wextra -Wpedantic tests/test_engine.cpp -o test_engine && ./test_engine

# Stage 2: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 3: Final Python Runtime
FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy C++ binaries
COPY --from=cpp-builder /app/liquidity_lens_engine /app/liquidity_lens_engine
COPY --from=cpp-builder /app/engine_benchmarks /app/engine_benchmarks

# Copy Python modules & data
COPY backend/ backend/
COPY research/ research/
COPY data/ data/

# Copy Frontend build artifacts
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

ENV PORT=8000
EXPOSE 8000

CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
