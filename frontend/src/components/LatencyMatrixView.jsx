import React, { useState } from 'react';
import { Zap, Clock, TrendingDown, ArrowRight, ShieldCheck, DollarSign } from 'lucide-react';

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
    <div style={{ padding: '0 20px 24px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <Zap size={20} color="var(--accent-amber)" />
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
            Latency Sensitivity & Quant Dev Performance Matrix
          </h2>
          <span className="badge badge-amber">Microsecond Execution Architecture</span>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Comparing 4-stage pipeline latency ($10\mu s \to 500\mu s$): Market Data Ingress $\to$ Strategy Decision $\to$ Network Wire $\to$ Exchange Gateway.
        </p>
      </div>

      {/* Latency Matrix Table */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#f8fafc', marginBottom: '14px' }}>
          Microsecond Latency Comparison Matrix
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left', height: '36px' }}>
                <th style={{ padding: '8px 12px' }}>Profile</th>
                <th style={{ padding: '8px 12px' }}>Total Latency</th>
                <th style={{ padding: '8px 12px' }}>Fill Rate (%)</th>
                <th style={{ padding: '8px 12px' }}>Spread Capture</th>
                <th style={{ padding: '8px 12px' }}>Adverse Selection</th>
                <th style={{ padding: '8px 12px' }}>Net P&L (bps)</th>
                <th style={{ padding: '8px 12px' }}>Sharpe Ratio</th>
                <th style={{ padding: '8px 12px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sweep.map((row, idx) => {
                const isSelected = row.latency === selectedProfile;
                return (
                  <tr 
                    key={idx} 
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      height: '46px',
                      background: isSelected ? 'rgba(0, 240, 255, 0.08)' : 'transparent',
                      transition: 'background 0.2s'
                    }}
                  >
                    <td style={{ padding: '8px 12px', fontWeight: '700', color: isSelected ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
                      {row.latency}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span className="mono-num" style={{ color: 'var(--text-secondary)' }}>
                        {(row.latency_ns / 1000).toFixed(0)} μs
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span className="mono-num" style={{ fontWeight: '600', color: row.fill_rate_percent > 60 ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
                        {row.fill_rate_percent}%
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span className="mono-num" style={{ color: 'var(--accent-green)' }}>
                        +{row.spread_captured_bps} bps
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span className="mono-num" style={{ color: 'var(--accent-red)' }}>
                        -{row.adverse_selection_bps} bps
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span className="mono-num" style={{ fontWeight: '700', color: row.net_pnl_bps >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {row.net_pnl_bps >= 0 ? `+${row.net_pnl_bps}` : row.net_pnl_bps} bps
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span className="mono-num" style={{ color: row.sharpe_ratio > 0 ? 'var(--accent-cyan)' : 'var(--accent-red)' }}>
                        {row.sharpe_ratio}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <button
                        onClick={() => setSelectedProfile(row.latency)}
                        className={`btn-quant ${isSelected ? '' : 'btn-secondary'}`}
                        style={{ padding: '4px 10px', fontSize: '11px' }}
                      >
                        {isSelected ? 'Active' : 'Inspect'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Latency Profile Breakdown Card */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>
          4-Stage Latency Pipeline Breakdown for {activeRow.latency} Profile
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '12px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>1. Market Data Ingress</span>
            <div className="mono-num" style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent-cyan)', marginTop: '4px' }}>
              {(activeRow.latency_ns * 0.2 / 1000).toFixed(1)} μs
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>NIC timestamp to engine</span>
          </div>

          <div style={{ padding: '12px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>2. Strategy Compute Time</span>
            <div className="mono-num" style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent-green)', marginTop: '4px' }}>
              {(activeRow.latency_ns * 0.1 / 1000).toFixed(1)} μs
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>C++ pricing & risk checks</span>
          </div>

          <div style={{ padding: '12px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>3. Network Wire Egress</span>
            <div className="mono-num" style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent-amber)', marginTop: '4px' }}>
              {(activeRow.latency_ns * 0.5 / 1000).toFixed(1)} μs
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Cross-connect fiber optic</span>
          </div>

          <div style={{ padding: '12px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>4. Exchange Matching Entry</span>
            <div className="mono-num" style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent-purple)', marginTop: '4px' }}>
              {(activeRow.latency_ns * 0.2 / 1000).toFixed(1)} μs
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Matching engine queue insertion</span>
          </div>
        </div>
      </div>
    </div>
  );
}
