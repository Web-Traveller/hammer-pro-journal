import React from 'react';
import { Line, Scatter } from 'react-chartjs-2';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Percent,
  FileText,
  Clock,
  Zap,
  Scale,
  DollarSign,
  Layers,
  Plus,
  X,
  BarChart3,
  BookOpen,
  Edit3,
  ChevronDown,
  ChevronUp,
  Award,
  AlertTriangle,
  Save,
  Copy,
  TrendingUp
} from 'lucide-react';
import { formatTimeLabel, isDarkpool } from '../../parser';
import { formatDisplayDate } from '../../services/timeService';
import { getEquityGradient, getIntradayChartOptions } from '../../utils/chartConfig';

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function getCalendarPopoverGrid(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = new Date(year, month, 1).getDay();
  const grid = [];
  for (let i = 0; i < startWeekday; i++) {
    grid.push({ dayNum: null, dateStr: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = (month + 1).toString().padStart(2, '0');
    const dd = d.toString().padStart(2, '0');
    grid.push({ dayNum: d, dateStr: `${year}-${mm}-${dd}` });
  }
  return grid;
}

export function SingleSessionView({
  sessionDate,
  setSessionDate,
  singleSessionAnalytics,
  dailyStatsMap,
  settings,
  timezone,
  sessionTab,
  setSessionTab,
  expandedStockFills,
  toggleStockFillDrawer,
  sessionScreenshots,
  onAddScreenshots,
  onDeleteScreenshot,
  onOpenLightbox,
  journalNotes,
  setJournalNotes,
  onSaveJournalNotes,
  editingSessionLog,
  setEditingSessionLog,
  onSaveEditedSessionLog,
  onCopyRawLog,
  showSessionCalendar,
  setShowSessionCalendar,
  sessionPopYear,
  setSessionPopYear,
  sessionPopMonth,
  setSessionPopMonth,
  sessionCalendarRef,
  smoothIntradayChartOptions
}) {
  const formatHoldTime = (secs) => {
    if (!secs || secs < 0) return '0s';
    if (secs < 60) return `${Math.round(secs)}s`;
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}m ${s}s`;
  };

  const sessionWinRate = singleSessionAnalytics && singleSessionAnalytics.totalOrders > 0
    ? ((singleSessionAnalytics.winningTrades / singleSessionAnalytics.totalOrders) * 100).toFixed(2)
    : '0.00';

  const singleSessionChartData = React.useMemo(() => {
    if (!singleSessionAnalytics || !singleSessionAnalytics.intradayEquityCurve) return null;
    const curve = singleSessionAnalytics.intradayEquityCurve;
    return {
      labels: curve.map(c => c.timeLabel),
      datasets: [
        {
          label: 'Realized Cumulative P&L',
          data: curve.map(c => c.execPnl),
          borderColor: (singleSessionAnalytics.netPnl || singleSessionAnalytics.pnl) >= 0 ? '#10b981' : '#f43f5e',
          backgroundColor: (context) => getEquityGradient(context),
          fill: true,
          pointRadius: curve.length > 40 ? 1 : 3,
          pointHoverRadius: 6,
          pointBackgroundColor: (singleSessionAnalytics.netPnl || singleSessionAnalytics.pnl) >= 0 ? '#10b981' : '#f43f5e',
          tension: 0.2
        }
      ]
    };
  }, [singleSessionAnalytics]);

  const intradayOptions = React.useMemo(() => {
    return getIntradayChartOptions(singleSessionAnalytics?.intradayEquityCurve || []);
  }, [singleSessionAnalytics]);

  // Tape Scalper Scatter Plot: Hold Time (Seconds) vs Realized Trade P&L ($)
  const scalperScatterData = React.useMemo(() => {
    if (!singleSessionAnalytics || !singleSessionAnalytics.consolidatedTrades) return null;
    const trades = singleSessionAnalytics.consolidatedTrades;
    return {
      datasets: [
        {
          label: 'Profitable Scalps',
          data: trades.filter(t => t.pnl >= 0).map(t => ({
            x: Math.max(1, Math.round(t.holdingSeconds || 0)),
            y: t.pnl,
            symbol: t.symbol,
            qty: t.qty,
            side: t.side,
            hold: t.holdingSeconds || 0
          })),
          backgroundColor: 'rgba(16, 185, 129, 0.85)',
          borderColor: '#059669',
          pointRadius: 6,
          pointHoverRadius: 9
        },
        {
          label: 'Losing Scalps',
          data: trades.filter(t => t.pnl < 0).map(t => ({
            x: Math.max(1, Math.round(t.holdingSeconds || 0)),
            y: t.pnl,
            symbol: t.symbol,
            qty: t.qty,
            side: t.side,
            hold: t.holdingSeconds || 0
          })),
          backgroundColor: 'rgba(244, 63, 94, 0.85)',
          borderColor: '#e11d48',
          pointRadius: 6,
          pointHoverRadius: 9
        }
      ]
    };
  }, [singleSessionAnalytics]);

  const scalperScatterOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: { boxWidth: 10, font: { size: 11, weight: '700' }, color: '#374151' }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#94a3b8',
        bodyColor: '#ffffff',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          title: (items) => {
            if (!items.length) return '';
            const raw = items[0].raw;
            return `${raw.symbol} (${raw.side === 'B' ? 'BUY / Long' : 'SELL / Short'} ${raw.qty} shs)`;
          },
          label: (context) => {
            const raw = context.raw;
            return [
              `Hold Duration: ${formatHoldTime(raw?.hold || 0)} (${raw?.x || 0}s)`,
              `Realized Trade P&L: ${(raw?.y || 0) >= 0 ? '+' : ''}$${((raw?.y || 0)).toFixed(2)}`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        grid: { color: '#f3f4f6' },
        title: { display: true, text: 'Position Hold Duration (Seconds)', font: { size: 11, weight: '700' }, color: '#6b7280' },
        ticks: { color: '#9ca3af', font: { size: 11 } }
      },
      y: {
        grid: { color: '#f3f4f6' },
        ticks: {
          color: '#9ca3af',
          font: { size: 11 },
          callback: (v) => {
            const num = Number(v);
            return isNaN(num) ? '$0.00' : (num >= 0 ? '$' : '-$') + Math.abs(num).toFixed(2);
          }
        }
      }
    }
  };

  return (
    <div>
      {/* Interactive Popover Calendar Date Selector */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div className="calendar-picker-wrapper" ref={sessionCalendarRef}>
          <button className="calendar-trigger-btn" onClick={() => setShowSessionCalendar(!showSessionCalendar)}>
            <CalendarDays size={18} color="var(--hero-green)" />
            <span>Session Date: {sessionDate || 'Select Session'}</span>
          </button>

          {showSessionCalendar && (
            <div className="calendar-popover">
              <div className="calendar-popover-header">
                <button className="calendar-nav-btn" onClick={() => {
                  if (sessionPopMonth === 0) { setSessionPopMonth(11); setSessionPopYear(sessionPopYear - 1); }
                  else { setSessionPopMonth(sessionPopMonth - 1); }
                }}><ChevronLeft size={18} /></button>
                <span>{monthNames[sessionPopMonth]} {sessionPopYear}</span>
                <button className="calendar-nav-btn" onClick={() => {
                  if (sessionPopMonth === 11) { setSessionPopMonth(0); setSessionPopYear(sessionPopYear + 1); }
                  else { setSessionPopMonth(sessionPopMonth + 1); }
                }}><ChevronRight size={18} /></button>
              </div>

              <div className="popover-grid">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((wd, idx) => (
                  <div key={idx} className="popover-weekday">{wd}</div>
                ))}
                {getCalendarPopoverGrid(sessionPopYear, sessionPopMonth).map((day, dIdx) => {
                  const hasSession = day.dateStr && dailyStatsMap[day.dateStr];
                  const isProfitable = hasSession && dailyStatsMap[day.dateStr].pnl >= 0;
                  const isSelected = day.dateStr === sessionDate;

                  return (
                    <div
                      key={dIdx}
                      className={`popover-day-cell ${day.dayNum === null ? 'empty' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        if (day.dateStr) {
                          setSessionDate(day.dateStr);
                          setShowSessionCalendar(false);
                        }
                      }}
                    >
                      {day.dayNum}
                      {hasSession && (
                        <span className={`session-dot ${isProfitable ? 'dot-profit' : 'dot-loss'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {singleSessionAnalytics ? (
        <div>
          {/* Active Open Positions Warning Box */}
          {singleSessionAnalytics.openPositionsSummary && singleSessionAnalytics.openPositionsSummary.length > 0 && (
            <div style={{
              backgroundColor: '#fffbe6',
              border: '1px solid #ffe58f',
              borderRadius: '0.75rem',
              padding: '0.85rem 1.25rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem'
            }}>
              <div>
                <div style={{ fontWeight: 700, color: '#d48806', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Zap size={18} /> Active Unclosed Position(s) Detected (Missing Exit Fill)
                </div>
                <div style={{ fontSize: '0.82rem', color: '#8c6b00', marginTop: '0.25rem' }}>
                  {singleSessionAnalytics.openPositionsSummary.map(op => (
                    <span key={op.symbol} style={{ marginRight: '1rem', fontWeight: 600 }}>
                      • {op.symbol}: {op.qty} shs {op.side === 'B' ? 'Long' : 'Short'} @ ${(op.avgPrice || 0).toFixed(2)}
                    </span>
                  ))}
                </div>
              </div>
              <button 
                className="btn" 
                style={{ backgroundColor: '#faad14', borderColor: '#d48806', color: '#ffffff', fontSize: '0.78rem', padding: '0.4rem 0.8rem', whiteSpace: 'nowrap' }}
                onClick={() => setSessionTab('raw')}
              >
                <Edit3 size={14} /> Edit Log to Add Exit
              </button>
            </div>
          )}

          {/* Session Sleek KPI Cards Row */}
          <div className="grid-cards">
            {/* Card 1: Realized P&L */}
            <div className="card card-hero">
              <div className="card-top">
                <span className="card-title">
                  {settings?.enableFees ? 'Net Session P&L' : 'Session Realized P&L'}
                </span>
                <button className="card-icon-btn"><ArrowUpRight size={16} /></button>
              </div>
              <div className="card-value">
                {((settings?.enableFees ? singleSessionAnalytics.netPnl : singleSessionAnalytics.pnl) || 0) >= 0 ? '+' : ''}
                ${((settings?.enableFees ? singleSessionAnalytics.netPnl : singleSessionAnalytics.pnl) || 0).toFixed(2)}
              </div>
              <span className="card-footer-tag tag-profit">
                {settings?.enableFees ? `Gross: $${(singleSessionAnalytics.grossPnl !== undefined ? singleSessionAnalytics.grossPnl : singleSessionAnalytics.pnl || 0).toFixed(2)} • Fees: $${(singleSessionAnalytics.fees || 0).toFixed(2)}` : `${(singleSessionAnalytics.consolidatedTrades && singleSessionAnalytics.consolidatedTrades.length > 0 ? singleSessionAnalytics.consolidatedTrades.length : (singleSessionAnalytics.totalTrades || singleSessionAnalytics.totalOrders || 0))} Trades Closed`}
              </span>
            </div>

            {/* Card 2: Win Rate */}
            <div className="card">
              <div className="card-top">
                <span className="card-title">Win Rate</span>
                <button className="card-icon-btn"><Percent size={16} /></button>
              </div>
              <div className="card-value">
                {sessionWinRate}%
              </div>
              <span className="card-footer-tag tag-profit">
                {singleSessionAnalytics.winningTrades || 0} Win / {singleSessionAnalytics.losingTrades || 0} Loss
              </span>
            </div>

            {/* Card 3: Trades & Fills */}
            <div className="card">
              <div className="card-top">
                <span className="card-title">Trades &amp; Fills</span>
                <button className="card-icon-btn"><FileText size={16} /></button>
              </div>
              <div className="card-value">
                {(singleSessionAnalytics.consolidatedTrades && singleSessionAnalytics.consolidatedTrades.length > 0)
                  ? singleSessionAnalytics.consolidatedTrades.length
                  : (singleSessionAnalytics.totalTrades || singleSessionAnalytics.totalOrders || 0)} Trades
              </div>
              <span className="card-footer-tag" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
                {singleSessionAnalytics.totalFills || singleSessionAnalytics.totalOrders || 0} Fills ({singleSessionAnalytics.roundTripShares || 0} Shs)
              </span>
            </div>

            {/* Card 4: Avg Hold Time */}
            <div className="card">
              <div className="card-top">
                <span className="card-title">Avg Hold Duration</span>
                <button className="card-icon-btn"><Clock size={16} /></button>
              </div>
              <div className="card-value">
                {formatHoldTime(singleSessionAnalytics.stockBreakdown?.length > 0 ? (singleSessionAnalytics.stockBreakdown.reduce((acc, s) => acc + (s.avgHoldTime || 0), 0) / (singleSessionAnalytics.stockBreakdown.length || 1)) : 0)}
              </div>
              <span className="card-footer-tag" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
                {singleSessionAnalytics.totalBoughtQty || 0} Shs Bought / {singleSessionAnalytics.totalSoldQty || 0} Sold
              </span>
            </div>
          </div>

          {/* Level 2 Tape Scalper Performance Bar */}
          <div className="scalper-metrics-grid">
            <div className="scalper-card">
              <div className="scalper-card-title">
                <span>Net Edge / Share</span>
                <Zap size={14} color="var(--hero-green)" />
              </div>
              <div className="scalper-card-val" style={{ color: (singleSessionAnalytics.netCentsPerShare || 0) >= 0 ? 'var(--hero-green)' : 'var(--rose-text)' }}>
                {(singleSessionAnalytics.netCentsPerShare || 0) >= 0 ? '+' : ''}{(singleSessionAnalytics.netCentsPerShare || 0).toFixed(2)}¢
              </div>
              <div className="scalper-card-sub">Average profit per round-trip share</div>
            </div>

            <div className="scalper-card">
              <div className="scalper-card-title">
                <span>Avg Win vs Loss / Share</span>
                <Scale size={14} color="#3b82f6" />
              </div>
              <div className="scalper-card-val" style={{ fontSize: '1.05rem' }}>
                <span style={{ color: 'var(--hero-green)' }}>+{(singleSessionAnalytics.avgCentsPerWinShare || 0).toFixed(1)}¢</span>
                <span style={{ color: 'var(--text-light)', margin: '0 4px' }}>/</span>
                <span style={{ color: 'var(--rose-text)' }}>-{(singleSessionAnalytics.avgCentsPerLossShare || 0).toFixed(1)}¢</span>
              </div>
              <div className="scalper-card-sub">Win/Loss expectancy in cents</div>
            </div>

            <div className="scalper-card">
              <div className="scalper-card-title">
                <span>Long vs Short Trades</span>
                <TrendingUp size={14} color="#8b5cf6" />
              </div>
              <div className="scalper-card-val" style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: 'var(--hero-green)', fontWeight: 800 }}>
                  {singleSessionAnalytics.longStats?.count || 0} L
                </span>
                <span style={{ color: 'var(--text-light)' }}>/</span>
                <span style={{ color: 'var(--rose-text)', fontWeight: 800 }}>
                  {singleSessionAnalytics.shortStats?.count || 0} S
                </span>
              </div>
              <div className="scalper-card-sub">
                {(singleSessionAnalytics.longStats?.count || 0) + (singleSessionAnalytics.shortStats?.count || 0) > 0
                  ? `${Math.round(((singleSessionAnalytics.longStats?.count || 0) / (((singleSessionAnalytics.longStats?.count || 0) + (singleSessionAnalytics.shortStats?.count || 0)) || 1)) * 100)}% Long`
                  : 'Directional Distribution'}
              </div>
            </div>

            <div className="scalper-card">
              <div className="scalper-card-title">
                <span>Darkpool Fill Share</span>
                <Layers size={14} color="#d97706" />
              </div>
              <div className="scalper-card-val">
                {singleSessionAnalytics.roundTripShares > 0 ? Math.round(((singleSessionAnalytics.dayDarkpoolVolume || 0) / (singleSessionAnalytics.roundTripShares * 2 || 1)) * 100) : 0}%
              </div>
              <div className="scalper-card-sub">{(singleSessionAnalytics.dayDarkpoolVolume || 0).toLocaleString()} DP shares routed</div>
            </div>
          </div>

          {/* Intraday Realized Cumulative Equity Curve */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-top">
              <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                Intraday Realized Equity Curve ({formatDisplayDate(sessionDate)})
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Timezone: {timezone === 'INDIA_IST' ? '🇮🇳 Indian Standard Time (IST)' : '🇺🇸 US Eastern Market Time (EDT)'}
              </span>
            </div>
            <div className="chart-container">
              {singleSessionChartData && <Line data={singleSessionChartData} options={intradayOptions} />}
            </div>
          </div>

          {/* Attached Screenshots Section */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-top">
              <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                Session Attached Screenshots ({sessionScreenshots.length})
              </span>
              <label className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', cursor: 'pointer' }}>
                <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onAddScreenshots} />
                <Plus size={14} /> Add Screenshot
              </label>
            </div>
            {sessionScreenshots.length > 0 ? (
              <div className="screenshot-grid">
                {sessionScreenshots.map((img, idx) => (
                  <div key={idx} className="screenshot-card" onClick={() => onOpenLightbox(img.dataUrl)}>
                    <img src={img.dataUrl} alt={`Session Screenshot ${idx + 1}`} />
                    <button className="delete-btn" onClick={(e) => { e.stopPropagation(); onDeleteScreenshot(img.filename); }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                No closing screenshots attached for this session yet. Click "+ Add Screenshot" to upload.
              </div>
            )}
          </div>

          {/* Sub-tab Navigation Bar */}
          <div className="tab-bar">
            <button 
              className={`tab-btn ${sessionTab === 'stocks' ? 'active' : ''}`}
              onClick={() => setSessionTab('stocks')}
            >
              <BarChart3 size={15} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Per-Stock Performance
            </button>
            <button 
              className={`tab-btn ${sessionTab === 'timeMatrix' ? 'active' : ''}`}
              onClick={() => setSessionTab('timeMatrix')}
            >
              <Clock size={15} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Stock × Time Matrix (Heatmap)
            </button>
            <button 
              className={`tab-btn ${sessionTab === 'scalper' ? 'active' : ''}`}
              onClick={() => setSessionTab('scalper')}
            >
              <Zap size={15} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Tape Scalper &amp; Speed Breakdown
            </button>
            <button 
              className={`tab-btn ${sessionTab === 'journal' ? 'active' : ''}`}
              onClick={() => setSessionTab('journal')}
            >
              <BookOpen size={15} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Session Journal
            </button>
            <button 
              className={`tab-btn ${sessionTab === 'ecn' ? 'active' : ''}`}
              onClick={() => setSessionTab('ecn')}
            >
              <Layers size={15} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> ECN &amp; Route Breakdown
            </button>
            <button 
              className={`tab-btn ${sessionTab === 'raw' ? 'active' : ''}`}
              onClick={() => setSessionTab('raw')}
            >
              <Edit3 size={15} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Raw Log &amp; Quick Editor
            </button>
          </div>

          {/* TAB 1: PER-STOCK BREAKDOWN */}
          {sessionTab === 'stocks' && (
            <div className="card">
              <div className="card-top">
                <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                  Per-Stock Performance &amp; Fills Breakdown ({sessionDate})
                </span>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Realized P&amp;L</th>
                      {settings.enableFees && <th>Net P&amp;L</th>}
                      <th>Edge / Share</th>
                      <th>Trades</th>
                      <th>Total Shares</th>
                      <th>Avg Hold</th>
                      <th>Darkpool vs ECN</th>
                      <th>Fills Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {singleSessionAnalytics.stockBreakdown.map((stock) => {
                      const isExpanded = expandedStockFills[stock.symbol];
                      return (
                        <React.Fragment key={stock.symbol}>
                          <tr>
                            <td style={{ fontWeight: 800 }}>{stock.symbol}</td>
                            <td style={{ fontWeight: 800, color: (stock.pnl || 0) >= 0 ? 'var(--hero-green)' : 'var(--rose-text)' }}>
                              {(stock.pnl || 0) >= 0 ? '+' : ''}${(stock.pnl || 0).toFixed(2)}
                            </td>
                            {settings?.enableFees && (
                              <td style={{ fontWeight: 700, color: ((stock.netPnl ?? stock.pnl) || 0) >= 0 ? 'var(--hero-green)' : 'var(--rose-text)' }}>
                                {((stock.netPnl ?? stock.pnl) || 0) >= 0 ? '+' : ''}${((stock.netPnl ?? stock.pnl) || 0).toFixed(2)}
                              </td>
                            )}
                            <td style={{ fontWeight: 700, color: (stock.centsPerShare || 0) >= 0 ? 'var(--hero-green)' : 'var(--rose-text)' }}>
                              {(stock.centsPerShare || 0) >= 0 ? '+' : ''}{(stock.centsPerShare || 0).toFixed(2)}¢/sh
                            </td>
                            <td>{stock.tradesCount || 0}</td>
                            <td>{stock.totalQty || 0}</td>
                            <td>{formatHoldTime(stock.avgHoldTime || 0)}</td>
                            <td>
                              <span style={{ color: 'var(--purple-text)', fontWeight: 700 }}>{stock.darkpoolVolume || 0} dp</span>
                              <span style={{ color: 'var(--text-light)', margin: '0 4px' }}>/</span>
                              <span style={{ color: 'var(--blue-text)', fontWeight: 600 }}>{stock.litVolume || 0} ecn</span>
                            </td>
                            <td>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                                onClick={() => toggleStockFillDrawer(stock.symbol)}
                              >
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                {isExpanded ? 'Hide Trades' : `Show Trades (${stock.matchedTrades?.length || 0})`}
                              </button>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className="fill-drawer-row">
                              <td colSpan={settings?.enableFees ? 9 : 8}>
                                <div style={{ padding: '0.5rem 0.25rem' }}>
                                  {/* Clean Matched Closed Trades Section */}
                                  {stock.matchedTrades && stock.matchedTrades.length > 0 ? (
                                    <div>
                                      <div style={{ fontSize: '0.82rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <Zap size={14} color="var(--hero-green)" /> Matched Closed Trades for {stock.symbol} ({stock.matchedTrades.length}):
                                      </div>
                                      <table className="nested-fills-table">
                                        <thead>
                                          <tr>
                                            <th>Side</th>
                                            <th>Shares</th>
                                            <th>Entry ➔ Exit Price</th>
                                            <th>Hold Duration</th>
                                            <th>Route Venue</th>
                                            <th>Realized Trade P&amp;L</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {stock.matchedTrades.map((t, tIdx) => (
                                            <tr key={tIdx}>
                                              <td>
                                                <span className={`badge ${t.side === 'B' ? 'badge-profit' : 'badge-loss'}`}>
                                                  {t.side === 'B' ? 'BUY / Long' : 'SELL / Short'}
                                                </span>
                                              </td>
                                              <td style={{ fontWeight: 700 }}>{t.qty} shs</td>
                                              <td>${(t.entryPrice || 0).toFixed(2)} ➔ ${(t.exitPrice || 0).toFixed(2)}</td>
                                              <td style={{ fontWeight: 700, color: (t.holdingSeconds || 0) <= 30 ? 'var(--hero-green)' : 'var(--text-main)' }}>
                                                ⚡ {formatHoldTime(t.holdingSeconds || 0)}
                                              </td>
                                              <td>
                                                <span className="badge badge-route">{t.exitRoute || t.entryRoute || 'DIRECT'}</span>
                                              </td>
                                              <td style={{ fontWeight: 800, color: (t.pnl || 0) >= 0 ? 'var(--hero-green)' : 'var(--rose-text)' }}>
                                                {(t.pnl || 0) >= 0 ? '+' : ''}${(t.pnl || 0).toFixed(2)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem' }}>
                                      No matched round-trip trades found for this symbol.
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: STOCK X TIME HEATMAP MATRIX */}
          {sessionTab === 'timeMatrix' && (
            singleSessionAnalytics.stockTimeMatrix && (singleSessionAnalytics.stockTimeMatrix.timeSlots || []).length > 0 ? (
              <div>
                {/* Golden Window & Danger Window Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  {singleSessionAnalytics.stockTimeMatrix.goldenWindow ? (
                    <div className="window-badge-golden">
                      <Award size={28} />
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Today's Golden Window (Peak Edge)
                        </div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                          {singleSessionAnalytics.stockTimeMatrix.goldenWindow.slotLabel} — +${(singleSessionAnalytics.stockTimeMatrix.goldenWindow.pnl || 0).toFixed(2)}
                        </div>
                        <div style={{ fontSize: '0.72rem', opacity: 0.85 }}>
                          {singleSessionAnalytics.stockTimeMatrix.goldenWindow.tradesCount || 0} trades • {singleSessionAnalytics.stockTimeMatrix.goldenWindow.volume || 0} shares
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="window-badge-golden" style={{ opacity: 0.6 }}>
                      <Award size={28} />
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800 }}>No Golden Window Detected</div>
                      </div>
                    </div>
                  )}

                  {singleSessionAnalytics.stockTimeMatrix.dangerWindow ? (
                    <div className="window-badge-danger">
                      <AlertTriangle size={28} />
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Today's Danger Window (Chop / Loss Zone)
                        </div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                          {singleSessionAnalytics.stockTimeMatrix.dangerWindow.slotLabel} — -${Math.abs(singleSessionAnalytics.stockTimeMatrix.dangerWindow.pnl || 0).toFixed(2)}
                        </div>
                        <div style={{ fontSize: '0.72rem', opacity: 0.85 }}>
                          {singleSessionAnalytics.stockTimeMatrix.dangerWindow.tradesCount || 0} trades • Step away during this hour
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="window-badge-danger" style={{ opacity: 0.6 }}>
                      <AlertTriangle size={28} />
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800 }}>Zero Drawdown Windows</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Matrix Grid Card */}
                <div className="card">
                  <div className="card-top">
                    <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                      Stock × Intraday Time Heatmap ({sessionDate})
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Identifies which stock generated profit or loss during specific market time windows
                    </span>
                  </div>

                  <div className="matrix-container">
                    <table className="matrix-table">
                      <thead>
                        <tr>
                          <th>Stock Ticker</th>
                          {(singleSessionAnalytics.stockTimeMatrix.timeSlots || []).map(slotKey => (
                            <th key={slotKey}>
                              {singleSessionAnalytics.stockTimeMatrix.slotLabels?.[slotKey] || slotKey}
                            </th>
                          ))}
                          <th>Day Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(singleSessionAnalytics.stockTimeMatrix.matrix || []).map(row => (
                          <tr key={row.symbol}>
                            <td>{row.symbol}</td>
                            {(singleSessionAnalytics.stockTimeMatrix.timeSlots || []).map(slotKey => {
                              const cell = row.slots?.[slotKey];
                              if (!cell || cell.tradesCount === 0) {
                                return <td key={slotKey} className="matrix-cell-empty">—</td>;
                              }
                              const isProfitable = (cell.pnl || 0) >= 0;
                              return (
                                <td key={slotKey} className={isProfitable ? 'matrix-cell-profit' : 'matrix-cell-loss'}>
                                  {isProfitable ? '+' : ''}${(cell.pnl || 0).toFixed(0)}
                                  <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>{cell.tradesCount}tr</div>
                                </td>
                              );
                            })}
                            <td style={{ fontWeight: 800, color: (row.totalPnl || 0) >= 0 ? 'var(--hero-green)' : 'var(--rose-text)' }}>
                              {(row.totalPnl || 0) >= 0 ? '+' : ''}${(row.totalPnl || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>Intraday time matrix is available for sessions with timestamped raw execution logs.</p>
              </div>
            )
          )}

          {/* TAB 3: TAPE SCALPER & SPEED BREAKDOWN */}
          {sessionTab === 'scalper' && (
            <div>
              {/* Hold Speed Metrics Grid */}
              <div className="card" style={{ marginBottom: '1.25rem' }}>
                <div className="card-top">
                  <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                    Level 2 Tape Scalper Hold Time Speed Performance ({formatDisplayDate(sessionDate)})
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Realized P&amp;L and trade count segmented by scalping hold duration
                  </span>
                </div>

                <div className="hold-speed-grid">
                  {Object.values(singleSessionAnalytics.holdTimeBuckets || {}).map((b, idx) => (
                    <div key={idx} className="hold-speed-box">
                      <div className="hold-speed-label">{b.label}</div>
                      <div className="hold-speed-pnl" style={{ color: (b.pnl || 0) >= 0 ? 'var(--hero-green)' : 'var(--rose-text)' }}>
                        {(b.pnl || 0) >= 0 ? '+' : ''}${(b.pnl || 0).toFixed(2)}
                      </div>
                      <div className="hold-speed-count">{b.count || 0} scalp trades</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scalper Hold Time vs Realized P&L Scatter Plot */}
              <div className="card">
                <div className="card-top">
                  <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                    Hold Time Duration vs Realized P&amp;L Scatter Plot
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Every dot represents an individual closed trade's duration and profit outcome
                  </span>
                </div>

                <div style={{ height: '340px', width: '100%', marginTop: '0.5rem' }}>
                  {scalperScatterData && <Scatter data={scalperScatterData} options={scalperScatterOptions} />}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SESSION JOURNAL */}
          {sessionTab === 'journal' && (
            <div>
              <div className="journal-highlight-grid">
                <div className="journal-card journal-card-best">
                  <div style={{ fontWeight: 800, color: 'var(--emerald)', fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Award size={18} /> Best Trade(s) of Session
                  </div>
                  {singleSessionAnalytics.bestTrades && singleSessionAnalytics.bestTrades.length > 0 ? (
                    singleSessionAnalytics.bestTrades.map((t, idx) => (
                      <div key={idx} style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>{t.symbol}</span> ({t.side === 'B' ? 'Long' : 'Short'}) — {t.qty} shs @ ${(t.entryPrice || 0).toFixed(2)} ➔ ${(t.exitPrice || 0).toFixed(2)}
                        <span style={{ fontWeight: 800, color: 'var(--hero-green)', marginLeft: '0.5rem' }}>
                          +${(t.pnl || 0).toFixed(2)}
                        </span>
                      </div>
                    ))
                  ) : <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No winning trades recorded.</div>}
                </div>

                <div className="journal-card journal-card-worst">
                  <div style={{ fontWeight: 800, color: 'var(--rose-text)', fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <AlertTriangle size={18} /> Worst Trade(s) of Session
                  </div>
                  {singleSessionAnalytics.worstTrades && singleSessionAnalytics.worstTrades.length > 0 ? (
                    singleSessionAnalytics.worstTrades.map((t, idx) => (
                      <div key={idx} style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>{t.symbol}</span> ({t.side === 'B' ? 'Long' : 'Short'}) — {t.qty} shs @ ${(t.entryPrice || 0).toFixed(2)} ➔ ${(t.exitPrice || 0).toFixed(2)}
                        <span style={{ fontWeight: 800, color: 'var(--rose-text)', marginLeft: '0.5rem' }}>
                          -${Math.abs(t.pnl || 0).toFixed(2)}
                        </span>
                      </div>
                    ))
                  ) : <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No losing trades recorded.</div>}
                </div>
              </div>

              <div className="card">
                <div className="card-top" style={{ marginBottom: '0.75rem' }}>
                  <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                    Session Notes &amp; Market Reflections ({sessionDate})
                  </span>
                </div>
                <textarea
                  value={journalNotes}
                  onChange={(e) => setJournalNotes(e.target.value)}
                  placeholder="Write down your session reflections, strategy execution notes, market conditions, or trader mindset lessons here..."
                  style={{ minHeight: '180px' }}
                ></textarea>
                <div style={{ marginTop: '0.75rem' }}>
                  <button className="btn" onClick={onSaveJournalNotes}>
                    <Save size={16} /> Save Session Journal
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ECN & ROUTE BREAKDOWN */}
          {sessionTab === 'ecn' && (
            <div className="card">
              <div className="card-top">
                <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                  Session ECN Route &amp; Darkpool Execution Fills ({sessionDate})
                </span>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Route Venue</th>
                      <th>Type</th>
                      <th>Executed Volume</th>
                      <th>Fills Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(singleSessionAnalytics.ecnBreakdown || []).length > 0 ? (
                      (singleSessionAnalytics.ecnBreakdown || []).map((r) => (
                        <tr key={r.route}>
                          <td style={{ fontWeight: 800 }}>{r.route}</td>
                          <td>
                            <span className={`badge ${r.isDarkpool ? 'badge-darkpool' : 'badge-route'}`}>
                              {r.isDarkpool ? 'Darkpool' : 'ECN'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700 }}>{r.volume} shares</td>
                          <td>{r.fills} fills</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                          No specific ECN route execution fills recorded for this session.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: RAW LOG EDITOR */}
          {sessionTab === 'raw' && (
            <div className="card">
              <div className="card-top" style={{ marginBottom: '0.75rem' }}>
                <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                  Raw Broker Execution Log Editor ({sessionDate})
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Directly edit log text, fix missing exit fills, or add lines
                </span>
              </div>

              <textarea
                value={editingSessionLog}
                onChange={(e) => setEditingSessionLog(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '220px',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-light)',
                  marginBottom: '1rem'
                }}
              ></textarea>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn" onClick={onSaveEditedSessionLog}>
                  <Save size={16} /> Save &amp; Re-Parse Session Log
                </button>
                <button className="btn btn-secondary" onClick={() => onCopyRawLog(editingSessionLog)}>
                  <Copy size={16} /> Copy Log Text
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <p style={{ color: 'var(--text-muted)' }}>No trade logs found for date {sessionDate}. Select another date from the calendar or import new logs.</p>
        </div>
      )}
    </div>
  );
}
