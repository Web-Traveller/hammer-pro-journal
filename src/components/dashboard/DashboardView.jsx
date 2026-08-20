import React from 'react';
import { Line } from 'react-chartjs-2';
import {
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
  Award,
  AlertTriangle
} from 'lucide-react';

export function DashboardView({
  dashboardMonthFilter,
  setDashboardMonthFilter,
  availableMonths,
  handlePrevMonth,
  handleNextMonth,
  filteredDashboardAnalytics,
  hourlyAnalytics,
  settings = {},
  timezone = 'US_EASTERN',
  smoothEquityChartOptions
}) {
  const formatHoldTime = (secs) => {
    if (!secs || secs < 0) return '0s';
    if (secs < 60) return `${Math.round(secs)}s`;
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}m ${s}s`;
  };

  const cumulativeEquityChartData = React.useMemo(() => {
    if (!filteredDashboardAnalytics || !filteredDashboardAnalytics.equityCurve) return null;
    const curve = filteredDashboardAnalytics.equityCurve;
    return {
      labels: curve.map(c => c.date),
      datasets: [
        {
          label: 'Accumulated Equity ($)',
          data: curve.map(c => c.cumulativePnl),
          borderColor: filteredDashboardAnalytics.totalPnl >= 0 ? '#10b981' : '#f43f5e',
          backgroundColor: filteredDashboardAnalytics.totalPnl >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)',
          fill: true,
          pointRadius: curve.length > 30 ? 0 : 3,
          pointHoverRadius: 6
        }
      ]
    };
  }, [filteredDashboardAnalytics]);

  return (
    <div>
      {/* Top Month Time Horizon Bar */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>Time Horizon:</span>
          
          <div className="month-nav-bar">
            <button className="month-nav-btn" onClick={handlePrevMonth} title="Previous Month">
              <ChevronLeft size={18} />
            </button>
            
            <select
              value={dashboardMonthFilter}
              onChange={(e) => setDashboardMonthFilter(e.target.value)}
              className="form-select"
              style={{ border: 'none', background: 'transparent', padding: '0.35rem 0.5rem', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}
            >
              <option value="ALL">All Time (Entire History)</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <button className="month-nav-btn" onClick={handleNextMonth} title="Next Month">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {dashboardMonthFilter !== 'ALL' && (
          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }} onClick={() => setDashboardMonthFilter('ALL')}>
            Reset to All Time
          </button>
        )}
      </div>

      <div className="grid-cards">
        {/* Card 1: Net P&L Hero Card */}
        <div className="card card-hero">
          <div className="card-top">
            <span className="card-title">
              {settings?.enableFees ? 'Accumulated Net P&L' : 'Accumulated Realized P&L'}
            </span>
            <button className="card-icon-btn"><ArrowUpRight size={16} /></button>
          </div>
          <div className="card-value">
            {(filteredDashboardAnalytics.totalPnl || 0) >= 0 ? '+' : ''}${((filteredDashboardAnalytics.totalPnl || 0)).toFixed(2)}
          </div>
          <span className="card-footer-tag tag-profit">
            {settings?.enableFees ? `Gross: $${(filteredDashboardAnalytics.grossPnl || 0).toFixed(2)} • Fees: $${(filteredDashboardAnalytics.totalFees || 0).toFixed(2)}` : 'Realized Total Return'}
          </span>
        </div>

        {/* Card 2: Win Rate % */}
        <div className="card">
          <div className="card-top">
            <span className="card-title">Overall Win Rate</span>
            <button className="card-icon-btn"><Percent size={16} color="var(--hero-green)" /></button>
          </div>
          <div className="card-value" style={{ color: 'var(--hero-green)' }}>
            {(filteredDashboardAnalytics.winRate || 0).toFixed(2)}%
          </div>
          <span className="card-footer-tag" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
            Profit Factor: <strong style={{ marginLeft: '4px', color: 'var(--hero-green)' }}>{(filteredDashboardAnalytics.profitFactor || 0).toFixed(2)}</strong>
          </span>
        </div>

        {/* Card 3: Total Trades Closed */}
        <div className="card">
          <div className="card-top">
            <span className="card-title">Total Trades Closed</span>
            <button className="card-icon-btn"><FileText size={16} /></button>
          </div>
          <div className="card-value">{filteredDashboardAnalytics.totalTrades || 0}</div>
          <span className="card-footer-tag" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
            {filteredDashboardAnalytics.roundTripShares || 0} Round-Trip Shares
          </span>
        </div>

        {/* Card 4: Avg Hold Duration */}
        <div className="card">
          <div className="card-top">
            <span className="card-title">Avg Hold Duration</span>
            <button className="card-icon-btn"><Clock size={16} /></button>
          </div>
          <div className="card-value">{formatHoldTime(filteredDashboardAnalytics.avgHoldTime || 0)}</div>
          <span className="card-footer-tag" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
            Average Position Hold
          </span>
        </div>
      </div>

      {/* All-Time Level 2 Scalper Performance Bar */}
      <div className="scalper-metrics-grid">
        <div className="scalper-card">
          <div className="scalper-card-title">
            <span>Net Edge / Share</span>
            <Zap size={14} color="var(--hero-green)" />
          </div>
          <div className="scalper-card-val" style={{ color: (filteredDashboardAnalytics.netCentsPerShare || 0) >= 0 ? 'var(--hero-green)' : 'var(--rose-text)' }}>
            {(filteredDashboardAnalytics.netCentsPerShare || 0) >= 0 ? '+' : ''}{(filteredDashboardAnalytics.netCentsPerShare || 0).toFixed(2)}¢
          </div>
          <div className="scalper-card-sub">All-time realized profit per share</div>
        </div>

        <div className="scalper-card">
          <div className="scalper-card-title">
            <span>Win vs Loss / Share</span>
            <Scale size={14} color="#3b82f6" />
          </div>
          <div className="scalper-card-val" style={{ fontSize: '1.05rem' }}>
            <span style={{ color: 'var(--hero-green)' }}>+{(filteredDashboardAnalytics.avgCentsPerWinShare || 0).toFixed(1)}¢</span>
            <span style={{ color: 'var(--text-light)', margin: '0 4px' }}>/</span>
            <span style={{ color: 'var(--rose-text)' }}>-{(filteredDashboardAnalytics.avgCentsPerLossShare || 0).toFixed(1)}¢</span>
          </div>
          <div className="scalper-card-sub">Expectancy ratio in cents</div>
        </div>

        <div className="scalper-card">
          <div className="scalper-card-title">
            <span>Max Equity Drawdown</span>
            <DollarSign size={14} color="#f43f5e" />
          </div>
          <div className="scalper-card-val" style={{ color: (filteredDashboardAnalytics.maxDrawdown || 0) > 0 ? 'var(--rose-text)' : 'var(--hero-green)' }}>
            {(filteredDashboardAnalytics.maxDrawdown || 0) > 0 ? `-$${(filteredDashboardAnalytics.maxDrawdown || 0).toFixed(2)}` : '$0.00'}
          </div>
          <div className="scalper-card-sub">
            {filteredDashboardAnalytics.maxWinStreak > 0 ? `Max Win Streak: ${filteredDashboardAnalytics.maxWinStreak} session(s)` : 'Peak-to-trough max dip'}
          </div>
        </div>

        <div className="scalper-card">
          <div className="scalper-card-title">
            <span>Total Shares Scalped</span>
            <Layers size={14} color="#d97706" />
          </div>
          <div className="scalper-card-val">
            {(filteredDashboardAnalytics.totalShares || 0).toLocaleString()}
          </div>
          <div className="scalper-card-sub">{(filteredDashboardAnalytics.roundTripShares || 0).toLocaleString()} round-trip shares</div>
        </div>
      </div>

      {/* Monthly Accumulated Intraday Equity Growth Chart */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-top">
          <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
            {dashboardMonthFilter === 'ALL' ? 'All-Time Accumulated Equity Curve' : `Accumulated Equity Growth (${dashboardMonthFilter})`}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Timezone: {timezone === 'INDIA_IST' ? '🇮🇳 Indian Standard Time (IST)' : '🇺🇸 US Eastern Market Time (EDT)'}
          </span>
        </div>
        <div className="chart-container">
          {cumulativeEquityChartData && <Line data={cumulativeEquityChartData} options={smoothEquityChartOptions} />}
        </div>
      </div>

      {/* Intraday Time-of-Day Performance Breakdown */}
      {hourlyAnalytics && hourlyAnalytics.length > 0 && (
        <div className="card">
          <div className="card-top">
            <div>
              <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={18} color="var(--hero-green)" /> Time-of-Day Hourly Performance (Golden Hour Finder)
              </span>
              <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Analyze intraday trading hours to discover your highest win rate & profit windows across 30-minute market time slots
              </span>
            </div>
          </div>

          {/* Aggregate Golden Window & Danger Window Banners */}
          {(() => {
            const sortedByPnl = [...hourlyAnalytics].sort((a, b) => {
              const aPnl = (settings?.enableFees ? (a.netPnl ?? a.pnl) : a.pnl) || 0;
              const bPnl = (settings?.enableFees ? (b.netPnl ?? b.pnl) : b.pnl) || 0;
              return bPnl - aPnl;
            });
            const bestSlot = sortedByPnl.find(s => ((settings?.enableFees ? (s.netPnl ?? s.pnl) : s.pnl) || 0) > 0);
            const worstSlot = [...sortedByPnl].reverse().find(s => ((settings?.enableFees ? (s.netPnl ?? s.pnl) : s.pnl) || 0) < 0);

            if (!bestSlot && !worstSlot) return null;

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                {bestSlot && (
                  <div className="window-badge-golden">
                    <Award size={28} />
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Golden Window (Peak Edge)
                      </div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                        {bestSlot.hourLabel || bestSlot.slotKey} — +${((settings?.enableFees ? (bestSlot.netPnl ?? bestSlot.pnl) : bestSlot.pnl) || 0).toFixed(2)}
                      </div>
                      <div style={{ fontSize: '0.72rem', opacity: 0.85 }}>
                        {bestSlot.tradesCount || 0} trades • {(bestSlot.winRate || 0).toFixed(0)}% win rate
                      </div>
                    </div>
                  </div>
                )}

                {worstSlot && (
                  <div className="window-badge-danger">
                    <AlertTriangle size={28} />
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Danger Window (Chop / Loss Zone)
                      </div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                        {worstSlot.hourLabel || worstSlot.slotKey} — -${Math.abs((settings?.enableFees ? (worstSlot.netPnl ?? worstSlot.pnl) : worstSlot.pnl) || 0).toFixed(2)}
                      </div>
                      <div style={{ fontSize: '0.72rem', opacity: 0.85 }}>
                        {worstSlot.tradesCount || 0} trades • {(worstSlot.winRate || 0).toFixed(0)}% win rate
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          <div className="hourly-grid">
            {(() => {
              const pnlList = hourlyAnalytics.map(h => (settings?.enableFees ? (h.netPnl ?? h.pnl) : h.pnl) || 0);
              const maxHourPnl = pnlList.length > 0 ? Math.max(...pnlList) : 0;
              return hourlyAnalytics.map(h => {
                const pnlVal = (settings?.enableFees ? (h.netPnl ?? h.pnl) : h.pnl) || 0;
                const isBest = pnlVal > 0 && pnlVal === maxHourPnl;
                return (
                  <div key={h.slotKey} className={`hourly-card ${isBest ? 'best-hour' : ''}`}>
                    <div className="hourly-card-time">{h.hourLabel}</div>
                    <div className="hourly-card-pnl" style={{ color: pnlVal >= 0 ? 'var(--hero-green)' : 'var(--rose-text)' }}>
                      {pnlVal >= 0 ? '+' : ''}${pnlVal.toFixed(2)}
                    </div>
                    <div className="hourly-card-meta">
                      {h.tradesCount || 0} Trades • {(h.winRate || 0).toFixed(0)}% Win
                    </div>
                    {isBest && (
                      <span className="badge badge-darkpool" style={{ marginTop: '0.4rem', backgroundColor: '#d1fae5', color: '#065f46', fontSize: '0.68rem' }}>
                        🌟 Golden Hour
                      </span>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
