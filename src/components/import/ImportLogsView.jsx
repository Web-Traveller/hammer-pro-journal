import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Plus,
  Trash2,
  X,
  FileText,
  Edit3,
  Search,
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import { formatDisplayDate } from '../../services/timeService';

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

export function ImportLogsView({
  selectedDate,
  setSelectedDate,
  showImportCalendar,
  setShowImportCalendar,
  importPopYear,
  setImportPopYear,
  importPopMonth,
  setImportPopMonth,
  importCalendarRef,
  dailyStatsMap,
  settings,
  onSaveSettings,
  pastedText,
  setPastedText,
  onPasteChange,
  pendingScreenshots,
  setPendingScreenshots,
  onFileSelect,
  onRemovePendingScreenshot,
  onTriggerPreImport,
  onTriggerManualPreImport,
  onSaveManualSession,
  logs,
  onInspectSession,
  onDeleteLog
}) {
  const [importMode, setImportMode] = useState('raw'); // 'raw' | 'manual'
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [sidebarMonthFilter, setSidebarMonthFilter] = useState('ALL');

  // Manual Summary Form State
  const [manualNetPnl, setManualNetPnl] = useState('');
  const [manualGrossPnl, setManualGrossPnl] = useState('');
  const [manualTotalShares, setManualTotalShares] = useState('');
  const [manualTotalTrades, setManualTotalTrades] = useState('');
  const [manualWinTrades, setManualWinTrades] = useState('');
  const [manualLossTrades, setManualLossTrades] = useState('');
  const [manualLongTrades, setManualLongTrades] = useState('');
  const [manualShortTrades, setManualShortTrades] = useState('');
  const [manualTickers, setManualTickers] = useState('');
  const [manualNotes, setManualNotes] = useState('');

  // Extract available months from logs
  const availableMonths = useMemo(() => {
    const months = new Set();
    Object.keys(logs || {}).forEach(d => {
      if (d && d.length >= 7) {
        months.add(d.substring(0, 7));
      }
    });
    return Array.from(months).sort().reverse();
  }, [logs]);

  // Filtered session list for sidebar
  const filteredSessions = useMemo(() => {
    const allDates = Object.keys(logs || {}).sort().reverse();
    return allDates.filter(date => {
      if (sidebarMonthFilter !== 'ALL' && !date.startsWith(sidebarMonthFilter)) {
        return false;
      }
      if (sidebarSearch.trim()) {
        const query = sidebarSearch.trim().toLowerCase();
        const displayDate = formatDisplayDate(date).toLowerCase();
        const stats = dailyStatsMap ? dailyStatsMap[date] : null;
        const tickers = (stats?.symbols || stats?.stockBreakdown?.map(s => s.symbol) || []).join(' ').toLowerCase();
        if (!date.toLowerCase().includes(query) && !displayDate.includes(query) && !tickers.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [logs, sidebarMonthFilter, sidebarSearch, dailyStatsMap]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!selectedDate) return;
    const manualPayload = {
      date: selectedDate,
      netPnl: manualNetPnl,
      grossPnl: manualGrossPnl,
      totalShares: manualTotalShares,
      totalTrades: manualTotalTrades,
      winTradesCount: manualWinTrades,
      lossTradesCount: manualLossTrades,
      longTrades: manualLongTrades,
      shortTrades: manualShortTrades,
      tickers: manualTickers,
      notes: manualNotes
    };

    if (onTriggerManualPreImport) {
      onTriggerManualPreImport(manualPayload);
    } else if (onSaveManualSession) {
      onSaveManualSession(manualPayload);
    }
  };

  // Reusable Calendar Popover Picker
  const renderCalendarPicker = (isFullWidth = false) => (
    <div className="calendar-picker-wrapper" ref={importCalendarRef} style={{ position: 'relative', width: isFullWidth ? '100%' : 'auto', zIndex: 60 }}>
      <button
        type="button"
        className="calendar-trigger-btn"
        onClick={() => setShowImportCalendar(!showImportCalendar)}
        style={{ width: isFullWidth ? '100%' : 'auto', justifyContent: isFullWidth ? 'flex-start' : 'center' }}
      >
        <CalendarDays size={16} color="var(--hero-green)" />
        <span style={{ fontWeight: 700 }}>{formatDisplayDate(selectedDate) || selectedDate || 'Select Date'}</span>
      </button>

      {showImportCalendar && (
        <div
          className="calendar-popover"
          style={{
            position: 'absolute',
            top: '115%',
            left: '0',
            width: '320px',
            backgroundColor: '#ffffff',
            border: '1px solid var(--border-light)',
            borderRadius: '1.25rem',
            padding: '1.25rem',
            boxShadow: '0 15px 35px rgba(0, 0, 0, 0.15)',
            zIndex: 9999
          }}
        >
          <div className="calendar-popover-header">
            <button
              type="button"
              className="calendar-nav-btn"
              onClick={() => {
                if (importPopMonth === 0) { setImportPopMonth(11); setImportPopYear(importPopYear - 1); }
                else { setImportPopMonth(importPopMonth - 1); }
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <span>{monthNames[importPopMonth]} {importPopYear}</span>
            <button
              type="button"
              className="calendar-nav-btn"
              onClick={() => {
                if (importPopMonth === 11) { setImportPopMonth(0); setImportPopYear(importPopYear + 1); }
                else { setImportPopMonth(importPopMonth + 1); }
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="popover-grid">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((wd, idx) => (
              <div key={idx} className="popover-weekday">{wd}</div>
            ))}
            {getCalendarPopoverGrid(importPopYear, importPopMonth).map((day, dIdx) => {
              const hasSession = day.dateStr && dailyStatsMap[day.dateStr];
              const isProfitable = hasSession && dailyStatsMap[day.dateStr].pnl >= 0;
              const isSelected = day.dateStr === selectedDate;

              return (
                <div
                  key={dIdx}
                  className={`popover-day-cell ${day.dayNum === null ? 'empty' : ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    if (day.dateStr) {
                      setSelectedDate(day.dateStr);
                      setShowImportCalendar(false);
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
  );

  return (
    <div>
      {/* Import Mode Switcher */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="mode-toggle-bar">
          <button
            className={`mode-toggle-btn ${importMode === 'raw' ? 'active' : ''}`}
            onClick={() => setImportMode('raw')}
          >
            <FileText size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Paste Raw Broker Logs
          </button>
          <button
            className={`mode-toggle-btn ${importMode === 'manual' ? 'active' : ''}`}
            onClick={() => setImportMode('manual')}
          >
            <Edit3 size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Manual Summary Session
          </button>
        </div>
      </div>

      <div className="row-2-col">
        {/* LEFT COLUMN: RAW LOG IMPORT OR MANUAL SUMMARY FORM */}
        {importMode === 'raw' ? (
          <div className="card">
            <div className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700, marginBottom: '1rem' }}>
              Import Raw Broker Log &amp; Attach Screenshots
            </div>

            {/* In-Card Date Selection Bar */}
            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Session Date:</span>
                {renderCalendarPicker(false)}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>Date Format:</span>
                <select
                  value={settings.dateFormat}
                  onChange={(e) => onSaveSettings({ ...settings, dateFormat: e.target.value })}
                  className="form-select"
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                >
                  <option value="DD-MM-YY">DD-MM-YY (Day First)</option>
                  <option value="MM/DD/YY">MM/DD/YY (US Month First)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                </select>
              </div>
            </div>

            <textarea
              value={pastedText}
              onChange={onPasteChange}
              placeholder="Paste tab-separated broker execution fills here (e.g. 09:34:12  AAPL  Executed  Sold AAPL 100 @ 150.25 Route to NSDQ)..."
              style={{ minHeight: '220px' }}
            ></textarea>

            <div style={{ marginTop: '1rem' }}>
              <label className="dropzone-container" style={{ display: 'block' }}>
                <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onFileSelect} />
                <ImageIcon size={22} color="var(--hero-green)" style={{ margin: '0 auto 0.25rem auto', display: 'block' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Click to attach closing screenshots (PNG/JPEG)</span>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Saved directly on disk with log session file</div>
              </label>

              {pendingScreenshots.length > 0 && (
                <div className="screenshot-grid">
                  {pendingScreenshots.map((img, idx) => (
                    <div key={idx} className="screenshot-card">
                      <img src={img.dataUrl} alt={`Upload Preview ${idx + 1}`} />
                      <button type="button" className="delete-btn" onClick={() => onRemovePendingScreenshot(idx)}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: '1.25rem', display: 'flex', gap: '1rem' }}>
              <button type="button" className="btn" style={{ flexGrow: 1, justifyContent: 'center' }} onClick={onTriggerPreImport}>
                <Plus size={16} /> Save Session &amp; Screenshots
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => { setPastedText(''); setPendingScreenshots([]); }}>
                Clear
              </button>
            </div>
          </div>
        ) : (
          /* MANUAL SUMMARY SESSION ENTRY FORM */
          <div className="card">
            <div className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700, marginBottom: '0.35rem' }}>
              Manual Session Summary Entry
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Enter summary figures for past trading days when raw broker execution logs are not available.
            </div>

            <form onSubmit={handleManualSubmit}>
              {/* Row 1: Session Date & Gross Realized P/L */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                    Session Date <span style={{ color: 'var(--rose-text)' }}>*</span>
                  </label>
                  {renderCalendarPicker(true)}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                    Gross Realized P&amp;L ($) <span style={{ color: 'var(--rose-text)' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <DollarSign size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="e.g. 450.00 or -125.50"
                      value={manualGrossPnl}
                      onChange={(e) => setManualGrossPnl(e.target.value)}
                      className="form-input"
                      style={{ paddingLeft: '28px', fontWeight: 700 }}
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Total Shares Traded & Net Realized P/L */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                    Total Shares Traded <span style={{ color: 'var(--rose-text)' }}>*</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '4px' }}>(for fees)</span>
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    placeholder="e.g. 2000"
                    value={manualTotalShares}
                    onChange={(e) => setManualTotalShares(e.target.value)}
                    className="form-input"
                    style={{ fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                    Net Realized P&amp;L ($) <span style={{ fontSize: '0.72rem' }}>(optional)</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Defaults to Gross minus Fees"
                    value={manualNetPnl}
                    onChange={(e) => setManualNetPnl(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Row 3: Total Closed Trades & Tickers Traded */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                    Total Trades Count <span style={{ fontSize: '0.72rem' }}>(optional)</span>
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="e.g. 8"
                    value={manualTotalTrades}
                    onChange={(e) => setManualTotalTrades(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                    Tickers Traded <span style={{ fontSize: '0.72rem' }}>(e.g. AAPL, NVDA)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="AAPL, NVDA, TSLA"
                    value={manualTickers}
                    onChange={(e) => setManualTickers(e.target.value.toUpperCase())}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Row 4: Win/Loss Trades & Long/Short Trades */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>
                    Winning Trades
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="e.g. 5"
                    value={manualWinTrades}
                    onChange={(e) => setManualWinTrades(e.target.value)}
                    className="form-input"
                    style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>
                    Losing Trades
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="e.g. 3"
                    value={manualLossTrades}
                    onChange={(e) => setManualLossTrades(e.target.value)}
                    className="form-input"
                    style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>
                    Long Trades
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="e.g. 4"
                    value={manualLongTrades}
                    onChange={(e) => setManualLongTrades(e.target.value)}
                    className="form-input"
                    style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>
                    Short Trades
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="e.g. 4"
                    value={manualShortTrades}
                    onChange={(e) => setManualShortTrades(e.target.value)}
                    className="form-input"
                    style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}
                  />
                </div>
              </div>

              {/* Session Notes */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                  Session Notes / Key Learnings
                </label>
                <textarea
                  placeholder="Record summary notes or strategy observations for this session..."
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  style={{ minHeight: '70px', padding: '0.6rem' }}
                />
              </div>

              {/* Screenshots Attachment */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="dropzone-container" style={{ display: 'block', padding: '0.85rem' }}>
                  <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onFileSelect} />
                  <ImageIcon size={18} color="var(--hero-green)" style={{ margin: '0 auto 0.2rem auto', display: 'block' }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Attach Session Screenshots</span>
                </label>

                {pendingScreenshots.length > 0 && (
                  <div className="screenshot-grid" style={{ marginTop: '0.75rem' }}>
                    {pendingScreenshots.map((img, idx) => (
                      <div key={idx} className="screenshot-card">
                        <img src={img.dataUrl} alt={`Upload Preview ${idx + 1}`} />
                        <button type="button" className="delete-btn" onClick={() => onRemovePendingScreenshot(idx)}>
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="submit" className="btn" style={{ flexGrow: 1, justifyContent: 'center' }}>
                  <CheckCircle2 size={16} /> Save Session Summary ({formatDisplayDate(selectedDate)})
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setManualNetPnl('');
                    setManualGrossPnl('');
                    setManualTotalShares('');
                    setManualTotalTrades('');
                    setManualWinTrades('');
                    setManualLossTrades('');
                    setManualLongTrades('');
                    setManualShortTrades('');
                    setManualTickers('');
                    setManualNotes('');
                    setPendingScreenshots([]);
                  }}
                >
                  Clear Form
                </button>
              </div>
            </form>
          </div>
        )}

        {/* RIGHT COLUMN: RESPONSIVE & FILTERABLE SAVED SESSIONS LIST */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700, margin: 0 }}>
              Saved Session Files
            </div>
            <span className="badge badge-route" style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem' }}>
              {filteredSessions.length} {filteredSessions.length === 1 ? 'Session' : 'Sessions'}
            </span>
          </div>

          {/* Search & Month Filter Controls */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div style={{ position: 'relative', flexGrow: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: '9px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search by date or ticker..."
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '28px', paddingRight: '10px', fontSize: '0.78rem', height: '34px' }}
              />
            </div>

            {availableMonths.length > 1 && (
              <select
                value={sidebarMonthFilter}
                onChange={(e) => setSidebarMonthFilter(e.target.value)}
                className="form-select"
                style={{ fontSize: '0.78rem', padding: '0.3rem 0.5rem', height: '34px' }}
              >
                <option value="ALL">All Months</option>
                {availableMonths.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}
          </div>

          {/* Scrollable Container with Max Height */}
          <div
            style={{
              maxHeight: '520px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
              paddingRight: '4px'
            }}
          >
            {filteredSessions.length > 0 ? (
              filteredSessions.map(date => {
                const stats = dailyStatsMap ? dailyStatsMap[date] : null;
                const isManual = stats?.isManualSummary || (logs[date] && logs[date].trim().startsWith('{'));
                const pnl = stats ? (stats.pnl ?? stats.netPnl ?? 0) : 0;

                return (
                  <div
                    key={date}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem',
                      border: '1px solid var(--border-light)',
                      borderRadius: '0.6rem',
                      backgroundColor: 'var(--bg-main, #ffffff)',
                      transition: 'border-color 0.15s ease'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                          📅 {formatDisplayDate(date)}
                        </span>
                        {isManual ? (
                          <span className="badge badge-darkpool" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                            Summary
                          </span>
                        ) : (
                          <span className="badge badge-route" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                            Log
                          </span>
                        )}
                      </div>

                      {stats && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          P&amp;L: <span style={{ color: pnl >= 0 ? 'var(--hero-green)' : 'var(--rose-text)', fontWeight: 800 }}>
                            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                          </span> • {stats.totalOrders || stats.tradesCount || 0} Trades ({(stats.roundTripShares || stats.totalShares || 0).toLocaleString()} shs)
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                        onClick={() => onInspectSession(date)}
                      >
                        Inspect
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                        onClick={() => onDeleteLog(date)}
                        title="Delete Session"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '2rem 0', textAlign: 'center', fontSize: '0.85rem' }}>
                {Object.keys(logs || {}).length === 0 ? 'No saved sessions found.' : 'No sessions matching filter.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
