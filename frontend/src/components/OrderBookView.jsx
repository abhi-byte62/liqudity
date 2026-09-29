import React from 'react';
import { Activity, Layers } from 'lucide-react';

function computeDepthCumulative(items, maxCount = 12) {
  const result = [];
  let cum = 0;
  const slice = items.slice(0, maxCount);
  for (let i = 0; i < slice.length; i++) {
    cum += slice[i].quantity;
    result.push({ ...slice[i], cum });
  }
  return result;
}

export default function OrderBookView({ snapshot }) {
  if (!snapshot) {
    return (
      <div className="terminal-panel" style={{ padding: '32px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>[SYNCHRONIZING WITH C++ ENGINE STREAM...]</p>
      </div>
    );
  }

  const {
    best_bid = 65000,
    best_ask = 65000.5,
    mid_price = 65000.25,
    spread = 0.5,
    spread_bps = 0.08,
    micro_price = 65000.27,
    obi = 0.15,
    bids = [],
    asks = [],
    trade_tape = []
  } = snapshot;

  const maxBidQty = Math.max(...bids.map(b => b.quantity), 1);
  const maxAskQty = Math.max(...asks.map(a => a.quantity), 1);
  const maxDepthQty = Math.max(maxBidQty, maxAskQty, 1);

  const bidsWithCum = computeDepthCumulative(bids, 12);
  const asksWithCum = computeDepthCumulative(asks, 12);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Top Metric Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
        <div className="metric-box">
          <span className="metric-label">MID PRICE</span>
          <div className="metric-val" style={{ color: 'var(--text-primary)' }}>
            ${mid_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="metric-sub">
            Micro: <span className="font-mono" style={{ color: 'var(--color-blue)' }}>${micro_price.toFixed(2)}</span>
          </span>
        </div>

        <div className="metric-box">
          <span className="metric-label">SPREAD (TOUCH)</span>
          <div className="metric-val font-mono" style={{ color: 'var(--color-amber)' }}>
            ${spread.toFixed(2)}
          </div>
          <span className="metric-sub">
            <span className="font-mono">{spread_bps.toFixed(2)} bps</span> (${best_bid.toFixed(2)} / ${best_ask.toFixed(2)})
          </span>
        </div>

        <div className="metric-box">
          <span className="metric-label">ORDER BOOK IMBALANCE (OBI)</span>
          <div className="metric-val font-mono" style={{ color: obi >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
            {obi >= 0 ? `+${obi.toFixed(3)}` : obi.toFixed(3)}
          </div>
          <div style={{ width: '100%', height: '3px', background: 'var(--border-subtle)', marginTop: '4px', position: 'relative' }}>
            <div style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: '50%',
              width: `${Math.abs(obi) * 50}%`,
              transform: obi < 0 ? 'translateX(-100%)' : 'none',
              background: obi >= 0 ? 'var(--color-green)' : 'var(--color-red)'
            }} />
          </div>
        </div>

        <div className="metric-box">
          <span className="metric-label">HAWKES ARRIVAL RATE</span>
          <div className="metric-val font-mono" style={{ color: 'var(--color-purple)' }}>
            1,240 <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ev/s</span>
          </div>
          <span className="metric-sub">
            Self-Excitation: <span className="font-mono" style={{ color: 'var(--color-purple)' }}>α = 0.85 (Subcritical)</span>
          </span>
        </div>
      </div>

      {/* Main Order Book Ladder + Trade Tape */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '12px' }}>
        {/* Limit Order Book Depth Ladder */}
        <div className="terminal-panel">
          <div className="terminal-header">
            <span className="panel-title">
              <Layers size={13} />
              LEVEL 2 / LEVEL 3 ORDER BOOK LADDER
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              1 TICK = $0.01
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--border-subtle)' }}>
            {/* Bid Side Header */}
            <div style={{ padding: '6px 10px', background: 'rgba(63, 185, 80, 0.04)', borderRight: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: '600', color: 'var(--color-green)' }}>
              <span>SIZE</span>
              <span>CUMULATIVE</span>
              <span>BID PRICE</span>
            </div>

            {/* Ask Side Header */}
            <div style={{ padding: '6px 10px', background: 'rgba(248, 81, 73, 0.04)', display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: '600', color: 'var(--color-red)' }}>
              <span>ASK PRICE</span>
              <span>SIZE</span>
              <span>CUMULATIVE</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            {/* Bids Ladder */}
            <div style={{ borderRight: '1px solid var(--border-subtle)' }}>
              {bidsWithCum.map((b, idx) => {
                const depthPercent = (b.quantity / maxDepthQty) * 100;
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      position: 'relative',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.02)'
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: `${depthPercent}%`,
                      background: 'rgba(63, 185, 80, 0.08)',
                      zIndex: 0
                    }} />
                    <span style={{ position: 'relative', zIndex: 1, color: 'var(--text-primary)' }}>
                      {b.quantity.toLocaleString()}
                    </span>
                    <span style={{ position: 'relative', zIndex: 1, color: 'var(--text-muted)' }}>
                      {b.cum.toLocaleString()}
                    </span>
                    <span style={{ position: 'relative', zIndex: 1, fontWeight: '600', color: 'var(--color-green)' }}>
                      ${b.price.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Asks Ladder */}
            <div>
              {asksWithCum.map((a, idx) => {
                const depthPercent = (a.quantity / maxDepthQty) * 100;
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      position: 'relative',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.02)'
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${depthPercent}%`,
                      background: 'rgba(248, 81, 73, 0.08)',
                      zIndex: 0
                    }} />
                    <span style={{ position: 'relative', zIndex: 1, fontWeight: '600', color: 'var(--color-red)' }}>
                      ${a.price.toFixed(2)}
                    </span>
                    <span style={{ position: 'relative', zIndex: 1, color: 'var(--text-primary)' }}>
                      {a.quantity.toLocaleString()}
                    </span>
                    <span style={{ position: 'relative', zIndex: 1, color: 'var(--text-muted)' }}>
                      {a.cum.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Trade Tape (L3 Executions) */}
        <div className="terminal-panel">
          <div className="terminal-header">
            <span className="panel-title">
              <Activity size={13} />
              EXECUTION TAPE (RAW TICKS)
            </span>
            <span className="status-pill neutral">REALTIME</span>
          </div>

          <table className="terminal-table">
            <thead>
              <tr>
                <th>SIDE</th>
                <th>PRICE</th>
                <th>QTY</th>
                <th>ROLE</th>
              </tr>
            </thead>
            <tbody>
              {trade_tape.map((t, idx) => {
                const isBuy = t.side === 'BUY';
                return (
                  <tr key={idx}>
                    <td>
                      <span className={`status-pill ${isBuy ? 'real' : 'danger'}`}>
                        {isBuy ? 'BUY' : 'SELL'}
                      </span>
                    </td>
                    <td className="font-mono" style={{ fontWeight: '600', color: isBuy ? 'var(--color-green)' : 'var(--color-red)' }}>
                      ${t.price.toFixed(2)}
                    </td>
                    <td className="font-mono" style={{ color: 'var(--text-primary)' }}>
                      {t.quantity.toLocaleString()}
                    </td>
                    <td style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {isBuy ? 'Taker Buy' : 'Taker Sell'}
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
