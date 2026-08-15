import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Calendar as CalendarIcon
} from 'lucide-react';
import { formatDisplayDate } from '../../services/timeService';

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function getMonthCalendarGrid(year, month) {
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

export function MobileHeatmapView({
  dailyStatsMap = {},
  selectedDate,
  onSelectDate,
  onNavigateToPulse
}) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [activeSelectedDay, setActiveSelectedDay] = useState(selectedDate || null);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const grid = getMonthCalendarGrid(currentYear, currentMonth);

  // Compute total monthly Net P&L & stats
  let monthPnl = 0;
  let tradingDays = 0;
  let winningDays = 0;
  let losingDays = 0;

  for (const cell of grid) {
    if (cell.dateStr && dailyStatsMap[cell.dateStr]) {
      const stats = dailyStatsMap[cell.dateStr];
      const pnl = stats.summary?.netPnl ?? stats.netPnl ?? 0;
      monthPnl += pnl;
      tradingDays++;
      if (pnl > 0) winningDays++;
      else if (pnl < 0) losingDays++;
    }
  }

  const isMonthGreen = monthPnl >= 0;
  const selectedDayStats = activeSelectedDay ? dailyStatsMap[activeSelectedDay] : null;

  return (
    <div className="mobile-view-container">
      {/* MONTH / YEAR SELECTOR BAR */}
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
        <button className="mobile-pill-btn" onClick={handlePrevMonth} type="button">
          <ChevronLeft size={16} /> Prev
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {MONTH_NAMES[currentMonth]} {currentYear}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {tradingDays} Active Trading Days • {winningDays}W / {losingDays}L
          </div>
        </div>

        <button className="mobile-pill-btn" onClick={handleNextMonth} type="button">
          Next <ChevronRight size={16} />
        </button>
      </div>

      {/* MONTH SUMMARY BANNER */}
      <div className="mobile-month-card">
        <div className="mobile-month-title">
          <span>Monthly Net P&amp;L</span>
          <span
            className="mobile-month-pnl-chip"
            style={{
              backgroundColor: isMonthGreen ? '#d1fae5' : '#ffe4e6',
              color: isMonthGreen ? '#065f46' : '#9f1239',
              border: `1px solid ${isMonthGreen ? '#a7f3d0' : '#fecdd3'}`
            }}
          >
            {isMonthGreen ? `+$${monthPnl.toFixed(2)}` : `-$${Math.abs(monthPnl).toFixed(2)}`}
          </span>
        </div>

        {/* CALENDAR WEEKDAYS */}
        <div className="mobile-calendar-grid">
          {WEEKDAYS.map((w) => (
            <div key={w} className="mobile-weekday-header">
              {w}
            </div>
          ))}

          {/* CALENDAR DAY CELLS */}
          {grid.map((cell, idx) => {
            if (!cell.dayNum) {
              return <div key={`empty-${idx}`} style={{ opacity: 0 }} />;
            }

            const stats = cell.dateStr ? dailyStatsMap[cell.dateStr] : null;
            const hasTrades = !!stats;
            const dayPnl = stats ? (stats.summary?.netPnl ?? stats.netPnl ?? 0) : 0;
            const isSelected = activeSelectedDay === cell.dateStr;

            let bgColor = '#ffffff';
            let textColor = '#9ca3af';
            let borderColor = 'var(--border-light, #e5e7eb)';

            if (hasTrades) {
              if (dayPnl > 0) {
                bgColor = '#d1fae5';
                textColor = '#065f46';
                borderColor = '#10b981';
              } else if (dayPnl < 0) {
                bgColor = '#ffe4e6';
                textColor = '#9f1239';
                borderColor = '#f43f5e';
              } else {
                bgColor = '#f1f5f9';
                textColor = '#334155';
                borderColor = '#cbd5e1';
              }
            }

            return (
              <button
                key={cell.dateStr}
                className={`mobile-cal-cell ${isSelected ? 'selected' : ''}`}
                style={{
                  backgroundColor: bgColor,
                  color: textColor,
                  border: `1.5px solid ${borderColor}`,
                  boxShadow: isSelected ? '0 0 0 2px var(--hero-green)' : 'none'
                }}
                onClick={() => {
                  if (hasTrades) {
                    setActiveSelectedDay(cell.dateStr);
                    onSelectDate(cell.dateStr);
                  }
                }}
                type="button"
                disabled={!hasTrades}
              >
                <span>{cell.dayNum}</span>
                {hasTrades && (
                  <span style={{ fontSize: '0.58rem', fontWeight: 800, marginTop: '1px' }}>
                    {dayPnl >= 0 ? `+$${Math.round(dayPnl)}` : `-$${Math.round(Math.abs(dayPnl))}`}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* SELECTED DAY BOTTOM DETAIL CARD */}
      {selectedDayStats && activeSelectedDay && (
        <div style={{
          backgroundColor: '#ffffff',
          border: '1.5px solid var(--border-light, #e5e7eb)',
          borderRadius: '1.1rem',
          padding: '1.1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {formatDisplayDate(activeSelectedDay)}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {activeSelectedDay}
              </div>
            </div>

            <div style={{
              fontSize: '1.25rem',
              fontWeight: 900,
              color: (selectedDayStats.summary?.netPnl ?? selectedDayStats.netPnl ?? 0) >= 0 ? '#059669' : '#e11d48'
            }}>
              {(selectedDayStats.summary?.netPnl ?? selectedDayStats.netPnl ?? 0) >= 0
                ? `+$${(selectedDayStats.summary?.netPnl ?? selectedDayStats.netPnl ?? 0).toFixed(2)}`
                : `-$${Math.abs(selectedDayStats.summary?.netPnl ?? selectedDayStats.netPnl ?? 0).toFixed(2)}`}
            </div>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.76rem',
            color: 'var(--text-muted)',
            borderTop: '1px solid var(--border-light, #e5e7eb)',
            paddingTop: '0.5rem'
          }}>
            <span>Win Rate: <strong>{(selectedDayStats.summary?.winRate ?? selectedDayStats.winRate ?? 0).toFixed(1)}%</strong></span>
            <span>Trades: <strong>{selectedDayStats.summary?.totalOrders ?? selectedDayStats.totalOrders ?? 0}</strong></span>
            <span>Shares: <strong>{(selectedDayStats.summary?.totalShares ?? selectedDayStats.totalShares ?? 0).toLocaleString()}</strong></span>
          </div>

          {/* Direct CTA button to inspect in Single Session View */}
          <button
            onClick={() => {
              onSelectDate(activeSelectedDay);
              onNavigateToPulse();
            }}
            style={{
              backgroundColor: 'var(--hero-green, #064e3b)',
              border: 'none',
              borderRadius: '0.75rem',
              color: '#ffffff',
              padding: '0.75rem',
              fontWeight: 800,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              marginTop: '0.25rem'
            }}
            type="button"
          >
            <span>Open Session Deep-Dive</span>
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
