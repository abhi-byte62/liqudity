import React, { useState } from 'react';
import { Layers, ArrowRight, CheckCircle2, XCircle, Play, RotateCcw, AlertTriangle, ShieldAlert } from 'lucide-react';

export default function QueueTrackerView() {
  // Interactive simulated queue state
  const initialOrders = [
    { id: 'A', name: 'Order A', size: 50, ahead: 0, status: 'ahead', color: '#00f0ff' },
    { id: 'B', name: 'Order B', size: 25, ahead: 50, status: 'ahead', color: '#38bdf8' },
    { id: 'C', name: 'Order C', size: 100, ahead: 75, status: 'ahead', color: '#818cf8' },
    { id: 'YOU', name: 'YOU (Limit Bid)', size: 20, ahead: 175, status: 'you', color: '#10b981' },
    { id: 'D', name: 'Order D', size: 50, ahead: 195, status: 'behind', color: '#64748b' }
  ];

  const [orders, setOrders] = useState(initialOrders);
  const [yourFilled, setYourFilled] = useState(0);
  const [historyLog, setHistoryLog] = useState([
    "Limit Buy placed @ $65,000.00 (Size: 20). Queue Ahead: 175 units."
  ]);

  // Total queue ahead of YOU
  const youOrder = orders.find(o => o.id === 'YOU');
  const queueAhead = orders.reduce((acc, o) => {
    if (o.status === 'ahead') return acc + o.size;
    return acc;
  }, 0);

  const yourSize = youOrder ? youOrder.size : 0;
  const fillProgress = yourSize > 0 ? (yourFilled / (yourFilled + yourSize)) * 100 : 100;
  const estimatedFillProb = Math.max(5, Math.min(99, Math.round(100 - (queueAhead / 2.0))));

  // Handle aggressive trade hitting queue
  const handleSimulateTrade = (tradeAmount = 40) => {
    let remainingTrade = tradeAmount;
    let newYourFilled = yourFilled;
    let newLog = [...historyLog];

    const updated = orders.map(ord => {
      if (remainingTrade <= 0) return ord;

      if (ord.status === 'ahead') {
        if (ord.size <= remainingTrade) {
          remainingTrade -= ord.size;
          newLog.unshift(`Aggressive Sell hit ${ord.name} for ${ord.size} units (Filled & removed).`);
          return { ...ord, size: 0 };
        } else {
          ord.size -= remainingTrade;
          newLog.unshift(`Aggressive Sell hit ${ord.name} for ${remainingTrade} units (${ord.size} remaining).`);
          remainingTrade = 0;
          return ord;
        }
      } else if (ord.status === 'you') {
        const fillAmt = Math.min(ord.size, remainingTrade);
        newYourFilled += fillAmt;
        ord.size -= fillAmt;
        remainingTrade -= fillAmt;
        newLog.unshift(`🎯 YOUR ORDER FILLED for ${fillAmt} units! (${ord.size} remaining in queue)`);
        return ord;
      }
      return ord;
    }).filter(ord => ord.size > 0 || ord.id === 'YOU');

    setOrders(updated);
    setYourFilled(newYourFilled);
    setHistoryLog(newLog.slice(0, 10));
  };

  // Handle ahead order cancellation
  const handleSimulateCancel = () => {
    const aheadOrders = orders.filter(o => o.status === 'ahead');
    if (aheadOrders.length === 0) return;

    const target = aheadOrders[0];
    const cancelSize = Math.min(target.size, 25);
    const updated = orders.map(ord => {
      if (ord.id === target.id) {
        return { ...ord, size: ord.size - cancelSize };
      }
      return ord;
    }).filter(ord => ord.size > 0);

    setOrders(updated);
    setHistoryLog([
      `Ahead cancellation: ${target.name} cancelled ${cancelSize} units. Queue ahead drops to ${queueAhead - cancelSize}.`,
      ...historyLog
    ].slice(0, 10));
  };

  const handleReset = () => {
    setOrders(initialOrders);
    setYourFilled(0);
    setHistoryLog(["Reset order queue simulation."]);
  };

  return (
    <div style={{ padding: '0 20px 24px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Overview Card */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
                FIFO Order Queue Position Dynamics
              </h2>
              <span className="badge badge-green">Exact Volume Ahead Model</span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              How does FIFO queue priority and ahead cancellations influence execution probability P(Fill | Queue Ahead, Order Flow, Time)?
            </p>
          </div>

          {/* Interactive Controls */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => handleSimulateTrade(40)} className="btn-quant">
              <Play size={15} /> Simulate Trade (40 units)
            </button>
            <button onClick={handleSimulateCancel} className="btn-quant btn-secondary">
              <XCircle size={15} /> Cancel Ahead (25 units)
            </button>
            <button onClick={handleReset} className="btn-quant btn-secondary" title="Reset">
              <RotateCcw size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Queue Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        <div className="glass-panel" style={{ padding: '16px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Queue Ahead of You</span>
          <div className="mono-num" style={{ fontSize: '24px', fontWeight: '700', color: queueAhead === 0 ? 'var(--accent-green)' : 'var(--accent-cyan)' }}>
            {queueAhead} <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>units</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {queueAhead === 0 ? 'Priority: Next in Line for Fill!' : 'Orders sitting in front of you'}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Your Order Status</span>
          <div className="mono-num" style={{ fontSize: '24px', fontWeight: '700', color: 'var(--accent-green)' }}>
            {yourFilled} / {yourFilled + yourSize} <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Filled ({fillProgress.toFixed(0)}%)</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Remaining Size: <span className="mono-num" style={{ color: '#fff' }}>{yourSize} units</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Estimated Fill Probability</span>
          <div className="mono-num" style={{ fontSize: '24px', fontWeight: '700', color: estimatedFillProb > 50 ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
            {estimatedFillProb}%
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Based on current Hawkes arrival rate & depth
          </div>
        </div>
      </div>

      {/* Visual FIFO Queue Lane */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px' }}>
          Visual Limit Order Book Queue Lane (@ Price $65,000.00 BID)
        </h3>

        {/* Priority Arrow Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: '600' }}>
          <span>FIFO EXECUTION PRIORITY</span>
          <ArrowRight size={14} />
          <span>(Matching Engine Eats Left-to-Right)</span>
        </div>

        {/* Queue Items Row */}
        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
          {orders.map((ord, idx) => {
            const isYou = ord.id === 'YOU';
            return (
              <div
                key={ord.id}
                style={{
                  minWidth: '160px',
                  padding: '14px',
                  borderRadius: '10px',
                  background: isYou ? 'rgba(16, 185, 129, 0.15)' : 'rgba(30, 41, 59, 0.6)',
                  border: isYou ? '2px solid var(--accent-green)' : '1px solid var(--border-color)',
                  boxShadow: isYou ? '0 0 16px rgba(16, 185, 129, 0.25)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: isYou ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                    {ord.name}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>#{idx + 1}</span>
                </div>

                <div className="mono-num" style={{ fontSize: '20px', fontWeight: '800', color: isYou ? 'var(--accent-green)' : ord.color }}>
                  {ord.size} <span style={{ fontSize: '12px', fontWeight: '400', color: 'var(--text-muted)' }}>units</span>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {isYou ? (
                    <span className="badge badge-green">Your Position</span>
                  ) : ord.status === 'ahead' ? (
                    <span className="badge badge-cyan">Ahead of You</span>
                  ) : (
                    <span className="badge badge-amber">Behind You</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Simulation Log */}
      <div className="glass-panel" style={{ padding: '18px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>
          Queue Event & Fill Activity Log
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
          {historyLog.map((log, idx) => (
            <div 
              key={idx} 
              style={{ 
                fontSize: '12px', 
                fontFamily: 'var(--font-mono)', 
                color: log.includes('YOUR ORDER FILLED') ? 'var(--accent-green)' : 'var(--text-secondary)',
                padding: '6px 10px',
                background: log.includes('YOUR ORDER FILLED') ? 'rgba(16, 185, 129, 0.08)' : 'rgba(15, 23, 42, 0.4)',
                borderRadius: '4px',
                borderLeft: log.includes('YOUR ORDER FILLED') ? '3px solid var(--accent-green)' : '1px solid transparent'
              }}
            >
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
