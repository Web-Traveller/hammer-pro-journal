import React from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Plus,
  Trash2,
  X
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
  logs,
  onInspectSession,
  onDeleteLog
}) {
  return (
    <div>
      <div className="row-2-col">
        <div className="card">
          <div className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700, marginBottom: '1rem' }}>
            Import Raw Broker Log &amp; Attach Screenshots
          </div>
          
          <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Session Date:</span>
              <div className="calendar-picker-wrapper" ref={importCalendarRef}>
                <button className="calendar-trigger-btn" onClick={() => setShowImportCalendar(!showImportCalendar)}>
                  <CalendarDays size={16} color="var(--hero-green)" />
                  <span>{formatDisplayDate(selectedDate) || selectedDate || 'Select Date'}</span>
                </button>

                {showImportCalendar && (
                  <div className="calendar-popover">
                    <div className="calendar-popover-header">
                      <button className="calendar-nav-btn" onClick={() => {
                        if (importPopMonth === 0) { setImportPopMonth(11); setImportPopYear(importPopYear - 1); }
                        else { setImportPopMonth(importPopMonth - 1); }
                      }}><ChevronLeft size={18} /></button>
                      <span>{monthNames[importPopMonth]} {importPopYear}</span>
                      <button className="calendar-nav-btn" onClick={() => {
                        if (importPopMonth === 11) { setImportPopMonth(0); setImportPopYear(importPopYear + 1); }
                        else { setImportPopMonth(importPopMonth + 1); }
                      }}><ChevronRight size={18} /></button>
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
            placeholder="Paste tab-separated broker execution logs here..."
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
                    <button className="delete-btn" onClick={() => onRemovePendingScreenshot(idx)}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: '1.25rem', display: 'flex', gap: '1rem' }}>
            <button className="btn" style={{ flexGrow: 1, justifyContent: 'center' }} onClick={onTriggerPreImport}>
              <Plus size={16} /> Save Session &amp; Screenshots
            </button>
            <button className="btn btn-secondary" onClick={() => { setPastedText(''); setPendingScreenshots([]); }}>
              Clear
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700, marginBottom: '1rem' }}>
            Saved Session Files on Disk
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Object.keys(logs || {}).length > 0 ? (
              Object.keys(logs || {}).sort().reverse().map(date => {
                const stats = dailyStatsMap ? dailyStatsMap[date] : null;
                return (
                  <div key={date} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', border: '1px solid var(--border-light)', borderRadius: '0.5rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>📅 {formatDisplayDate(date)}</div>
                      {stats && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          P&amp;L: <span style={{ color: (stats.pnl || 0) >= 0 ? 'var(--hero-green)' : 'var(--rose-text)', fontWeight: 700 }}>
                            {((stats.pnl || 0) >= 0 ? '+' : '')}${((stats.pnl || 0)).toFixed(2)}
                          </span> • {stats.totalOrders || 0} Trades ({(stats.roundTripShares || 0).toLocaleString()} shs)
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }} onClick={() => onInspectSession(date)}>
                        Inspect
                      </button>
                      <button className="btn btn-danger" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }} onClick={() => onDeleteLog(date)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem 0' }}>
                No saved sessions found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
