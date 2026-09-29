import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Navigation from './components/Navigation';
import OrderBookView from './components/OrderBookView';
import QueueTrackerView from './components/QueueTrackerView';
import AdverseSelectionView from './components/AdverseSelectionView';
import LatencyMatrixView from './components/LatencyMatrixView';
import StrategyBacktestView from './components/StrategyBacktestView';
import ResearchComparisonView from './components/ResearchComparisonView';
import BenchmarkView from './components/BenchmarkView';

const API_BASE = 'http://127.0.0.1:8000';

export default function App() {
  const [activeTab, setActiveTab] = useState('orderbook');
  const [selectedMarket, setSelectedMarket] = useState('real_binance_btcusdt');
  const [markets, setMarkets] = useState([
    { id: 'real_binance_btcusdt', name: 'BTC/USDT - Real Binance Spot L2/Trades', dataset_type: 'real' },
    { id: 'btc_liquid_balanced', name: 'BTC/USDT - Liquid Balanced Book', dataset_type: 'synthetic' },
    { id: 'btc_high_volatility', name: 'ETH/USDT - High Volatility Regime', dataset_type: 'synthetic' },
    { id: 'btc_trending_momentum', name: 'AAPL/USDT - Directional Momentum Flow', dataset_type: 'synthetic' },
    { id: 'btc_liquidity_drought', name: 'Micro-Cap - Liquidity Drought', dataset_type: 'synthetic' }
  ]);

  const [snapshot, setSnapshot] = useState(null);
  const [simResult, setSimResult] = useState(null);
  const [latencyData, setLatencyData] = useState(null);
  const [isRunningSim, setIsRunningSim] = useState(false);

  // Fetch available markets
  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/markets`);
        if (res.ok) {
          const data = await res.json();
          if (data.markets && data.markets.length > 0) {
            setMarkets(data.markets);
          }
        }
      } catch (err) {
        console.warn('Markets fetch error:', err);
      }
    };
    fetchMarkets();
  }, []);

  // Fetch snapshot and latency sweep
  const loadSnapshot = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/orderbook/snapshot?dataset=${selectedMarket}`);
      if (res.ok) {
        const data = await res.json();
        setSnapshot(data);
      }
    } catch (err) {
      console.warn('Backend snapshot fetch error:', err);
    }
  };

  const loadLatencySweep = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/experiments/latency?dataset=${selectedMarket}`);
      if (res.ok) {
        const data = await res.json();
        setLatencyData(data);
      }
    } catch (err) {
      console.warn('Latency sweep fetch error:', err);
    }
  };

  useEffect(() => {
    loadSnapshot();
    loadLatencySweep();
  }, [selectedMarket]);

  // Run backtest simulation
  const handleRunBacktest = async (params) => {
    setIsRunningSim(true);
    try {
      const res = await fetch(`${API_BASE}/api/simulation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset: selectedMarket,
          ...params
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSimResult(data);
      }
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setIsRunningSim(false);
    }
  };

  return (
    <div className="app-container">
      {/* Top Application Header */}
      <Header
        markets={markets}
        selectedMarket={selectedMarket}
        onSelectMarket={setSelectedMarket}
        onRefresh={loadSnapshot}
      />

      {/* Main Navigation Toolbar */}
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main Content Workspace */}
      <main className="main-content">
        {activeTab === 'orderbook' && (
          <OrderBookView snapshot={snapshot} onRefresh={loadSnapshot} />
        )}

        {activeTab === 'queue' && (
          <QueueTrackerView />
        )}

        {activeTab === 'adverse' && (
          <AdverseSelectionView simResult={simResult} />
        )}

        {activeTab === 'latency' && (
          <LatencyMatrixView latencyData={latencyData} />
        )}

        {activeTab === 'strategy' && (
          <StrategyBacktestView
            onRunBacktest={handleRunBacktest}
            currentResult={simResult}
            isRunning={isRunningSim}
          />
        )}

        {activeTab === 'comparison' && (
          <ResearchComparisonView />
        )}

        {activeTab === 'benchmark' && (
          <BenchmarkView />
        )}
      </main>
    </div>
  );
}
