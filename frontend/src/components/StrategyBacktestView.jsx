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
      max_inventory: parseInt(maxInventory, 10),
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
    net_pnl_bps: 0.55,
    pnl_series: []
  };

  // Extract raw P&L values from the actual backend response
  const rawPnlPoints = res.pnl_series || [];
  const pnlValues = rawPnlPoints.map(pt => (pt.pnl !== undefined ? pt.pnl : (typeof pt === 'number' ? pt : 0)));

  // SVG Chart Dimensions & Dynamic Scaling
  const width = 500;
  const height = 120;
  const padTop = 12;
  const padBottom = 16;
  const padLeft = 45;
  const padRight = 15;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  let pointsString = '';
  let minPnl = 0;
  let maxPnl = 0;
  let zeroY = null;
  const hasData = pnlValues.length > 0;

  if (hasData) {
    minPnl = Math.min(...pnlValues);
    maxPnl = Math.max(...pnlValues);

    // If all points are identical, create a symmetric margin
    let range = maxPnl - minPnl;
    if (range === 0) {
      range = Math.abs(maxPnl) > 0 ? Math.abs(maxPnl) * 0.1 : 1.0;
      minPnl -= range / 2;
      maxPnl += range / 2;
    } else {
      // 5% margin padding
      const margin = range * 0.05;
      minPnl -= margin;
      maxPnl += margin;
      range = maxPnl - minPnl;
    }

    const n = pnlValues.length;
    pointsString = pnlValues.map((val, i) => {
      const x = padLeft + (n > 1 ? (i / (n - 1)) * plotWidth : plotWidth / 2);
      const normalizedY = (val - minPnl) / range;
      const y = height - padBottom - (normalizedY * plotHeight);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    if (minPnl < 0 && maxPnl > 0) {
      const zeroNorm = (0 - minPnl) / range;
      zeroY = height - padBottom - (zeroNorm * plotHeight);
    }
  }

  const finalPnl = hasData ? pnlValues[pnlValues.length - 1] : (res.total_pnl_usd ?? 0);
  const isPositive = finalPnl >= 0;

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

      {/* Dynamic P&L Trajectory Chart */}
      <div className="terminal-panel">
        <div className="terminal-header">
          <span className="panel-title">
            SIMULATED CUMULATIVE P&L TRAJECTORY & INVENTORY RUN
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {hasData ? `${pnlValues.length.toLocaleString()} DISCRETE SAMPLES` : 'NO ACTIVE TRAJECTORY'}
          </span>
        </div>

        <div style={{ padding: '16px' }}>
          <div style={{ height: '140px', width: '100%', position: 'relative', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {hasData ? (
              <svg style={{ width: '100%', height: '100%' }} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                {/* Horizontal Grid lines */}
                <line x1={padLeft} y1={padTop} x2={width - padRight} y2={padTop} stroke="var(--border-subtle)" strokeDasharray="3 3" />
                <line x1={padLeft} y1={height / 2} x2={width - padRight} y2={height / 2} stroke="var(--border-subtle)" strokeDasharray="3 3" />
                <line x1={padLeft} y1={height - padBottom} x2={width - padRight} y2={height - padBottom} stroke="var(--border-subtle)" strokeDasharray="3 3" />

                {/* Zero baseline if in range */}
                {zeroY !== null && (
                  <line x1={padLeft} y1={zeroY} x2={width - padRight} y2={zeroY} stroke="var(--border-strong)" strokeDasharray="2 2" />
                )}

                {/* Left Y-Axis Labels */}
                <text x={padLeft - 5} y={padTop + 8} fill="var(--text-muted)" fontSize="9" fontFamily="var(--font-mono)" textAnchor="end">
                  ${maxPnl.toFixed(0)}
                </text>
                <text x={padLeft - 5} y={height - padBottom} fill="var(--text-muted)" fontSize="9" fontFamily="var(--font-mono)" textAnchor="end">
                  ${minPnl.toFixed(0)}
                </text>

                {/* Actual P&L Trajectory Polyline */}
                <polyline
                  fill="none"
                  stroke={isPositive ? 'var(--color-green)' : 'var(--color-red)'}
                  strokeWidth="1.5"
                  points={pointsString}
                />
              </svg>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                [NO SIMULATION TRAJECTORY RECORDED — EXECUTE SIMULATION TO GENERATE P&L RUN]
              </div>
            )}

            {hasData && (
              <div style={{ position: 'absolute', bottom: '6px', right: '10px', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Final P&L: <span style={{ color: isPositive ? 'var(--color-green)' : 'var(--color-red)', fontWeight: '600' }}>{finalPnl >= 0 ? `+$${finalPnl.toFixed(2)}` : `-$${Math.abs(finalPnl).toFixed(2)}`} USD</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
