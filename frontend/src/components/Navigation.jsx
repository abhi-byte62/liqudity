import React from 'react';
import { 
  BarChart2, 
  Layers, 
  Target, 
  Zap, 
  TrendingUp, 
  GitCompare, 
  Cpu 
} from 'lucide-react';

export default function Navigation({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'orderbook', label: 'Order Book & Depth', icon: Layers, badge: 'LOB' },
    { id: 'queue', label: 'Queue Position Dynamics', icon: BarChart2, badge: 'FIFO' },
    { id: 'adverse', label: 'Adverse Selection & Markouts', icon: Target, badge: 'E[PnL]' },
    { id: 'latency', label: 'Latency Sensitivity Matrix', icon: Zap, badge: 'Quant Dev' },
    { id: 'strategy', label: 'Strategy & Backtest Lab', icon: TrendingUp, badge: 'Sim' },
    { id: 'comparison', label: 'Research Comparison', icon: GitCompare, badge: 'A/B Test' },
    { id: 'benchmark', label: 'C++ Engine Benchmarks', icon: Cpu, badge: '3.2M eps' }
  ];

  return (
    <nav style={{ margin: '0 20px 16px 20px', display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '10px',
              background: isActive 
                ? 'linear-gradient(135deg, rgba(0, 240, 255, 0.15), rgba(56, 189, 248, 0.05))' 
                : 'rgba(15, 23, 42, 0.6)',
              border: isActive ? '1px solid var(--accent-cyan)' : '1px solid var(--border-color)',
              color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: isActive ? '700' : '500',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
              boxShadow: isActive ? '0 0 16px rgba(0, 240, 255, 0.2)' : 'none'
            }}
          >
            <Icon size={16} color={isActive ? 'var(--accent-cyan)' : 'var(--text-muted)'} />
            <span>{tab.label}</span>
            <span style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: isActive ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              color: isActive ? '#fff' : 'var(--text-muted)',
              fontWeight: '600'
            }}>
              {tab.badge}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
