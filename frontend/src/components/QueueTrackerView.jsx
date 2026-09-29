import React, { useState } from 'react';
import { ListOrdered, Play, XCircle, RotateCcw } from 'lucide-react';

function computeQueueRows(ordersList) {
  const result = [];
  let cum = 0;
  for (let idx = 0; idx < ordersList.length; idx++) {
    const ord = ordersList[idx];
    const ahead = cum;
    cum += ord.size;
    result.push({
      pos: idx + 1,
      id: ord.id,
      name: ord.name,
      side: ord.side,
      size: ord.size,
      cum,
      ahead,
      status: ord.status
    });
  }
  return result;
}

export default function QueueTrackerView() {
  const initialOrders = [
    { id: '101', name: 'Order A (Mkt)', side: 'BUY', size: 50, status: 'ahead' },
    { id: '102', name: 'Order B (Mkt)', side: 'BUY', size: 30, status: 'ahead' },
    { id: '999', name: 'YOU (Limit Bid)', side: 'BUY', size: 20, status: 'you' },
    { id: '103', name: 'Order C (Mkt)', side: 'BUY', size: 40, status: 'behind' },
    { id: '104', name: 'Order D (Mkt)', side: 'BUY', size: 60, status: 'behind' }
  ];

  const [orders, setOrders] = useState(initialOrders);
  const [yourFilled, setYourFilled] = useState(0);
  const [historyLog, setHistoryLog] = useState([
    "Passive Limit Bid (OrderId: 999) registered @ $65,000.00. Initial Volume Ahead: 80 units (Orders A: 50, B: 30)."
  ]);

  const youOrder = orders.find(o => o.id === '999');
  const queueAhead = orders.reduce((acc, o) => {
    if (o.status === 'ahead') return acc + o.size;
    return acc;
  }, 0);

  const yourSize = youOrder ? youOrder.size : 0;
  const initialYouSize = 20;
  const fillProgress = (yourFilled / initialYouSize) * 100;
  const estimatedFillProb = Math.max(5, Math.min(99, Math.round(100 - (queueAhead * 0.9))));

  const handleSimulateTrade = (tradeAmount = 40) => {
    let remainingTrade = tradeAmount;
    let newYourFilled = yourFilled;
    let newLog = [...historyLog];

    const updated = orders.map(ord => {
      if (remainingTrade <= 0) return ord;

      if (ord.status === 'ahead') {
        if (ord.size <= remainingTrade) {
          remainingTrade -= ord.size;
          newLog.unshift(`TRADE EXEC: Market Sell matched Order ${ord.name} for ${ord.size} units (Filled & dequeued).`);
          return { ...ord, size: 0, status: 'filled' };
        }
        ord.size -= remainingTrade;
        newLog.unshift(`TRADE EXEC: Market Sell matched Order ${ord.name} for ${tradeAmount} units (${ord.size} units left ahead).`);
        remainingTrade = 0;
        return ord;
      } else if (ord.status === 'you') {
        const fillAmt = Math.min(ord.size, remainingTrade);
        newYourFilled += fillAmt;
        ord.size -= fillAmt;
        remainingTrade -= fillAmt;
        newLog.unshift(`>> EXECUTION: YOUR ORDER FILLED for ${fillAmt} units! (${ord.size} units remaining in queue)`);
        return ord;
      }
      return ord;
    });

    setOrders(updated);
    setYourFilled(newYourFilled);
    setHistoryLog(newLog.slice(0, 10));
  };

  const handleSimulateCancel = () => {
    const aheadOrders = orders.filter(o => o.status === 'ahead' && o.size > 0);
    if (aheadOrders.length === 0) return;

    const target = aheadOrders[0];
    const cancelSize = Math.min(target.size, 20);
    const updated = orders.map(ord => {
      if (ord.id === target.id) {
        const rem = ord.size - cancelSize;
        return { ...ord, size: rem, status: rem === 0 ? 'cancelled' : 'ahead' };
      }
      return ord;
    });

    setOrders(updated);
    setHistoryLog([
      `CANCEL ATTR: Exact Order-ID ${target.id} (${target.name}) cancelled ${cancelSize} units ahead of YOU. Ahead queue reduced to ${queueAhead - cancelSize}.`,
      ...historyLog
    ].slice(0, 10));
  };

  const handleReset = () => {
    setOrders(initialOrders);
    setYourFilled(0);
    setHistoryLog(["Re-initialized deterministic FIFO queue simulator."]);
  };

  const tableRows = computeQueueRows(orders);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Header & Control Bar */}
      <div className="terminal-panel" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="panel-title" style={{ fontSize: '13px' }}>
                <ListOrdered size={14} color="var(--color-blue)" />
                FIFO QUEUE POSITION & CANCELLATION ATTRIBUTION
              </span>
              <span className="status-pill neutral">Price Level: $65,000.00 BID</span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Tracking exact order IDs sitting ahead of passive quotes to evaluate execution probability without blanket assumptions.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => handleSimulateTrade(40)} className="btn-terminal primary">
              <Play size={12} /> TRADE (40 QTY)
            </button>
            <button onClick={handleSimulateCancel} className="btn-terminal">
              <XCircle size={12} /> CANCEL AHEAD (20 QTY)
            </button>
            <button onClick={handleReset} className="btn-terminal" title="Reset State">
              <RotateCcw size={12} /> RESET
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
        <div className="metric-box">
          <span className="metric-label">VOLUME AHEAD OF YOU</span>
          <div className="metric-val font-mono" style={{ color: queueAhead === 0 ? 'var(--color-green)' : 'var(--color-blue)' }}>
            {queueAhead} <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>units</span>
          </div>
          <span className="metric-sub">
            {queueAhead === 0 ? 'Top of Queue: Immediate fill on next match' : 'Orders waiting in front of your limit bid'}
          </span>
        </div>

        <div className="metric-box">
          <span className="metric-label">YOUR ORDER FILL STATE</span>
          <div className="metric-val font-mono" style={{ color: 'var(--color-green)' }}>
            {yourFilled} / {initialYouSize} <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({fillProgress.toFixed(0)}%)</span>
          </div>
          <span className="metric-sub">
            Remaining in queue: <span className="font-mono">{yourSize} units</span>
          </span>
        </div>

        <div className="metric-box">
          <span className="metric-label">ESTIMATED FILL PROBABILITY</span>
          <div className="metric-val font-mono" style={{ color: estimatedFillProb > 50 ? 'var(--color-green)' : 'var(--color-amber)' }}>
            {estimatedFillProb}%
          </div>
          <span className="metric-sub">
            Empirical Hawkes flow expectation
          </span>
        </div>
      </div>

      {/* Technical Tabular Queue Layout */}
      <div className="terminal-panel">
        <div className="terminal-header">
          <span className="panel-title">
            FIFO EXECUTION PRIORITY SEQUENCE (TOP = HEAD OF QUEUE)
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            DETERMINISTIC MEMORY LADDER
          </span>
        </div>

        <table className="terminal-table">
          <thead>
            <tr>
              <th>POS</th>
              <th>ORDER ID</th>
              <th>IDENTIFIER</th>
              <th>SIDE</th>
              <th>SIZE</th>
              <th>CUMULATIVE</th>
              <th>VOL AHEAD</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row) => {
              const isYou = row.id === '999';
              const isDepleted = row.size === 0;
              return (
                <tr
                  key={row.id}
                  style={{
                    background: isYou ? 'rgba(63, 185, 80, 0.05)' : isDepleted ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                    opacity: isDepleted ? 0.6 : 1.0
                  }}
                >
                  <td className="font-mono" style={{ fontWeight: '600', color: isYou ? 'var(--color-green)' : 'var(--text-muted)' }}>
                    {String(row.pos).padStart(2, '0')}
                  </td>
                  <td className="font-mono" style={{ fontWeight: '600', color: isYou ? 'var(--color-green)' : 'var(--color-blue)' }}>
                    {row.id}
                  </td>
                  <td style={{ color: isYou ? 'var(--color-green)' : 'var(--text-primary)', fontWeight: isYou ? '600' : '400' }}>
                    {row.name}
                  </td>
                  <td>
                    <span className="status-pill real">{row.side}</span>
                  </td>
                  <td className="font-mono" style={{ fontWeight: '700', color: isYou ? 'var(--color-green)' : 'var(--text-primary)' }}>
                    {row.size} <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '400' }}>units</span>
                  </td>
                  <td className="font-mono" style={{ color: 'var(--text-muted)' }}>
                    {row.cum} units
                  </td>
                  <td className="font-mono" style={{ color: row.ahead === 0 ? 'var(--color-green)' : 'var(--text-secondary)' }}>
                    {row.ahead} units
                  </td>
                  <td>
                    {isDepleted ? (
                      <span className="status-pill neutral">FILLED & DEQUEUED</span>
                    ) : isYou ? (
                      <span className="status-pill real">YOUR ACTIVE QUOTE</span>
                    ) : row.status === 'ahead' ? (
                      <span className="status-pill warning">AHEAD OF YOU</span>
                    ) : (
                      <span className="status-pill neutral">BEHIND YOU</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Activity Log */}
      <div className="terminal-panel">
        <div className="terminal-header">
          <span className="panel-title">
            MATCHING ENGINE QUEUE EVENT LOG
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            SUB-MILLISECOND AUDIT TRAIL
          </span>
        </div>

        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '160px', overflowY: 'auto' }}>
          {historyLog.map((log, idx) => (
            <div
              key={idx}
              className="font-mono"
              style={{
                fontSize: '11px',
                padding: '4px 8px',
                background: log.includes('YOUR ORDER FILLED') ? 'rgba(63, 185, 80, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                borderLeft: log.includes('YOUR ORDER FILLED') ? '2px solid var(--color-green)' : '2px solid transparent',
                color: log.includes('YOUR ORDER FILLED') ? 'var(--color-green)' : 'var(--text-secondary)'
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
