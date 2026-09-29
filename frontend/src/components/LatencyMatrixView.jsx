import React, { useState } from 'react';
import { Zap } from 'lucide-react';

export default function LatencyMatrixView({ latencyData }) {
  const defaultSweep = [
    { latency: '10us', latency_ns: 10000, fill_rate_percent: 88.5, total_fills: 1240, spread_captured_bps: 1.85, adverse_selection_bps: 0.85, net_pnl_bps: 0.95, total_pnl_usd: 16820.0, sharpe_ratio: 4.85 },
    { latency: '25us', latency_ns: 25000, fill_rate_percent: 78.2, total_fills: 1149, spread_captured_bps: 1.70, adverse_selection_bps: 1.10, net_pnl_bps: 0.55, total_pnl_usd: 13882.3, sharpe_ratio: 3.92 },
    { latency: '50us', latency_ns: 50000, fill_rate_percent: 69.4, total_fills: 980, spread_captured_bps: 1.55, adverse_selection_bps: 1.35, net_pnl_bps: 0.15, total_pnl_usd: 8420.5, sharpe_ratio: 2.45 },
    { latency: '100us', latency_ns: 100000, fill_rate_percent: 58.1, total_fills: 810, spread_captured_bps: 1.35, adverse_selection_bps: 1.60, net_pnl_bps: -0.30, total_pnl_usd: -2410.0, sharpe_ratio: -0.65 },
    { latency: '250us', latency_ns: 250000, fill_rate_percent: 44.0, total_fills: 620, spread_captured_bps: 1.15, adverse_selection_bps: 1.95, net_pnl_bps: -0.90, total_pnl_usd: -8540.0, sharpe_ratio: -2.10 },
    { latency: '500us', latency_ns: 500000, fill_rate_percent: 32.5, total_fills: 440, spread_captured_bps: 0.95, adverse_selection_bps: 2.30, net_pnl_bps: -1.45, total_pnl_usd: -14200.0, sharpe_ratio: -3.85 }
  ];

  const sweep = latencyData?.sweep || defaultSweep;
  const [selectedProfile, setSelectedProfile] = useState('25us');
  const activeRow = sweep.find(r => r.latency === selectedProfile) || sweep[1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Header Panel */}
      <div className="terminal-panel" style={{ padding: '12px 16px' }}>
        <span className="panel-title" style={{ fontSize: '13px' }}>
          <Zap size={14} color="var(--color-amber)" />
          LATENCY SENSITIVITY & EXECUTION PIPELINE MATRIX
        </span>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          Simulating 4-stage pipeline propagation: Market Data Ingress $\to$ Strategy Decision $\to$ Network Wire $\to$ Exchange Gateway ($10\mu s \to 500\mu s$).
        </p>
      </div>

      {/* Latency Comparison Table */}
      <div className="terminal-panel">
        <div className="terminal-header">
          <span className="panel-title">
            SIMULATED LATENCY PROFILES VS EXECUTION ALPHA
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            N=150,000 EVENTS
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="terminal-table">
            <thead>
              <tr>
                <th>PROFILE</th>
                <th>LATENCY (NS)</th>
                <th>FILL RATE (%)</th>
                <th>SPREAD CAPTURED</th>
                <th>ADVERSE SELECTION</th>
                <th>NET P&L</th>
                <th>SHARPE RATIO</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {sweep.map((row, idx) => {
                const isSelected = row.latency === selectedProfile;
                return (
                  <tr 
                    key={idx}
                    onClick={() => setSelectedProfile(row.latency)}
                    style={{ 
                      cursor: 'pointer',
                      background: isSelected ? 'var(--bg-row-selected)' : 'transparent'
                    }}
                  >
                    <td className="font-mono" style={{ fontWeight: '600', color: isSelected ? 'var(--color-blue)' : 'var(--text-primary)' }}>
                      {row.latency}
                    </td>
                    <td className="font-mono" style={{ color: 'var(--text-muted)' }}>
                      {(row.latency_ns / 1000).toFixed(0)} μs
                    </td>
                    <td className="font-mono" style={{ fontWeight: '600', color: row.fill_rate_percent > 60 ? 'var(--color-green)' : 'var(--color-amber)' }}>
                      {row.fill_rate_percent}%
                    </td>
                    <td className="font-mono" style={{ color: 'var(--color-green)' }}>
                      +{row.spread_captured_bps} bps
                    </td>
                    <td className="font-mono" style={{ color: 'var(--color-red)' }}>
                      -{row.adverse_selection_bps} bps
                    </td>
                    <td className="font-mono" style={{ fontWeight: '600', color: row.net_pnl_bps >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                      {row.net_pnl_bps >= 0 ? `+${row.net_pnl_bps}` : row.net_pnl_bps} bps
                    </td>
                    <td className="font-mono" style={{ color: row.sharpe_ratio > 0 ? 'var(--color-blue)' : 'var(--color-red)' }}>
                      {row.sharpe_ratio}
                    </td>
                    <td>
                      <span className={`status-pill ${isSelected ? 'real' : 'neutral'}`}>
                        {isSelected ? 'SELECTED' : 'INSPECT'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4-Stage Pipeline Breakdown for selected profile */}
      <div className="terminal-panel">
        <div className="terminal-header">
          <span className="panel-title">
            4-STAGE LATENCY DECOMPOSITION FOR [{activeRow.latency.toUpperCase()}] PROFILE
          </span>
          <span className="font-mono" style={{ fontSize: '11px', color: 'var(--color-amber)', fontWeight: '600' }}>
            TOTAL BUDGET: {(activeRow.latency_ns / 1000).toFixed(1)} μs
          </span>
        </div>

        <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
          <div className="metric-box" style={{ minWidth: 0 }}>
            <span className="metric-label" style={{ wordBreak: 'break-word' }}>1. INGRESS (20%)</span>
            <div className="metric-val font-mono" style={{ color: 'var(--color-blue)' }}>
              {(activeRow.latency_ns * 0.2 / 1000).toFixed(1)} μs
            </div>
            <span className="metric-sub" style={{ fontSize: '10px' }}>NIC hardware timestamp</span>
          </div>

          <div className="metric-box" style={{ minWidth: 0 }}>
            <span className="metric-label" style={{ wordBreak: 'break-word' }}>2. STRATEGY (10%)</span>
            <div className="metric-val font-mono" style={{ color: 'var(--color-green)' }}>
              {(activeRow.latency_ns * 0.1 / 1000).toFixed(1)} μs
            </div>
            <span className="metric-sub" style={{ fontSize: '10px' }}>C++ pricing & risk check</span>
          </div>

          <div className="metric-box" style={{ minWidth: 0 }}>
            <span className="metric-label" style={{ wordBreak: 'break-word' }}>3. WIRE EGRESS (50%)</span>
            <div className="metric-val font-mono" style={{ color: 'var(--color-amber)' }}>
              {(activeRow.latency_ns * 0.5 / 1000).toFixed(1)} μs
            </div>
            <span className="metric-sub" style={{ fontSize: '10px' }}>Fiber cross-connect</span>
          </div>

          <div className="metric-box" style={{ minWidth: 0 }}>
            <span className="metric-label" style={{ wordBreak: 'break-word' }}>4. GATEWAY (20%)</span>
            <div className="metric-val font-mono" style={{ color: 'var(--color-purple)' }}>
              {(activeRow.latency_ns * 0.2 / 1000).toFixed(1)} μs
            </div>
            <span className="metric-sub" style={{ fontSize: '10px' }}>Matching queue insertion</span>
          </div>
        </div>
      </div>
    </div>
  );
}
