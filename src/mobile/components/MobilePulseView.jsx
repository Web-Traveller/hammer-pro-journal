import React, { useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  ChevronLeft,
  ChevronRight,
  Percent,
  Layers,
  Clock,
  Award,
  ChevronDown,
  ChevronUp,
  Activity,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { formatDisplayDate } from '../../services/timeService';
import { getIntradayChartOptions, getEquityGradient } from '../../utils/chartConfig';

export function MobilePulseView({
  sessionDate,
  setSessionDate,
  availableDates = [],
  analytics,
  timezone
}) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [expandedStock, setExpandedStock] = useState(null);

  // If no date or date not in list, auto-fallback to latest available session
  const effectiveDate = sessionDate && availableDates.includes(sessionDate)
    ? sessionDate
    : (availableDates.length > 0 ? availableDates[0] : sessionDate);

  const currentIndex = availableDates.indexOf(effectiveDate);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < availableDates.length - 1;

  const handlePrev = () => {
    if (hasPrev) setSessionDate(availableDates[currentIndex - 1]);
  };

  const handleNext = () => {
    if (hasNext) setSessionDate(availableDates[currentIndex + 1]);
  };

  if (!analytics) {
    return (
      <div className="mobile-view-container" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
          No Session Log Loaded
        </div>
        <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          {availableDates.length > 0
            ? 'Tap below to open your most recent trading session.'
            : 'Import trade logs on desktop or sync your account.'}
        </div>
        {availableDates.length > 0 && (
          <button
            className="mobile-pill-btn"
            style={{ margin: '0 auto', padding: '0.65rem 1.35rem', fontSize: '0.88rem', backgroundColor: 'var(--hero-green)', color: '#ffffff' }}
            onClick={() => setSessionDate(availableDates[0])}
            type="button"
          >
            Load Latest Session ({availableDates[0]})
          </button>
        )}
      </div>
    );
  }

  // Extract metrics directly from analytics object (robust against flat vs summary structure)
  const netPnl = analytics.netPnl ?? analytics.pnl ?? 0;
  const grossPnl = analytics.grossPnl ?? analytics.pnl ?? 0;
  const totalOrders = analytics.totalOrders ?? analytics.tradesCount ?? (analytics.matchedTrades ? analytics.matchedTrades.length : 0);
  const totalShares = analytics.totalShares ?? analytics.totalVolume ?? (analytics.roundTripShares ? analytics.roundTripShares * 2 : 0);
  const winRate = analytics.winRate !== undefined
    ? analytics.winRate
    : (totalOrders > 0 && analytics.winTradesCount !== undefined
        ? (analytics.winTradesCount / totalOrders) * 100
        : (netPnl > 0 ? 100 : 0));
  const profitFactor = analytics.profitFactor ?? 0;
  const avgHoldTime = analytics.avgHoldTime ?? 0;
  const darkpoolVolume = analytics.dayDarkpoolVolume ?? (analytics.stockDarkpoolSummary ? analytics.stockDarkpoolSummary.reduce((a, b) => a + (b.darkpoolVolume || 0), 0) : 0);
  const darkpoolRatio = totalShares > 0 ? (darkpoolVolume / totalShares) * 100 : 0;
  const stockBreakdown = analytics.stockBreakdown || [];

  // Intraday equity curve points
  const curvePoints = analytics.intradayEquityCurve || analytics.intradayPnl || [];

  const isGreen = netPnl > 0;
  const isRed = netPnl < 0;
  const heroClass = isGreen ? 'profit' : isRed ? 'loss' : 'neutral';

  const chartData = {
    labels: curvePoints.map((p) => p.timeLabel || p.time || ''),
    datasets: [
      {
        data: curvePoints.map((p) => p.execPnl ?? p.cumulativePnl ?? 0),
        borderColor: isGreen ? '#059669' : '#e11d48',
        backgroundColor: (context) => getEquityGradient(context),
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0.25,
        fill: true
      }
    ]
  };

  const chartOptions = getIntradayChartOptions(false);

  return (
    <div className="mobile-view-container">
      {/* SESSION DATE SELECTOR BAR */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
        padding: '0.6rem 0.85rem',
        borderRadius: '1rem',
        border: '1px solid var(--border-light, #e5e7eb)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <button
          className="mobile-pill-btn"
          onClick={handleNext}
          disabled={!hasNext}
          style={{ opacity: hasNext ? 1 : 0.35, padding: '0.3rem 0.6rem' }}
          type="button"
        >
          <ChevronLeft size={16} /> Older
        </button>

        {/* Center Tap to Select Date */}
        <button
          onClick={() => setShowDatePicker(!showDatePicker)}
          style={{
            background: 'none',
            border: 'none',
            textAlign: 'center',
            cursor: 'pointer',
            padding: '2px 8px'
          }}
          type="button"
        >
          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {formatDisplayDate(effectiveDate)}
            <ChevronDown size={14} color="var(--text-muted)" />
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            {effectiveDate} • {timezone === 'US_EASTERN' ? 'EDT' : 'IST'}
          </div>
        </button>

        <button
          className="mobile-pill-btn"
          onClick={handlePrev}
          disabled={!hasPrev}
          style={{ opacity: hasPrev ? 1 : 0.35, padding: '0.3rem 0.6rem' }}
          type="button"
        >
          Newer <ChevronRight size={16} />
        </button>
      </div>

      {/* QUICK SESSION PICKER DROPDOWN */}
      {showDatePicker && availableDates.length > 0 && (
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-light, #e5e7eb)',
          borderRadius: '1rem',
          padding: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
          maxHeight: '220px',
          overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', paddingBottom: '4px' }}>
            Select Trading Session ({availableDates.length})
          </div>
          {availableDates.map((d) => (
            <button
              key={d}
              onClick={() => {
                setSessionDate(d);
                setShowDatePicker(false);
              }}
              style={{
                textAlign: 'left',
                padding: '0.6rem 0.85rem',
                borderRadius: '0.65rem',
                border: d === effectiveDate ? '1.5px solid var(--hero-green)' : '1px solid transparent',
                backgroundColor: d === effectiveDate ? 'rgba(6, 78, 59, 0.06)' : 'transparent',
                fontWeight: d === effectiveDate ? 800 : 600,
                fontSize: '0.84rem',
                color: d === effectiveDate ? 'var(--hero-green)' : 'var(--text-main)',
                cursor: 'pointer'
              }}
              type="button"
            >
              {d} — {formatDisplayDate(d)}
            </button>
          ))}
        </div>
      )}

      {/* HERO P&L BANNER */}
      <div className={`mobile-hero-card ${heroClass}`}>
        <div className="mobile-hero-top">
          <span className="mobile-hero-tag">
            {isGreen ? 'WINNING SESSION' : isRed ? 'LOSING SESSION' : 'BREAK EVEN'}
          </span>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, opacity: 0.9 }}>
            {totalOrders} Trades Executed
          </span>
        </div>

        <div className="mobile-hero-pnl-group">
          <span className="mobile-hero-label">Net Realized P&amp;L</span>
          <div className="mobile-hero-value">
            {netPnl >= 0
              ? `+$${netPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : `-$${Math.abs(netPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
        </div>

        <div className="mobile-hero-footer">
          <span>Gross P&amp;L: <strong>${grossPnl?.toFixed(2)}</strong></span>
          <span>Volume: <strong>{totalShares?.toLocaleString()} shs</strong></span>
        </div>
      </div>

      {/* 4 QUICK METRIC CHIPS */}
      <div className="mobile-metrics-grid">
        <div className="mobile-metric-card">
          <div className="mobile-metric-header">
            <span>Win Rate</span>
            <Percent size={14} color="#059669" />
          </div>
          <div className="mobile-metric-val" style={{ color: winRate >= 50 ? '#059669' : '#e11d48' }}>
            {Number(winRate).toFixed(1)}%
          </div>
        </div>

        <div className="mobile-metric-card">
          <div className="mobile-metric-header">
            <span>Profit Factor</span>
            <Award size={14} color="#0284c7" />
          </div>
          <div className="mobile-metric-val" style={{ color: Number(profitFactor) >= 1.5 ? '#0284c7' : 'inherit' }}>
            {Number(profitFactor) >= 99 ? '∞' : Number(profitFactor).toFixed(2)}
          </div>
        </div>

        <div className="mobile-metric-card">
          <div className="mobile-metric-header">
            <span>Avg Hold Time</span>
            <Clock size={14} color="#7c3aed" />
          </div>
          <div className="mobile-metric-val" style={{ fontSize: '1.1rem' }}>
            {avgHoldTime ? `${Math.round(avgHoldTime)}s` : 'N/A'}
          </div>
        </div>

        <div className="mobile-metric-card">
          <div className="mobile-metric-header">
            <span>Darkpool Ratio</span>
            <Layers size={14} color="#d97706" />
          </div>
          <div className="mobile-metric-val" style={{ color: '#d97706' }}>
            {Number(darkpoolRatio).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* INTRADAY P&L EQUITY CURVE */}
      {curvePoints.length > 0 && (
        <div className="mobile-chart-card">
          <div className="mobile-chart-header">
            <span>Intraday Cumulative P&amp;L</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isGreen ? '#059669' : '#e11d48' }}>
              {isGreen ? '↗ Profitable Day' : '↘ Drawdown Day'}
            </span>
          </div>
          <div className="mobile-chart-canvas">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {/* TICKER BREAKDOWN ACCORDION */}
      {stockBreakdown && stockBreakdown.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Stock Breakdown ({stockBreakdown.length} Tickers)
          </div>
          <div className="mobile-stock-list">
            {stockBreakdown.map((s) => {
              const stockNet = s.netPnl ?? s.pnl ?? 0;
              const stockGreen = stockNet >= 0;
              const isExpanded = expandedStock === s.symbol;

              return (
                <div
                  key={s.symbol}
                  className="mobile-stock-row"
                  style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}
                  onClick={() => setExpandedStock(isExpanded ? null : s.symbol)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div className="mobile-stock-sym" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {s.symbol}
                        {isExpanded ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
                      </div>
                      <div className="mobile-stock-shares">
                        {(s.totalShares || s.totalQty || 0).toLocaleString()} shares • {s.executions ? s.executions.length : (s.tradesCount || 0)} fills
                      </div>
                    </div>
                    <div className="mobile-stock-pnl" style={{ color: stockGreen ? '#059669' : '#e11d48' }}>
                      {stockGreen ? `+$${stockNet.toFixed(2)}` : `-$${Math.abs(stockNet).toFixed(2)}`}
                    </div>
                  </div>

                  {/* Expanded Executions Details */}
                  {isExpanded && s.executions && s.executions.length > 0 && (
                    <div style={{
                      marginTop: '0.5rem',
                      paddingTop: '0.5rem',
                      borderTop: '1px solid var(--border-light, #e5e7eb)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem'
                    }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                        Execution Fills ({s.executions.length})
                      </div>
                      {s.executions.map((exec, eIdx) => (
                        <div
                          key={eIdx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.75rem',
                            padding: '3px 0'
                          }}
                        >
                          <span style={{ color: exec.action === 'Bought' ? '#059669' : '#e11d48', fontWeight: 700 }}>
                            {exec.action} {exec.execQty} shs @ ${exec.execPrice?.toFixed(2)}
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {exec.timeStr || exec.timeLabel || ''} ({exec.route || 'DIRECT'})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
