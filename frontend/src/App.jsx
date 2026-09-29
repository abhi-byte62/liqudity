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
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch available markets
  useEffect(() => {
    let ignore = false;
    async function fetchMarkets() {
      try {
        const res = await fetch(`${API_BASE}/api/markets`);
        if (!ignore && res.ok) {
          const data = await res.json();
          if (data.markets && data.markets.length > 0) {
            setMarkets(data.markets);
          }
        }
      } catch (err) {
        console.warn('Markets fetch error:', err);
      }
    }
    fetchMarkets();
    return () => {
      ignore = true;
    };
  }, []);

  // Fetch snapshot and latency sweep on market change or refresh trigger
  useEffect(() => {
    let ignore = false;
    async function loadMarketData() {
      try {
        const [snapRes, latRes] = await Promise.all([
          fetch(`${API_BASE}/api/orderbook/snapshot?dataset=${selectedMarket}`),
          fetch(`${API_BASE}/api/experiments/latency?dataset=${selectedMarket}`)
        ]);
        if (!ignore) {
          if (snapRes.ok) {
            const data = await snapRes.json();
            setSnapshot(data);
          }
          if (latRes.ok) {
            const data = await latRes.json();
            setLatencyData(data);
          }
        }
      } catch (err) {
        console.warn('Backend data fetch error:', err);
      }
    }
    loadMarketData();
    return () => {
      ignore = true;
    };
  }, [selectedMarket, refreshTrigger]);

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

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
        onRefresh={handleRefresh}
      />

      {/* Main Navigation Toolbar */}
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main Content Workspace */}
      <main className="main-content">
        {activeTab === 'orderbook' && (
          <OrderBookView snapshot={snapshot} />
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
