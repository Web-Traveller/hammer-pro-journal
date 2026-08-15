import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { formatDisplayDate } from '../../services/timeService';

export function DeleteConfirmModal({
  isOpen,
  date,
  onClose,
  onConfirm
}) {
  if (!isOpen || !date) return null;

  return (
    <div className="custom-modal-overlay" onClick={onClose}>
      <div className="custom-modal-card" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
        <div className="custom-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '1rem', color: 'var(--rose-text)' }}>
            <AlertTriangle size={18} /> Delete Session Confirmation
          </div>
          <button className="lightbox-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="custom-modal-body">
          <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.75rem' }}>
            Are you sure you want to permanently delete the trading session for:
          </p>
          <div style={{ backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '0.6rem', padding: '0.75rem', fontWeight: 800, color: '#9f1239', fontSize: '1rem', textAlign: 'center' }}>
            📅 {formatDisplayDate(date)}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
            This will remove the raw broker log, matched trades, journal reflections, and attached screenshots from local storage.
          </p>
        </div>

        <div className="custom-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" style={{ backgroundColor: '#e11d48', borderColor: '#be123c', color: '#ffffff' }} onClick={onConfirm}>
            <Trash2 size={15} /> Delete Session
          </button>
        </div>
      </div>
    </div>
  );
}
