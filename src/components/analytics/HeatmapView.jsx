import React from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

export function HeatmapView({
  heatmapData,
  heatmapActiveOnly,
  setHeatmapActiveOnly,
  dailyStatsMap,
  getHeatmapDayColor,
  onSelectDate,
  selectedHeatmapYear,
  setSelectedHeatmapYear,
  availableYears = []
}) {
  const currentYear = selectedHeatmapYear || new Date().getFullYear();

  return (
    <div>
      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Calendar size={18} color="var(--hero-green)" />
            <span>{currentYear} Daily Return Density</span>
          </div>

          {/* Dynamic Year Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: '#f1f5f9', borderRadius: '999px', padding: '2px 6px' }}>
            <button
              className="popover-month-nav"
              style={{ padding: '2px' }}
              onClick={() => setSelectedHeatmapYear(currentYear - 1)}
              title="Previous Year"
            >
              <ChevronLeft size={14} />
            </button>
            <select
              value={currentYear}
              onChange={(e) => setSelectedHeatmapYear(parseInt(e.target.value, 10))}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                cursor: 'pointer',
                outline: 'none',
                padding: '0 4px'
              }}
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              className="popover-month-nav"
              style={{ padding: '2px' }}
              onClick={() => setSelectedHeatmapYear(currentYear + 1)}
              title="Next Year"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <button className="btn btn-secondary" onClick={() => setHeatmapActiveOnly(!heatmapActiveOnly)}>
          {heatmapActiveOnly ? 'Show All 12 Months' : 'Show Active Months Only'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {heatmapData.map(m => (
          <div key={m.monthIndex} className="card" style={{ padding: '1rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--text-main)', display: 'flex', justifyContent: 'space-between' }}>
              <span>{m.name}</span>
              {m.hasData && <span style={{ fontSize: '0.7rem', color: 'var(--hero-green)', fontWeight: 800 }}>Active</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.35rem' }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((wd, idx) => (
                <div key={idx} style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600 }}>{wd}</div>
              ))}
              {m.days.map((day, dIdx) => {
                const dayStat = day.dateStr ? dailyStatsMap[day.dateStr] : null;
                return (
                  <div
                    key={dIdx}
                    title={dayStat ? `${day.dateStr}: ${(dayStat.pnl || 0) >= 0 ? '+' : ''}$${(dayStat.pnl || 0).toFixed(2)} (${dayStat.totalOrders || 0} trades)` : ''}
                    style={{
                      aspectRatio: '1',
                      borderRadius: '0.25rem',
                      backgroundColor: getHeatmapDayColor(day.dateStr),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: dayStat && Math.abs(dayStat.pnl || 0) > 100 ? '#ffffff' : '#111827',
                      cursor: day.dateStr && dailyStatsMap[day.dateStr] ? 'pointer' : 'default',
                      transition: 'transform 0.15s ease'
                    }}
                    onClick={() => {
                      if (day.dateStr && dailyStatsMap[day.dateStr]) {
                        onSelectDate(day.dateStr);
                      }
                    }}
                  >
                    {day.dayNum}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
