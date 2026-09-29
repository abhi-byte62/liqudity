import React from 'react';
import { 
  Layers, 
  ListOrdered, 
  TrendingDown, 
  Zap, 
  Activity, 
  FlaskConical, 
  Cpu 
} from 'lucide-react';

export default function Navigation({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'orderbook', num: '01', label: 'Order Book', icon: Layers },
    { id: 'queue', num: '02', label: 'Queue Position Dynamics', icon: ListOrdered },
    { id: 'adverse', num: '03', label: 'Adverse Selection Markouts', icon: TrendingDown },
    { id: 'latency', num: '04', label: 'Latency Sensitivity Matrix', icon: Zap },
    { id: 'strategy', num: '05', label: 'Strategy Backtest Engine', icon: Activity },
    { id: 'comparison', num: '06', label: 'Research Experiments Lab', icon: FlaskConical },
    { id: 'benchmark', num: '07', label: 'C++ Engine Benchmarks', icon: Cpu }
  ];

  return (
    <nav style={{
      background: 'var(--bg-app)',
      borderBottom: '1px solid var(--border-subtle)',
      padding: '0 16px',
      display: 'flex',
      gap: '2px',
      overflowX: 'auto'
    }}>
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
              gap: '6px',
              padding: '8px 12px',
              background: isActive ? 'var(--bg-panel)' : 'transparent',
              borderTop: '2px solid',
              borderTopColor: isActive ? 'var(--color-blue)' : 'transparent',
              borderBottom: '1px solid',
              borderBottomColor: isActive ? 'var(--bg-panel)' : 'transparent',
              borderLeft: isActive ? '1px solid var(--border-subtle)' : '1px solid transparent',
              borderRight: isActive ? '1px solid var(--border-subtle)' : '1px solid transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: isActive ? '600' : '400',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              marginBottom: '-1px',
              transition: 'color 0.15s'
            }}
          >
            <span style={{ 
              fontFamily: 'var(--font-mono)', 
              fontSize: '10px', 
              color: isActive ? 'var(--color-blue)' : 'var(--text-muted)' 
            }}>
              [{tab.num}]
            </span>
            <Icon size={13} color={isActive ? 'var(--color-blue)' : 'var(--text-muted)'} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
