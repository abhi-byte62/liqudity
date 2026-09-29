import React, { useState } from 'react';
import { Play, Activity } from 'lucide-react';

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
    fill_rate_percent: 78.2,
    total_pnl_usd: 13882.3,
    sharpe_ratio: 3.92,
    sortino_ratio: 5.15,
    max_drawdown_usd: 31.5,
    max_inventory_exposure: 80,
    spread_captured_bps: 1.70,
    adverse_selection_bps: 1.10,
    net_pnl_bps: 0.55
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Parameter Control Form */}
      <div className="terminal-panel" style={{ padding: '14px 16px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <span className="panel-title" style={{ fontSize: '13px' }}>
              <Activity size={14} color="var(--color-blue)" />
              STRATEGY BACKTEST EXECUTION CONTROLS
            </span>

            <button
              type="submit"
              disabled={isRunning}
              className="btn-terminal primary"
              style={{ padding: '6px 14px', fontWeight: '600' }}
            >
              <Play size={12} /> {isRunning ? 'SIMULATING REPLAY...' : 'EXECUTE SIMULATION'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                STRATEGY MODEL
              </label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                className="terminal-select"
                style={{ width: '100%' }}
              >
                <option value="avellaneda">Avellaneda-Stoikov MM</option>
                <option value="hawkes">Hawkes OBI-Skewed MM</option>
                <option value="symmetric">Symmetric Adaptive MM</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                LATENCY BUDGET
              </label>
              <select
                value={latency}
                onChange={(e) => setLatency(e.target.value)}
                className="terminal-select"
                style={{ width: '100%' }}
              >
                <option value="10us">10 μs (Ultra HFT)</option>
                <option value="25us">25 μs (Colocated)</option>
                <option value="50us">50 μs (Direct Gateway)</option>
                <option value="100us">100 μs (Standard MM)</option>
                <option value="250us">250 μs (Cloud)</option>
                <option value="500us">500 μs (Retail API)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                RISK AVERSION (γ)
              </label>
              <input
                type="number"
                step="0.05"
                value={gamma}
                onChange={(e) => setGamma(e.target.value)}
                className="terminal-input font-mono"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                MAX INVENTORY (UNITS)
              </label>
              <input
                type="number"
                value={maxInventory}
                onChange={(e) => setMaxInventory(e.target.value)}
                className="terminal-input font-mono"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                MAKER FEE (BPS)
              </label>
              <input
                type="number"
                step="0.1"
                value={makerFee}
                onChange={(e) => setMakerFee(e.target.value)}
                className="terminal-input font-mono"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </form>
      </div>

      {/* Results KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
        <div className="metric-box">
          <span className="metric-label">TOTAL P&L (USD)</span>
          <div className="metric-val font-mono" style={{ color: (res.total_pnl_usd ?? 0) >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
            ${(res.total_pnl_usd ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="metric-sub">
            Realized Net: <span className="font-mono">{res.net_pnl_bps ?? 0} bps</span>
          </span>
        </div>

        <div className="metric-box">
          <span className="metric-label">ANNUALIZED SHARPE RATIO</span>
          <div className="metric-val font-mono" style={{ color: (res.sharpe_ratio ?? 0) > 2 ? 'var(--color-green)' : 'var(--color-blue)' }}>
            {(res.sharpe_ratio ?? 0).toFixed(2)}
          </div>
          <span className="metric-sub">
            1-sec time resampled (<span className="font-mono">Sortino: {res.sortino_ratio ? res.sortino_ratio.toFixed(2) : 'N/A'}</span>)
          </span>
        </div>

        <div className="metric-box">
          <span className="metric-label">TOTAL FILLS / RATE</span>
          <div className="metric-val font-mono" style={{ color: 'var(--text-primary)' }}>
            {res.total_fills ?? 0} <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({(res.fill_rate_percent ?? 0).toFixed(1)}%)</span>
          </div>
          <span className="metric-sub">
            Events: <span className="font-mono">{(res.total_events_processed ?? res.events_processed ?? 0).toLocaleString()}</span>
          </span>
        </div>

        <div className="metric-box">
          <span className="metric-label">MAX DRAWDOWN / EXPOSURE</span>
          <div className="metric-val font-mono" style={{ color: 'var(--color-red)' }}>
            ${(res.max_drawdown_usd ?? 0).toFixed(2)}
          </div>
          <span className="metric-sub">
            Peak Inv: <span className="font-mono">{res.max_inventory_exposure ?? 0} units</span>
          </span>
        </div>
      </div>

      {/* P&L Trajectory Polyline */}
      <div className="terminal-panel">
        <div className="terminal-header">
          <span className="panel-title">
            SIMULATED CUMULATIVE P&L TRAJECTORY & INVENTORY RUN
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            DISCRETE TIME STEP RESAMPLING
          </span>
        </div>

        <div style={{ padding: '16px' }}>
          <div style={{ height: '140px', width: '100%', position: 'relative', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '2px', display: 'flex', alignItems: 'center' }}>
            <svg style={{ width: '100%', height: '100%' }} viewBox="0 0 500 120" preserveAspectRatio="none">
              {/* Hairline Grid lines */}
              <line x1="0" y1="30" x2="500" y2="30" stroke="var(--border-subtle)" strokeDasharray="3 3" />
              <line x1="0" y1="60" x2="500" y2="60" stroke="var(--border-subtle)" strokeDasharray="3 3" />
              <line x1="0" y1="90" x2="500" y2="90" stroke="var(--border-subtle)" strokeDasharray="3 3" />

              {/* Trajectory Polyline */}
              <polyline
                fill="none"
                stroke="var(--color-green)"
                strokeWidth="1.5"
                points="0,110 50,95 100,85 150,70 200,60 250,55 300,45 350,35 400,28 450,22 500,15"
              />
            </svg>
            <div style={{ position: 'absolute', bottom: '6px', right: '10px', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Net Return: +${(res.total_pnl_usd ?? 0).toFixed(2)} USD
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
