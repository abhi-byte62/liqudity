import React, { useState, useEffect } from 'react';
import { Layers, Activity, ArrowDownRight, ArrowUpRight, Flame, BarChart } from 'lucide-react';

export default function OrderBookView({ snapshot, onRefresh }) {
  if (!snapshot) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', margin: '0 20px' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading Order Book Snapshot...</p>
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

  const maxBidQty = Math.max(...bids.map(b => b.quantity), 100);
  const maxAskQty = Math.max(...asks.map(a => a.quantity), 100);
  const maxDepthQty = Math.max(maxBidQty, maxAskQty);

  return (
    <div style={{ padding: '0 20px 24px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Microstructure Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {/* Mid Price */}
        <div className="glass-panel" style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Mid Price</span>
            <Activity size={15} color="var(--accent-cyan)" />
          </div>
          <div className="mono-num" style={{ fontSize: '22px', fontWeight: '700', color: '#f8fafc' }}>
            ${mid_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Micro-Price: <span className="mono-num" style={{ color: 'var(--accent-cyan)' }}>${micro_price.toFixed(2)}</span>
          </div>
        </div>

        {/* Spread */}
        <div className="glass-panel" style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Spread (Touch)</span>
            <span className="badge badge-amber">{spread_bps.toFixed(2)} bps</span>
          </div>
          <div className="mono-num" style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent-amber)' }}>
            ${spread.toFixed(2)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Bid: <span style={{ color: 'var(--accent-green)' }}>${best_bid.toFixed(2)}</span> • Ask: <span style={{ color: 'var(--accent-red)' }}>${best_ask.toFixed(2)}</span>
          </div>
        </div>

        {/* Order Book Imbalance (OBI) */}
        <div className="glass-panel" style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Order Book Imbalance (OBI)</span>
            <span className={`badge ${obi > 0 ? 'badge-green' : 'badge-red'}`}>
              {obi > 0 ? 'Buy Heavy' : 'Sell Heavy'}
            </span>
          </div>
          <div className="mono-num" style={{ fontSize: '22px', fontWeight: '700', color: obi > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {obi > 0 ? `+${obi.toFixed(3)}` : obi.toFixed(3)}
          </div>
          {/* Visual OBI bar */}
          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginTop: '8px', overflow: 'hidden', position: 'relative' }}>
            <div style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: '50%',
              width: `${Math.abs(obi) * 50}%`,
              transform: obi < 0 ? 'translateX(-100%)' : 'none',
              background: obi > 0 ? 'var(--accent-green)' : 'var(--accent-red)',
              borderRadius: '3px'
            }}></div>
          </div>
        </div>

        {/* Hawkes Arrival Intensity */}
        <div className="glass-panel" style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Hawkes Flow Intensity</span>
            <Flame size={15} color="var(--accent-purple)" />
          </div>
          <div className="mono-num" style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent-purple)' }}>
            1,240 <span style={{ fontSize: '13px', fontWeight: '400', color: 'var(--text-muted)' }}>ev/sec</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Self-Excitation Jump: <span className="mono-num" style={{ color: 'var(--accent-purple)' }}>α = 0.85</span>
          </div>
        </div>
      </div>

      {/* Main Order Book Ladder & Trade Tape Split */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
        {/* Limit Order Book Depth Ladder */}
        <div className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="var(--accent-cyan)" />
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Limit Order Book Depth (L2/L3)</h3>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span>Price (USD)</span>
              <span>Size</span>
              <span>Total Depth</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Bids Ladder (Buy side) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', fontSize: '11px', fontWeight: '700', color: 'var(--accent-green)', borderBottom: '1px solid rgba(16, 185, 129, 0.2)', marginBottom: '6px' }}>
                <span>BUY ORDERS (BIDS)</span>
                <span>QTY</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {bids.slice(0, 10).map((bid, idx) => {
                  const depthPercent = (bid.quantity / maxDepthQty) * 100;
                  return (
                    <div 
                      key={idx} 
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        position: 'relative',
                        overflow: 'hidden',
                        background: 'rgba(16, 185, 129, 0.03)'
                      }}
                    >
                      {/* Depth Bar Background */}
                      <div style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: `${depthPercent}%`,
                        background: 'rgba(16, 185, 129, 0.15)',
                        zIndex: 0
                      }}></div>

                      <span className="mono-num" style={{ position: 'relative', zIndex: 1, fontWeight: '700', color: 'var(--accent-green)' }}>
                        ${bid.price.toFixed(2)}
                      </span>
                      <span className="mono-num" style={{ position: 'relative', zIndex: 1, color: 'var(--text-secondary)' }}>
                        {bid.quantity.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Asks Ladder (Sell side) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', fontSize: '11px', fontWeight: '700', color: 'var(--accent-red)', borderBottom: '1px solid rgba(244, 63, 94, 0.2)', marginBottom: '6px' }}>
                <span>SELL ORDERS (ASKS)</span>
                <span>QTY</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {asks.slice(0, 10).map((ask, idx) => {
                  const depthPercent = (ask.quantity / maxDepthQty) * 100;
                  return (
                    <div 
                      key={idx} 
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        position: 'relative',
                        overflow: 'hidden',
                        background: 'rgba(244, 63, 94, 0.03)'
                      }}
                    >
                      {/* Depth Bar Background */}
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${depthPercent}%`,
                        background: 'rgba(244, 63, 94, 0.15)',
                        zIndex: 0
                      }}></div>

                      <span className="mono-num" style={{ position: 'relative', zIndex: 1, fontWeight: '700', color: 'var(--accent-red)' }}>
                        ${ask.price.toFixed(2)}
                      </span>
                      <span className="mono-num" style={{ position: 'relative', zIndex: 1, color: 'var(--text-secondary)' }}>
                        {ask.quantity.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Live Trade Tape */}
        <div className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} color="var(--accent-cyan)" />
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Trade Tape (L3 Ticks)</h3>
            </div>
            <span className="badge badge-cyan">Aggressive Flow</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {trade_tape.map((t, idx) => {
              const isBuy = t.side === 'BUY';
              return (
                <div 
                  key={idx} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: isBuy ? 'rgba(16, 185, 129, 0.06)' : 'rgba(244, 63, 94, 0.06)',
                    borderLeft: `3px solid ${isBuy ? 'var(--accent-green)' : 'var(--accent-red)'}`
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isBuy ? <ArrowUpRight size={14} color="var(--accent-green)" /> : <ArrowDownRight size={14} color="var(--accent-red)" />}
                    <span className="mono-num" style={{ fontSize: '12px', fontWeight: '700', color: isBuy ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      ${t.price.toFixed(2)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="mono-num" style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '600' }}>
                      {t.quantity} units
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {isBuy ? 'Taker Buy' : 'Taker Sell'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
