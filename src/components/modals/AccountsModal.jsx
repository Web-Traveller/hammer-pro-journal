import React, { useState } from 'react';
import {
  Briefcase,
  X,
  Plus,
  Check,
  Edit2,
  Trash2,
  Layers,
  ArrowRight
} from 'lucide-react';

const PRESET_COLORS = [
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f43f5e'  // Rose
];

export function AccountsModal({
  isOpen,
  onClose,
  accounts = [],
  activeAccountId = 'default',
  onSwitchAccount,
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState(null);

  // New account form state
  const [nameInput, setNameInput] = useState('');
  const [brokerInput, setBrokerInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [colorInput, setColorInput] = useState('#3b82f6');

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editBroker, setEditBroker] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editColor, setEditColor] = useState('');

  if (!isOpen) return null;

  const resetNewForm = () => {
    setNameInput('');
    setBrokerInput('');
    setNotesInput('');
    setColorInput('#3b82f6');
    setIsCreating(false);
  };

  const handleStartEdit = (acc) => {
    setEditingAccountId(acc.id);
    setEditName(acc.name);
    setEditBroker(acc.broker || '');
    setEditNotes(acc.notes || '');
    setEditColor(acc.color || '#10b981');
  };

  const handleSaveEdit = (accId) => {
    if (!editName.trim()) return;
    onUpdateAccount(accId, {
      name: editName.trim(),
      broker: editBroker.trim(),
      notes: editNotes.trim(),
      color: editColor
    });
    setEditingAccountId(null);
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    onCreateAccount(nameInput.trim(), colorInput, brokerInput.trim(), notesInput.trim());
    resetNewForm();
  };

  return (
    <div className="custom-modal-overlay" onClick={onClose}>
      <div
        className="custom-modal-card"
        style={{ maxWidth: '520px', width: '92vw' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="custom-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 800, fontSize: '1.05rem', color: 'var(--hero-green)' }}>
            <Briefcase size={20} />
            <span>Trading Accounts &amp; Profiles</span>
          </div>
          <button className="lightbox-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="custom-modal-body">
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: '1.4' }}>
            Separate different brokers, premarket vs. market-hours strategies, or multiple accounts. Each account maintains its own isolated logs, journals, and analytics.
          </div>

          {/* Accounts List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {accounts.map(acc => {
              const isActive = acc.id === activeAccountId;
              const isEditing = editingAccountId === acc.id;

              if (isEditing) {
                return (
                  <div
                    key={acc.id}
                    style={{
                      padding: '1rem',
                      borderRadius: '0.85rem',
                      border: '1.5px solid var(--hero-green)',
                      backgroundColor: '#f8fafc',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Account Name"
                        style={{ flex: 1, padding: '0.45rem 0.75rem', fontSize: '0.86rem' }}
                      />
                      <input
                        type="text"
                        className="form-input"
                        value={editBroker}
                        onChange={(e) => setEditBroker(e.target.value)}
                        placeholder="Broker (e.g. Alaric)"
                        style={{ width: '130px', padding: '0.45rem 0.75rem', fontSize: '0.86rem' }}
                      />
                    </div>
                    <input
                      type="text"
                      className="form-input"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Notes (e.g. Premarket 4am-9:30am)"
                      style={{ width: '100%', padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        {PRESET_COLORS.map(c => (
                          <div
                            key={c}
                            onClick={() => setEditColor(c)}
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              backgroundColor: c,
                              cursor: 'pointer',
                              border: editColor === c ? '2px solid #0f172a' : '1px solid rgba(0,0,0,0.1)'
                            }}
                          />
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                          onClick={() => setEditingAccountId(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                          onClick={() => handleSaveEdit(acc.id)}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={acc.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.85rem 1rem',
                    borderRadius: '0.85rem',
                    border: `1.5px solid ${isActive ? 'var(--hero-green)' : 'var(--border-light)'}`,
                    backgroundColor: isActive ? 'rgba(16, 185, 129, 0.05)' : '#ffffff',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', flex: 1 }}
                    onClick={() => onSwitchAccount(acc.id)}
                  >
                    <div
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        backgroundColor: acc.color || '#10b981',
                        flexShrink: 0
                      }}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                          {acc.name}
                        </span>
                        {acc.broker && (
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            padding: '0.1rem 0.45rem',
                            borderRadius: '999px',
                            border: '1px solid #e2e8f0'
                          }}>
                            {acc.broker}
                          </span>
                        )}
                        {isActive && (
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            backgroundColor: '#dcfce7',
                            color: '#15803d',
                            padding: '0.1rem 0.45rem',
                            borderRadius: '999px',
                            border: '1px solid #86efac'
                          }}>
                            ACTIVE
                          </span>
                        )}
                      </div>
                      {acc.notes && (
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {acc.notes}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(acc)}
                      title="Edit Account"
                      style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
                    >
                      <Edit2 size={14} />
                    </button>
                    {acc.id !== 'default' && (
                      <button
                        type="button"
                        onClick={() => onDeleteAccount(acc.id)}
                        title="Delete Account"
                        style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', padding: '4px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Account Drawer / Form */}
          {!isCreating ? (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center', fontSize: '0.85rem', padding: '0.65rem' }}
              onClick={() => setIsCreating(true)}
            >
              <Plus size={16} /> Add Trading Account / Sub-Account
            </button>
          ) : (
            <form onSubmit={handleCreateSubmit} style={{ padding: '1rem', border: '1px solid var(--border-light)', borderRadius: '0.85rem', backgroundColor: '#f8fafc' }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', marginBottom: '0.75rem', color: 'var(--text-main)' }}>
                Create New Trading Account
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Account Name (e.g. CMEG Premarket)"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem 0.75rem', fontSize: '0.86rem' }}
                  required
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Broker (e.g. Alaric)"
                  value={brokerInput}
                  onChange={(e) => setBrokerInput(e.target.value)}
                  style={{ width: '130px', padding: '0.5rem 0.75rem', fontSize: '0.86rem' }}
                />
              </div>

              <input
                type="text"
                className="form-input"
                placeholder="Description / Schedule (e.g. Premarket 4am - 9:30am)"
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.82rem', marginBottom: '0.75rem' }}
              />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Badge:</span>
                  {PRESET_COLORS.map(c => (
                    <div
                      key={c}
                      onClick={() => setColorInput(c)}
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: c,
                        cursor: 'pointer',
                        border: colorInput === c ? '2.5px solid #0f172a' : '1px solid rgba(0,0,0,0.1)'
                      }}
                    />
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                    onClick={resetNewForm}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn"
                    style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                  >
                    Create Account
                  </button>
                </div>
              </div>
            </form>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-light)', marginTop: '1.25rem', paddingTop: '1rem' }}>
            <button className="btn btn-secondary" style={{ fontSize: '0.82rem' }} onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
