import React from 'react';
import { Target, TrendingDown, DollarSign, ShieldAlert, AlertCircle, ArrowDownRight, Layers } from 'lucide-react';

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
    <div style={{ padding: '0 20px 24px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <Target size={20} color="var(--accent-red)" />
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
            Adverse Selection & Post-Fill Markout Engine
          </h2>
          <span className="badge badge-red">Quant Research Core</span>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Quantifying the trade-off: A liquidity provider captures the bid-ask spread but gets adversely selected when informed order flow moves the market immediately post-fill.
        </p>
      </div>

      {/* Expected Economics Decomposition Formula Card */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
            Expected Economics Decomposition: E[PnL]
          </h3>
          <span className={`badge ${netPnlBps >= 0 ? 'badge-green' : 'badge-red'}`}>
            Net Expected P&L: {netPnlBps >= 0 ? `+${netPnlBps.toFixed(2)} bps` : `${netPnlBps.toFixed(2)} bps`}
          </span>
        </div>

        {/* Math Formula Card Visual */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
          background: 'rgba(11, 19, 32, 0.6)',
          padding: '16px',
          borderRadius: '10px',
          border: '1px solid var(--border-color)'
        }}>
          {/* Spread Capture */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>+ Spread Capture</span>
            <div className="mono-num" style={{ fontSize: '20px', fontWeight: '700', color: 'var(--accent-green)' }}>
              +{spreadCaptureBps.toFixed(2)} <span style={{ fontSize: '12px' }}>bps</span>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Passive premium</span>
          </div>

          {/* Adverse Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>- Adverse Selection</span>
            <div className="mono-num" style={{ fontSize: '20px', fontWeight: '700', color: 'var(--accent-red)' }}>
              -{adverseLossBps.toFixed(2)} <span style={{ fontSize: '12px' }}>bps</span>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Post-fill toxic drift</span>
          </div>

          {/* Exchange Fees */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>- Fees (Maker)</span>
            <div className="mono-num" style={{ fontSize: '20px', fontWeight: '700', color: feesPaidBps <= 0 ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
              {feesPaidBps <= 0 ? `+${Math.abs(feesPaidBps).toFixed(2)}` : `-${feesPaidBps.toFixed(2)}`} <span style={{ fontSize: '12px' }}>bps</span>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Maker rebate/fee</span>
          </div>

          {/* Slippage */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>- Latency Slippage</span>
            <div className="mono-num" style={{ fontSize: '20px', fontWeight: '700', color: 'var(--accent-amber)' }}>
              -{slippageBps.toFixed(2)} <span style={{ fontSize: '12px' }}>bps</span>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Queue degradation</span>
          </div>

          {/* Inventory Cost */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>- Inventory Cost</span>
            <div className="mono-num" style={{ fontSize: '20px', fontWeight: '700', color: 'var(--accent-purple)' }}>
              -{inventoryCostBps.toFixed(2)} <span style={{ fontSize: '12px' }}>bps</span>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Risk penalty</span>
          </div>
        </div>
      </div>

      {/* Markout Horizons Multi-Horizon Table & Visualizer */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#f8fafc', marginBottom: '14px' }}>
          Multi-Horizon Post-Fill Markout Curves
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left', height: '36px' }}>
                <th style={{ padding: '8px 12px' }}>Horizon (τ)</th>
                <th style={{ padding: '8px 12px' }}>P(Adverse Move)</th>
                <th style={{ padding: '8px 12px' }}>Mean Markout</th>
                <th style={{ padding: '8px 12px' }}>Adverse Loss (bps)</th>
                <th style={{ padding: '8px 12px' }}>Toxicity Meter</th>
              </tr>
            </thead>
            <tbody>
              {markouts.map((m, idx) => {
                const advProbPercent = (m.adverse_prob * 100).toFixed(1);
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', height: '44px' }}>
                    <td style={{ padding: '8px 12px', fontWeight: '700', color: 'var(--accent-cyan)' }}>
                      {m.horizon}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span className="mono-num" style={{ fontWeight: '600', color: m.adverse_prob > 0.6 ? 'var(--accent-red)' : 'var(--accent-amber)' }}>
                        {advProbPercent}%
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span className="mono-num" style={{ fontWeight: '600', color: m.mean_markout_bps < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                        {m.mean_markout_bps > 0 ? `+${m.mean_markout_bps.toFixed(4)}` : m.mean_markout_bps.toFixed(4)} bps
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span className="mono-num" style={{ fontWeight: '600', color: 'var(--accent-red)' }}>
                        -{m.mean_adverse_loss_bps.toFixed(4)} bps
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      {/* Visual probability bar */}
                      <div style={{ width: '120px', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${advProbPercent}%`,
                          height: '100%',
                          background: m.adverse_prob > 0.6 ? 'var(--accent-red)' : 'var(--accent-amber)',
                          borderRadius: '4px'
                        }}></div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
