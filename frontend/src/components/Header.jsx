import React from 'react';
import { Activity, Zap, Cpu, Layers, ShieldCheck, RefreshCw, Database } from 'lucide-react';

export default function Header({ markets, selectedMarket, onSelectMarket, engineStatus, onRefresh }) {
  const currentMarketObj = markets.find(m => m.id === selectedMarket);
  const isReal = currentMarketObj?.dataset_type === 'real' || selectedMarket.includes('real');

  return (
    <header className="glass-panel" style={{ margin: '16px 20px', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
      {/* Brand & Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #00f0ff 0%, #3b82f6 50%, #8b5cf6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 16px rgba(0, 240, 255, 0.4)'
        }}>
          <Activity size={24} color="#06090e" strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '-0.02em', background: 'linear-gradient(to right, #f8fafc, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              LiquidityLens
            </h1>
            <span className="badge badge-cyan">HFT Microstructure Core</span>
            <span className={`badge ${isReal ? 'badge-green' : 'badge-purple'}`}>
              {isReal ? '● Real Exchange Data' : '● Synthetic Hawkes Data'}
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Event-Driven LOB Dynamics • Exact Queue Tracking • Adverse Selection Markouts • Latency Sensitivity
          </p>
        </div>
      </div>

      {/* Controls & Engine Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        {/* Market Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(30, 41, 59, 0.5)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <Layers size={16} color="var(--accent-cyan)" />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Market:</span>
          <select 
            value={selectedMarket}
            onChange={(e) => onSelectMarket(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: '600',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {markets.map(m => (
              <option key={m.id} value={m.id} style={{ background: '#0f172a', color: '#f8fafc' }}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Engine Performance Tag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
          <Cpu size={16} color="var(--accent-green)" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>C++ Fixed-Point Core</span>
            <span className="mono-num" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-green)' }}>
              4.56M eps • &lt;0.22μs
            </span>
          </div>
        </div>

        {/* Refresh Button */}
        <button 
          onClick={onRefresh} 
          className="btn-quant btn-secondary" 
          title="Reload Snapshots"
          style={{ padding: '8px 10px' }}
        >
          <RefreshCw size={15} />
        </button>
      </div>
    </header>
  );
}
