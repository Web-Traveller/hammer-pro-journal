import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  TrendingUp,
  Percent,
  Award,
  Calendar,
  Layers,
  Activity,
  ArrowRight
} from 'lucide-react';
import { smoothEquityChartOptions, getEquityGradient } from '../../utils/chartConfig';

export function MobileDashboardView({
  dailyStatsMap = {},
  onSelectDate,
  onNavigateToSession,
  onNavigateToCalendar
}) {
  const sortedDates = Object.keys(dailyStatsMap).sort();

  let totalNetPnl = 0;
  let totalGrossPnl = 0;
  let totalTrades = 0;
  let totalWinningTrades = 0;
  let totalGrossProfit = 0;
  let totalGrossLoss = 0;
  let bestDay = { date: '', pnl: -Infinity };
  let worstDay = { date: '', pnl: Infinity };

  const cumulativeCurve = [];
  let runningPnl = 0;

  sortedDates.forEach((d) => {
    const stats = dailyStatsMap[d];
    if (!stats) return;

    const net = stats.netPnl ?? stats.pnl ?? 0;
    const gross = stats.grossPnl ?? stats.pnl ?? net;
    const orders = stats.totalOrders ?? stats.tradesCount ?? (stats.matchedTrades ? stats.matchedTrades.length : 0);
    const winTrades = stats.winTradesCount !== undefined
      ? stats.winTradesCount
      : (stats.winRate !== undefined && orders > 0
          ? Math.round((stats.winRate / 100) * orders)
          : (net > 0 ? orders : 0));

    const dayGrossProfit = stats.grossProfit !== undefined ? stats.grossProfit : (net > 0 ? net : 0);
    const dayGrossLoss = stats.grossLoss !== undefined ? stats.grossLoss : (net < 0 ? Math.abs(net) : 0);

    totalNetPnl += net;
    totalGrossPnl += gross;
    totalTrades += orders;
    totalWinningTrades += winTrades;
    totalGrossProfit += dayGrossProfit;
    totalGrossLoss += dayGrossLoss;

    if (net > bestDay.pnl) bestDay = { date: d, pnl: net };
    if (net < worstDay.pnl) worstDay = { date: d, pnl: net };

    runningPnl += net;
    cumulativeCurve.push({ date: d, pnl: runningPnl });
  });

  const overallWinRate = totalTrades > 0 ? ((totalWinningTrades / totalTrades) * 100).toFixed(1) : '0.0';
  const overallProfitFactor = totalGrossLoss > 0
    ? (totalGrossProfit / totalGrossLoss).toFixed(2)
    : totalGrossProfit > 0 ? '99.99' : '0.00';

  const isGreen = totalNetPnl >= 0;

  const chartData = {
    labels: cumulativeCurve.map(c => c.date.slice(5)), // MM-DD
    datasets: [
      {
        data: cumulativeCurve.map(c => c.pnl),
        borderColor: isGreen ? '#059669' : '#e11d48',
        backgroundColor: (context) => getEquityGradient(context),
        borderWidth: 2.5,
        pointRadius: cumulativeCurve.length > 20 ? 0 : 3,
        pointBackgroundColor: isGreen ? '#059669' : '#e11d48',
        tension: 0.25,
        fill: true
      }
    ]
  };

  const chartOptions = smoothEquityChartOptions;

  return (
    <div className="mobile-view-container">
      {/* CUMULATIVE P&L HERO CARD */}
      <div className={`mobile-hero-card ${isGreen ? 'profit' : 'loss'}`}>
        <div className="mobile-hero-top">
          <span className="mobile-hero-tag">OVERALL TRADING ACCOUNT</span>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, opacity: 0.9 }}>
            {sortedDates.length} Days Traded
          </span>
        </div>

        <div className="mobile-hero-pnl-group">
          <span className="mobile-hero-label">Total Realized Net P&amp;L</span>
          <div className="mobile-hero-value">
            {totalNetPnl >= 0
              ? `+$${totalNetPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : `-$${Math.abs(totalNetPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
        </div>

        <div className="mobile-hero-footer">
          <span>Gross P&amp;L: <strong>${totalGrossPnl.toFixed(2)}</strong></span>
          <span>Total Trades: <strong>{totalTrades.toLocaleString()}</strong></span>
        </div>
      </div>

      {/* 4 OVERALL METRICS */}
      <div className="mobile-metrics-grid">
        <div className="mobile-metric-card">
          <div className="mobile-metric-header">
            <span>Overall Win Rate</span>
            <Percent size={14} color="#059669" />
          </div>
          <div className="mobile-metric-val" style={{ color: Number(overallWinRate) >= 50 ? '#059669' : '#e11d48' }}>
            {overallWinRate}%
          </div>
        </div>

        <div className="mobile-metric-card">
          <div className="mobile-metric-header">
            <span>Profit Factor</span>
            <Award size={14} color="#0284c7" />
          </div>
          <div className="mobile-metric-val" style={{ color: Number(overallProfitFactor) >= 1.5 ? '#0284c7' : 'inherit' }}>
            {Number(overallProfitFactor) >= 99 ? '∞' : overallProfitFactor}
          </div>
        </div>

        <div className="mobile-metric-card">
          <div className="mobile-metric-header">
            <span>Best Session</span>
            <TrendingUp size={14} color="#059669" />
          </div>
          <div className="mobile-metric-val" style={{ fontSize: '1.05rem', color: '#059669' }}>
            {bestDay.date ? `+$${bestDay.pnl.toFixed(2)}` : '$0.00'}
          </div>
        </div>

        <div className="mobile-metric-card">
          <div className="mobile-metric-header">
            <span>Worst Session</span>
            <Activity size={14} color="#e11d48" />
          </div>
          <div className="mobile-metric-val" style={{ fontSize: '1.05rem', color: '#e11d48' }}>
            {worstDay.date ? `-$${Math.abs(worstDay.pnl).toFixed(2)}` : '$0.00'}
          </div>
        </div>
      </div>

      {/* CUMULATIVE EQUITY CURVE */}
      {cumulativeCurve.length > 0 && (
        <div className="mobile-chart-card">
          <div className="mobile-chart-header">
            <span>Cumulative Portfolio Equity</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isGreen ? '#059669' : '#e11d48' }}>
              {sortedDates.length} Sessions Curve
            </span>
          </div>
          <div className="mobile-chart-canvas">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {/* RECENT SESSIONS LIST (Top 4) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Recent Sessions (Top 4 of {sortedDates.length})
        </div>
        <div className="mobile-stock-list">
          {sortedDates.slice().reverse().slice(0, 4).map((dateStr) => {
            const stats = dailyStatsMap[dateStr];
            if (!stats) return null;

            const pnl = stats.netPnl ?? stats.pnl ?? 0;
            const trades = stats.totalOrders ?? stats.tradesCount ?? 0;
            const dayGreen = pnl >= 0;

            return (
              <div
                key={dateStr}
                className="mobile-stock-row"
                onClick={() => {
                  onSelectDate(dateStr);
                  onNavigateToSession();
                }}
              >
                <div>
                  <div className="mobile-stock-sym">{dateStr}</div>
                  <div className="mobile-stock-shares">{trades} trades executed</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="mobile-stock-pnl" style={{ color: dayGreen ? '#059669' : '#e11d48' }}>
                    {dayGreen ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`}
                  </div>
                  <ArrowRight size={14} color="var(--text-muted)" />
                </div>
              </div>
            );
          })}
        </div>

        {sortedDates.length > 4 && onNavigateToCalendar && (
          <button
            onClick={onNavigateToCalendar}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-light, #e5e7eb)',
              borderRadius: '0.85rem',
              color: 'var(--hero-green, #064e3b)',
              padding: '0.75rem',
              fontWeight: 800,
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              marginTop: '0.25rem'
            }}
            type="button"
          >
            <Calendar size={15} />
            <span>View All {sortedDates.length} Sessions in Calendar</span>
          </button>
        )}
      </div>
    </div>
  );
}
