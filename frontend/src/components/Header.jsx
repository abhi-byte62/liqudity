import React, { useState, useEffect } from 'react';
import { RefreshCw, Cpu, Clock } from 'lucide-react';

export default function Header({ markets, selectedMarket, onSelectMarket, onRefresh }) {
  const currentMarketObj = markets.find(m => m.id === selectedMarket);
  const isReal = currentMarketObj?.dataset_type === 'real' || selectedMarket.includes('real');

  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const timeStr = now.toISOString().substring(11, 23) + ' UTC';
      setCurrentTime(timeStr);
    };
    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <header style={{
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-subtle)',
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '12px'
    }}>
      {/* Left: Terminal Identity & Dataset Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '20px',
            height: '20px',
            background: 'var(--border-strong)',
            borderRadius: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: '700',
            color: 'var(--color-blue)'
          }}>
            L
          </div>
          <span style={{ fontSize: '14px', fontWeight: '700', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            LiquidityLens
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            v1.2.0
          </span>
        </div>

        <div style={{ height: '14px', width: '1px', background: 'var(--border-subtle)' }} />

        {/* Market Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>
            DATASET:
          </span>
          <select 
            value={selectedMarket}
            onChange={(e) => onSelectMarket(e.target.value)}
            className="terminal-select"
            style={{ fontWeight: '600', padding: '3px 8px' }}
          >
            {markets.map(m => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Provenance Tag */}
        <span className={`status-pill ${isReal ? 'real' : 'synthetic'}`}>
          {isReal ? '● REAL · Binance Spot L2' : '● SYNTHETIC · Hawkes L3'}
        </span>
      </div>

      {/* Right: Performance Status, UTC Clock & Trigger */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
          <Cpu size={13} color="var(--color-green)" />
          <span style={{ color: 'var(--text-muted)' }}>C++ CORE:</span>
          <span className="font-mono" style={{ color: 'var(--color-green)', fontWeight: '600' }}>
            3.89M EPS · 257 NS
          </span>
        </div>

        <div style={{ height: '14px', width: '1px', background: 'var(--border-subtle)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          <Clock size={12} />
          <span>{currentTime || '00:00:00.000 UTC'}</span>
        </div>

        <button 
          onClick={onRefresh} 
          className="btn-terminal"
          title="Reload active market snapshot"
          style={{ padding: '3px 8px' }}
        >
          <RefreshCw size={12} />
          <span style={{ fontSize: '11px' }}>RELOAD</span>
        </button>
      </div>
    </header>
  );
}
