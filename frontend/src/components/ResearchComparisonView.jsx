import React, { useState } from 'react';
import { GitCompare, ArrowRight, TrendingUp, TrendingDown, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ResearchComparisonView({ comparisonData }) {
  const [expA, setExpA] = useState('25us');
  const [expB, setExpB] = useState('100us');

  const defaultScenarios = {
    '10us': { name: '10 μs (Ultra HFT)', fillRate: 88.5, adverseSel: 14.2, spreadCap: 1.85, netPnl: 0.95, pnlUsd: 16820, sharpe: 4.85 },
    '25us': { name: '25 μs (Colocated MM)', fillRate: 78.2, adverseSel: 18.0, spreadCap: 1.70, netPnl: 0.55, pnlUsd: 13882, sharpe: 3.92 },
    '50us': { name: '50 μs (Direct Gateway)', fillRate: 69.4, adverseSel: 21.5, spreadCap: 1.55, netPnl: 0.15, pnlUsd: 8420, sharpe: 2.45 },
    '100us': { name: '100 μs (Standard MM)', fillRate: 58.1, adverseSel: 25.0, spreadCap: 1.35, netPnl: -0.30, pnlUsd: -2410, sharpe: -0.65 },
    '250us': { name: '250 μs (Cloud Hosted)', fillRate: 44.0, adverseSel: 31.2, spreadCap: 1.15, netPnl: -0.90, pnlUsd: -8540, sharpe: -2.10 },
    '500us': { name: '500 μs (Retail API)', fillRate: 32.5, adverseSel: 38.6, spreadCap: 0.95, netPnl: -1.45, pnlUsd: -14200, sharpe: -3.85 }
  };

  const a = defaultScenarios[expA] || defaultScenarios['25us'];
  const b = defaultScenarios[expB] || defaultScenarios['100us'];

  const deltaFill = a.fillRate - b.fillRate;
  const deltaAdv = a.adverseSel - b.adverseSel;
  const deltaSpread = a.spreadCap - b.spreadCap;
  const deltaNetPnl = a.netPnl - b.netPnl;
  const deltaPnlUsd = a.pnlUsd - b.pnlUsd;

  return (
    <div style={{ padding: '0 20px 24px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <GitCompare size={20} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
            A/B Research Comparison Studio
          </h2>
          <span className="badge badge-cyan">Quant Portfolio Feature</span>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Side-by-side comparative analysis of system parameters (Latency, Risk Aversion, Spread Regimes) on execution quality and P&L.
        </p>
      </div>

      {/* Selectors Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-cyan)' }}>Scenario A:</span>
          <select
            value={expA}
            onChange={(e) => setExpA(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid var(--accent-cyan)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: '600'
            }}
          >
            {Object.keys(defaultScenarios).map(k => (
              <option key={k} value={k}>{defaultScenarios[k].name}</option>
            ))}
          </select>
        </div>

        <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-muted)' }}>VS</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-purple)' }}>Scenario B:</span>
          <select
            value={expB}
            onChange={(e) => setExpB(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid var(--accent-purple)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: '600'
            }}
          >
            {Object.keys(defaultScenarios).map(k => (
              <option key={k} value={k}>{defaultScenarios[k].name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Comparative Cards Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>
          <div>METRIC</div>
          <div style={{ color: 'var(--accent-cyan)' }}>EXPERIMENT A ({expA})</div>
          <div style={{ color: 'var(--accent-purple)' }}>EXPERIMENT B ({expB})</div>
          <div>DELTA (A - B)</div>
        </div>

        {/* Fill Rate */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '16px', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: '700', color: '#fff', fontSize: '14px' }}>Fill Rate (%)</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Percentage of placed limit orders executed</div>
          </div>
          <div className="mono-num" style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent-cyan)' }}>{a.fillRate}%</div>
          <div className="mono-num" style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent-purple)' }}>{b.fillRate}%</div>
          <div>
            <span className={`badge ${deltaFill >= 0 ? 'badge-green' : 'badge-red'}`}>
              {deltaFill >= 0 ? `+${deltaFill.toFixed(1)}%` : `${deltaFill.toFixed(1)}%`}
            </span>
          </div>
        </div>

        {/* Adverse Selection Rate */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '16px', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: '700', color: '#fff', fontSize: '14px' }}>Adverse Selection Rate (%)</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Probability of market moving against post-fill</div>
          </div>
          <div className="mono-num" style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent-cyan)' }}>{a.adverseSel}%</div>
          <div className="mono-num" style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent-purple)' }}>{b.adverseSel}%</div>
          <div>
            <span className={`badge ${deltaAdv <= 0 ? 'badge-green' : 'badge-red'}`}>
              {deltaAdv <= 0 ? `${deltaAdv.toFixed(1)}% (Safer)` : `+${deltaAdv.toFixed(1)}% (Toxic)`}
            </span>
          </div>
        </div>

        {/* Spread Capture */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '16px', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: '700', color: '#fff', fontSize: '14px' }}>Spread Capture (bps)</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Gross spread earned on fills</div>
          </div>
          <div className="mono-num" style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent-cyan)' }}>+{a.spreadCap} bps</div>
          <div className="mono-num" style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent-purple)' }}>+{b.spreadCap} bps</div>
          <div>
            <span className={`badge ${deltaSpread >= 0 ? 'badge-green' : 'badge-red'}`}>
              {deltaSpread >= 0 ? `+${deltaSpread.toFixed(2)} bps` : `${deltaSpread.toFixed(2)} bps`}
            </span>
          </div>
        </div>

        {/* Net P&L (bps) */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '16px', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: '700', color: '#fff', fontSize: '14px' }}>Net P&L (bps)</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Spread - Adverse Selection - Fees - Slippage</div>
          </div>
          <div className="mono-num" style={{ fontSize: '18px', fontWeight: '800', color: a.netPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {a.netPnl >= 0 ? `+${a.netPnl}` : a.netPnl} bps
          </div>
          <div className="mono-num" style={{ fontSize: '18px', fontWeight: '800', color: b.netPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {b.netPnl >= 0 ? `+${b.netPnl}` : b.netPnl} bps
          </div>
          <div>
            <span className={`badge ${deltaNetPnl >= 0 ? 'badge-green' : 'badge-red'}`}>
              {deltaNetPnl >= 0 ? `+${deltaNetPnl.toFixed(2)} bps Edge` : `${deltaNetPnl.toFixed(2)} bps Decay`}
            </span>
          </div>
        </div>

        {/* Total PnL USD */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '16px', padding: '14px 0', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: '700', color: '#fff', fontSize: '14px' }}>Total P&L (USD)</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Net realized & mark-to-market revenue</div>
          </div>
          <div className="mono-num" style={{ fontSize: '18px', fontWeight: '800', color: a.pnlUsd >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            ${a.pnlUsd.toLocaleString()}
          </div>
          <div className="mono-num" style={{ fontSize: '18px', fontWeight: '800', color: b.pnlUsd >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            ${b.pnlUsd.toLocaleString()}
          </div>
          <div>
            <span className={`badge ${deltaPnlUsd >= 0 ? 'badge-green' : 'badge-red'}`}>
              {deltaPnlUsd >= 0 ? `+$${deltaPnlUsd.toLocaleString()}` : `-$${Math.abs(deltaPnlUsd).toLocaleString()}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
