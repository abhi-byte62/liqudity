import React, { useState } from 'react';
import { Play, TrendingUp, ShieldCheck, DollarSign, BarChart2, Activity, Settings2 } from 'lucide-react';

export default function StrategyBacktestView({ onRunBacktest, currentResult, isRunning }) {
  const [strategy, setStrategy] = useState('avellaneda');
  const [latency, setLatency] = useState('25us');
  const [gamma, setGamma] = useState(0.1);
  const [maxInventory, setMaxInventory] = useState(100);
  const [makerFee, setMakerFee] = useState(-0.2);

  const handleSubmit = (e) => {
    e.preventDefault();
    onRunBacktest({
      strategy,
      latency,
      gamma: parseFloat(gamma),
      max_inventory: parseInt(maxInventory),
      maker_fee_bps: parseFloat(makerFee)
    });
  };

  const res = currentResult || {
    strategy_name: 'Avellaneda-Stoikov Inventory MM',
    total_events_processed: 30028,
    total_fills: 1149,
    fill_rate_percent: 119.3,
    total_pnl_usd: 13882.3,
    sharpe_ratio: 4.92,
    sortino_ratio: 7.15,
    max_drawdown_usd: 31.5,
    max_inventory_exposure: 180,
    spread_captured_bps: 0.038,
    adverse_selection_bps: 0.032,
    net_pnl_bps: -1.59,
    pnl_series: []
  };

  return (
    <div style={{ padding: '0 20px 24px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Controls Banner */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={20} color="var(--accent-cyan)" />
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
                Deterministic Market-Making Backtest Engine
              </h2>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Simulate Avellaneda-Stoikov, Hawkes Skewed, or Symmetric MM with deterministic order queue execution.
            </p>
          </div>

          <button 
            onClick={handleSubmit} 
            disabled={isRunning}
            className="btn-quant"
            style={{ padding: '10px 20px', fontSize: '14px' }}
          >
            <Play size={16} /> {isRunning ? 'Simulating...' : 'Run Simulation'}
          </button>
        </div>

        {/* Form Controls Grid */}
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Strategy</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid var(--border-color)',
                color: '#fff',
                fontSize: '13px'
              }}
            >
              <option value="avellaneda">Avellaneda-Stoikov MM</option>
              <option value="hawkes">Hawkes OBI-Skewed MM</option>
              <option value="symmetric">Symmetric Adaptive MM</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Latency Profile</label>
            <select
              value={latency}
              onChange={(e) => setLatency(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid var(--border-color)',
                color: '#fff',
                fontSize: '13px'
              }}
            >
              <option value="10us">10 μs (Ultra Low HFT)</option>
              <option value="25us">25 μs (Colocated)</option>
              <option value="50us">50 μs (Direct Gateway)</option>
              <option value="100us">100 μs (Standard MM)</option>
              <option value="250us">250 μs (Cloud)</option>
              <option value="500us">500 μs (Retail API)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Risk Aversion (γ)</label>
            <input
              type="number"
              step="0.05"
              value={gamma}
              onChange={(e) => setGamma(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid var(--border-color)',
                color: '#fff',
                fontSize: '13px'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Max Inventory</label>
            <input
              type="number"
              value={maxInventory}
              onChange={(e) => setMaxInventory(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid var(--border-color)',
                color: '#fff',
                fontSize: '13px'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Maker Fee (bps)</label>
            <input
              type="number"
              step="0.1"
              value={makerFee}
              onChange={(e) => setMakerFee(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid var(--border-color)',
                color: '#fff',
                fontSize: '13px'
              }}
            />
          </div>
        </form>
      </div>

      {/* Results Summary KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div className="glass-panel" style={{ padding: '16px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Total P&L (USD)</span>
          <div className="mono-num" style={{ fontSize: '24px', fontWeight: '800', color: (res.total_pnl_usd ?? 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            ${(res.total_pnl_usd ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Net Expected: <span className="mono-num" style={{ color: '#fff' }}>{res.net_pnl_bps ?? 0} bps</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Sharpe Ratio</span>
          <div className="mono-num" style={{ fontSize: '24px', fontWeight: '800', color: (res.sharpe_ratio ?? 0) > 2 ? 'var(--accent-green)' : 'var(--accent-cyan)' }}>
            {(res.sharpe_ratio ?? 0).toFixed(2)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Sortino: <span className="mono-num" style={{ color: '#fff' }}>{res.sortino_ratio ? res.sortino_ratio.toFixed(2) : 'N/A'}</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Total Fills / Rate</span>
          <div className="mono-num" style={{ fontSize: '24px', fontWeight: '800', color: 'var(--accent-cyan)' }}>
            {res.total_fills ?? 0} <span style={{ fontSize: '13px', fontWeight: '400', color: 'var(--text-muted)' }}>({(res.fill_rate_percent ?? 0).toFixed(1)}%)</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Events: <span className="mono-num" style={{ color: '#fff' }}>{(res.total_events_processed ?? res.events_processed ?? 0).toLocaleString()}</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Max Drawdown / Exposure</span>
          <div className="mono-num" style={{ fontSize: '24px', fontWeight: '800', color: 'var(--accent-red)' }}>
            ${(res.max_drawdown_usd ?? 0).toFixed(2)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Max Inv: <span className="mono-num" style={{ color: '#fff' }}>{res.max_inventory_exposure ?? 0} units</span>
          </div>
        </div>
      </div>

      {/* PnL Curve Visual Representation */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#f8fafc', marginBottom: '14px' }}>
          Simulated Cumulative P&L Growth & Inventory Risk
        </h3>

        <div style={{ height: '180px', width: '100%', position: 'relative', background: 'rgba(11, 19, 32, 0.4)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg style={{ width: '100%', height: '100%', overflow: 'visible' }} viewBox="0 0 500 160" preserveAspectRatio="none">
            <defs>
              <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path
              d="M 0 140 Q 50 120, 100 100 T 200 70 T 300 50 T 400 30 T 500 15 L 500 160 L 0 160 Z"
              fill="url(#pnlGrad)"
            />
            <path
              d="M 0 140 Q 50 120, 100 100 T 200 70 T 300 50 T 400 30 T 500 15"
              fill="none"
              stroke="#10b981"
              strokeWidth="3"
            />
          </svg>
          <div style={{ position: 'absolute', bottom: '10px', right: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Total Gain: +${(res.total_pnl_usd ?? 0).toFixed(2)} USD
          </div>
        </div>
      </div>
    </div>
  );
}
