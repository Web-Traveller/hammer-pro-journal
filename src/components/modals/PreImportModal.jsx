import React from 'react';
import { Calendar, X, Check, TrendingUp, AlertTriangle } from 'lucide-react';
import { formatDisplayDate } from '../../services/timeService';

export function PreImportModal({
  isOpen,
  report,
  selectedDate,
  onClose,
  onConfirm
}) {
  if (!isOpen || !report) return null;

  const displayDateStr = formatDisplayDate(report.detectedDate || selectedDate);
  const pnl = report.previewGrossPnl || 0;

  return (
    <div className="custom-modal-overlay" onClick={onClose}>
      <div className="custom-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="custom-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '1.05rem', color: 'var(--hero-green)' }}>
            <Calendar size={20} /> Review &amp; Confirm Session Import
          </div>
          <button className="lightbox-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="custom-modal-body">
          {/* Highlighted Session Date */}
          <div style={{ marginBottom: '1.25rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Session Date</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#065f46', marginTop: '0.2rem' }}>
                {displayDateStr}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Est. Realized P&amp;L</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: pnl >= 0 ? 'var(--hero-green)' : 'var(--rose-text)', marginTop: '0.2rem' }}>
                {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ border: '1px solid var(--border-light)', borderRadius: '0.6rem', padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>Shares Traded</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '0.2rem' }}>{report.previewShares || report.executionsCount}</div>
            </div>
            <div style={{ border: '1px solid var(--border-light)', borderRadius: '0.6rem', padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>Execution Fills</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '0.2rem' }}>{report.executionsCount}</div>
            </div>
            <div style={{ border: '1px solid var(--border-light)', borderRadius: '0.6rem', padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>Unique Tickers</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '0.2rem' }}>{(report.symbols || []).length}</div>
            </div>
          </div>

          {/* Symbols List */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-main)' }}>Tickers Detected:</div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {(report.symbols || []).map(s => (
                <span key={s} className="badge badge-route" style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}>{s}</span>
              ))}
            </div>
          </div>

          {report.anomalies && report.anomalies.length > 0 && (
            <div style={{ backgroundColor: '#fffbe6', border: '1px solid #ffe58f', borderRadius: '0.6rem', padding: '0.75rem', fontSize: '0.78rem', color: '#8c6b00' }}>
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <AlertTriangle size={14} /> {report.anomalies.length} unparseable line(s) ignored safely
              </div>
            </div>
          )}
        </div>

        <div className="custom-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel &amp; Review
          </button>
          <button className="btn" onClick={onConfirm}>
            <Check size={16} /> Import &amp; Save Session
          </button>
        </div>
      </div>
    </div>
  );
}
