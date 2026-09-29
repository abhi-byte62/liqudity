import React from 'react';
import { TrendingDown } from 'lucide-react';

export default function AdverseSelectionView({ simResult }) {
  const markouts = simResult?.markouts || [
    { horizon: '1ms', horizon_ns: 1000000, adverse_prob: 0.78, mean_markout_bps: -0.007, mean_adverse_loss_bps: 0.010 },
    { horizon: '5ms', horizon_ns: 5000000, adverse_prob: 0.60, mean_markout_bps: -0.008, mean_adverse_loss_bps: 0.025 },
    { horizon: '10ms', horizon_ns: 10000000, adverse_prob: 0.61, mean_markout_bps: -0.009, mean_adverse_loss_bps: 0.032 },
    { horizon: '50ms', horizon_ns: 50000000, adverse_prob: 0.55, mean_markout_bps: -0.009, mean_adverse_loss_bps: 0.058 },
    { horizon: '100ms', horizon_ns: 100000000, adverse_prob: 0.55, mean_markout_bps: -0.009, mean_adverse_loss_bps: 0.055 },
    { horizon: '500ms', horizon_ns: 500000000, adverse_prob: 0.53, mean_markout_bps: -0.009, mean_adverse_loss_bps: 0.057 },
    { horizon: '1s', horizon_ns: 1000000000, adverse_prob: 0.53, mean_markout_bps: -0.009, mean_adverse_loss_bps: 0.057 }
  ];

  const spreadCaptureBps = simResult?.spread_captured_bps ?? 1.50;
  const adverseLossBps = simResult?.adverse_selection_bps ?? 1.10;
  const feesPaidBps = simResult?.fees_paid_bps ?? 0.20;
  const slippageBps = simResult?.slippage_bps ?? 0.10;
  const inventoryCostBps = simResult?.inventory_cost_bps ?? 0.30;
  const netPnlBps = simResult?.net_pnl_bps ?? (spreadCaptureBps - adverseLossBps - feesPaidBps - slippageBps - inventoryCostBps);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Header Info */}
      <div className="terminal-panel" style={{ padding: '12px 16px' }}>
        <span className="panel-title" style={{ fontSize: '13px' }}>
          <TrendingDown size={14} color="var(--color-red)" />
          POST-TRADE MARKOUT & ADVERSE SELECTION DECOMPOSITION
        </span>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          Evaluating post-fill price drift: When passive limit orders get filled, what is the probability and magnitude of immediate price movement against the quote?
        </p>
      </div>

      {/* Statement-style Expected Economics Decomposition */}
      <div className="terminal-panel">
        <div className="terminal-header">
          <span className="panel-title">
            EXPECTED LIQUIDITY PROVISION STATEMENT: E[PnL]
          </span>
          <span className={`status-pill ${netPnlBps >= 0 ? 'real' : 'danger'}`}>
            NET REALIZED EDGE: {netPnlBps >= 0 ? `+${netPnlBps.toFixed(2)} bps` : `${netPnlBps.toFixed(2)} bps`}
          </span>
        </div>

        <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '8px' }}>
          <div className="metric-box">
            <span className="metric-label">+ SPREAD CAPTURE</span>
            <div className="metric-val font-mono" style={{ color: 'var(--color-green)' }}>
              +{spreadCaptureBps.toFixed(2)} <span style={{ fontSize: '11px' }}>bps</span>
            </div>
            <span className="metric-sub">Gross bid-ask half-spread</span>
          </div>

          <div className="metric-box">
            <span className="metric-label">- ADVERSE SELECTION</span>
            <div className="metric-val font-mono" style={{ color: 'var(--color-red)' }}>
              -{adverseLossBps.toFixed(2)} <span style={{ fontSize: '11px' }}>bps</span>
            </div>
            <span className="metric-sub">Toxic informed flow drift</span>
          </div>

          <div className="metric-box">
            <span className="metric-label">- EXCHANGE MAKER FEE</span>
            <div className="metric-val font-mono" style={{ color: feesPaidBps <= 0 ? 'var(--color-green)' : 'var(--color-amber)' }}>
              {feesPaidBps <= 0 ? `+${Math.abs(feesPaidBps).toFixed(2)}` : `-${feesPaidBps.toFixed(2)}`} <span style={{ fontSize: '11px' }}>bps</span>
            </div>
            <span className="metric-sub">Exchange liquidity rebate/fee</span>
          </div>

          <div className="metric-box">
            <span className="metric-label">- LATENCY SLIPPAGE</span>
            <div className="metric-val font-mono" style={{ color: 'var(--color-amber)' }}>
              -{slippageBps.toFixed(2)} <span style={{ fontSize: '11px' }}>bps</span>
            </div>
            <span className="metric-sub">Delayed quote update penalty</span>
          </div>

          <div className="metric-box">
            <span className="metric-label">- INVENTORY COST</span>
            <div className="metric-val font-mono" style={{ color: 'var(--color-purple)' }}>
              -{inventoryCostBps.toFixed(2)} <span style={{ fontSize: '11px' }}>bps</span>
            </div>
            <span className="metric-sub">Avellaneda inventory risk</span>
          </div>
        </div>
      </div>

      {/* Multi-Horizon Table */}
      <div className="terminal-panel">
        <div className="terminal-header">
          <span className="panel-title">
            EMPIRICAL MULTI-HORIZON MARKOUT CURVES
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            SIGN CONVENTION: POSITIVE = MAKER GAIN, NEGATIVE = ADVERSE LOSS
          </span>
        </div>

        <table className="terminal-table">
          <thead>
            <tr>
              <th>HORIZON (τ)</th>
              <th>HORIZON (NS)</th>
              <th>P(ADVERSE DRIFT)</th>
              <th>MEAN MARKOUT</th>
              <th>MEAN ADVERSE LOSS</th>
              <th>TOXICITY PROBABILITY</th>
            </tr>
          </thead>
          <tbody>
            {markouts.map((m, idx) => {
              const advPercent = (m.adverse_prob * 100).toFixed(1);
              return (
                <tr key={idx}>
                  <td className="font-mono" style={{ fontWeight: '600', color: 'var(--color-blue)' }}>
                    {m.horizon}
                  </td>
                  <td className="font-mono" style={{ color: 'var(--text-muted)' }}>
                    {m.horizon_ns.toLocaleString()} ns
                  </td>
                  <td className="font-mono" style={{ fontWeight: '600', color: m.adverse_prob > 0.6 ? 'var(--color-red)' : 'var(--color-amber)' }}>
                    {advPercent}%
                  </td>
                  <td className="font-mono" style={{ color: m.mean_markout_bps < 0 ? 'var(--color-red)' : 'var(--color-green)' }}>
                    {m.mean_markout_bps > 0 ? `+${m.mean_markout_bps.toFixed(4)}` : m.mean_markout_bps.toFixed(4)} bps
                  </td>
                  <td className="font-mono" style={{ color: 'var(--color-red)' }}>
                    -{m.mean_adverse_loss_bps.toFixed(4)} bps
                  </td>
                  <td style={{ width: '160px' }}>
                    <div style={{ width: '100%', height: '4px', background: 'var(--border-subtle)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${advPercent}%`,
                        height: '100%',
                        background: m.adverse_prob > 0.6 ? 'var(--color-red)' : 'var(--color-amber)'
                      }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
