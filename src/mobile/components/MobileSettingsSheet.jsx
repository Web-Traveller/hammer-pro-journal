import React, { useState } from 'react';
import {
  X,
  RefreshCw,
  Clock,
  User,
  ShieldCheck,
  DollarSign,
  LogOut,
  Wallet,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';
import { signOutUser } from '../../services/authService';

export function MobileSettingsSheet({
  isOpen,
  onClose,
  userProfile,
  onOpenAuthModal,
  onSyncNow,
  syncState = {},
  timezone,
  onTimezoneChange,
  settings = {},
  onSaveSettings,
  accounts = [],
  activeAccountId = 'default',
  onSwitchAccount,
  onOpenAccountsModal
}) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  if (!isOpen) return null;

  const isSyncing = syncState.status === 'syncing';
  const isSynced = syncState.status === 'synced';

  const handleClose = () => {
    setShowLogoutConfirm(false);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(5px)',
        zIndex: 500,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center'
      }}
      onClick={handleClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: '#ffffff',
          borderTopLeftRadius: '1.5rem',
          borderTopRightRadius: '1.5rem',
          padding: '1.5rem 1.25rem 2rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          boxShadow: '0 -10px 30px rgba(0, 0, 0, 0.15)',
          maxHeight: '88vh',
          overflowY: 'auto',
          boxSizing: 'border-box'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
              Settings &amp; Preferences
            </div>
            <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
              Cloud sync, accounts &amp; trade calculations
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              color: '#64748b',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            type="button"
            aria-label="Close Settings"
          >
            <X size={18} />
          </button>
        </div>

        {/* TRADER ACCOUNT CARD */}
        <div
          style={{
            background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
            borderRadius: '1.1rem',
            padding: '1rem 1.15rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            boxShadow: '0 4px 16px rgba(6, 78, 59, 0.25)',
            color: '#ffffff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <img
                src={userProfile?.avatarUrl || 'https://api.dicebear.com/7.x/bottts/svg?seed=trader'}
                alt="Avatar"
                style={{ width: '44px', height: '44px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.5)', background: '#ffffff' }}
              />
              <div>
                <div style={{ fontSize: '0.96rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {userProfile?.name || 'Local Trader'}
                  {userProfile && <ShieldCheck size={16} color="#34d399" />}
                </div>
                <div style={{ fontSize: '0.74rem', opacity: 0.85 }}>
                  {userProfile?.email || 'Offline Mode'}
                </div>
              </div>
            </div>

            {/* SIGN OUT / SIGN IN BUTTON IN PROFILE */}
            {userProfile ? (
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '0.65rem',
                  color: '#ffffff',
                  padding: '0.4rem 0.65rem',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  backdropFilter: 'blur(4px)'
                }}
              >
                <LogOut size={13} /> Sign Out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (onOpenAuthModal) {
                    handleClose();
                    onOpenAuthModal();
                  }
                }}
                style={{
                  background: '#ffffff',
                  border: 'none',
                  borderRadius: '0.65rem',
                  color: '#064e3b',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                }}
              >
                <User size={13} /> Sign In
              </button>
            )}
          </div>

          {/* LOGOUT CONFIRMATION DIALOG (INLINE) */}
          {showLogoutConfirm && (
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '0.85rem',
                padding: '0.85rem 1rem',
                color: '#0f172a',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
                border: '1.5px solid #fecdd3'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e11d48', fontSize: '0.85rem', fontWeight: 800 }}>
                <AlertTriangle size={16} />
                <span>Do you want to log out?</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.35 }}>
                You will need to sign in again to sync cloud trade logs and multi-account data.
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    borderRadius: '0.55rem',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#f8fafc',
                    color: '#334155',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await signOutUser();
                    setShowLogoutConfirm(false);
                    handleClose();
                  }}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    borderRadius: '0.55rem',
                    border: 'none',
                    backgroundColor: '#e11d48',
                    color: '#ffffff',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <LogOut size={13} /> Confirm Log Out
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 1-TAP CLOUD SYNC BUTTON */}
        <button
          onClick={onSyncNow}
          disabled={isSyncing}
          style={{
            background: isSynced ? '#059669' : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
            border: 'none',
            borderRadius: '0.85rem',
            color: '#ffffff',
            padding: '0.85rem',
            fontWeight: 800,
            fontSize: '0.92rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.65rem',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
          }}
          type="button"
        >
          <RefreshCw size={18} className={isSyncing ? 'anim-spin' : ''} />
          {isSyncing ? 'Syncing with Cloudflare R2...' : 'Sync Cloud Trades Now'}
        </button>

        {/* TRADING ACCOUNTS SELECTOR */}
        {accounts && accounts.length > 0 && (
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid var(--border-light, #e5e7eb)',
              borderRadius: '0.85rem',
              padding: '0.85rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Wallet size={16} color="#6b7280" />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main, #0f172a)' }}>Trading Account</span>
              </div>
              {onOpenAccountsModal && (
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    onOpenAccountsModal();
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#059669',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  Manage
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {accounts.map(acc => {
                const isActive = acc.id === activeAccountId;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => onSwitchAccount && onSwitchAccount(acc.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '0.5rem',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      border: isActive ? '1.5px solid #059669' : '1px solid #e2e8f0',
                      backgroundColor: isActive ? '#ecfdf5' : '#ffffff',
                      color: isActive ? '#065f46' : '#334155',
                      cursor: 'pointer'
                    }}
                  >
                    <div
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: acc.color || '#10b981'
                      }}
                    />
                    <span>{acc.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TIMEZONE SELECTOR */}
        <div
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid var(--border-light, #e5e7eb)',
            borderRadius: '0.85rem',
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Clock size={18} color="#6b7280" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main, #0f172a)' }}>Timezone Ground Truth</span>
          </div>
          <button
            onClick={() => onTimezoneChange(timezone === 'US_EASTERN' ? 'INDIA_IST' : 'US_EASTERN')}
            className="mobile-pill-btn"
            type="button"
          >
            {timezone === 'US_EASTERN' ? '🇺🇸 US Eastern (EDT)' : '🇮🇳 India (IST)'}
          </button>
        </div>

        {/* FEES & COMMISSIONS SECTION */}
        {onSaveSettings && (
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid var(--border-light, #e5e7eb)',
              borderRadius: '0.85rem',
              padding: '0.85rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <DollarSign size={18} color="#6b7280" />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main, #0f172a)' }}>Deduct Broker Fees</span>
              </div>
              <button
                onClick={() => onSaveSettings({ ...settings, enableFees: !settings?.enableFees })}
                className="mobile-pill-btn"
                style={{
                  backgroundColor: settings?.enableFees ? '#d1fae5' : '#ffffff',
                  color: settings?.enableFees ? '#065f46' : 'var(--text-main, #0f172a)'
                }}
                type="button"
              >
                {settings?.enableFees ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            {settings?.enableFees && (
              <div
                style={{
                  paddingTop: '0.65rem',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                    Fee per Trade ($)
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    1 trade = entry &amp; exit of 1 share
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={settings.feePerShare ?? 0.04}
                    onChange={(e) => onSaveSettings({ ...settings, feePerShare: parseFloat(e.target.value) || 0 })}
                    style={{
                      width: '68px',
                      padding: '0.35rem 0.5rem',
                      borderRadius: '0.45rem',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      textAlign: 'right',
                      backgroundColor: '#ffffff',
                      color: '#0f172a'
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* BOTTOM SAFE AREA SPACER */}
        <div style={{ height: '0.5rem' }} />
      </div>
    </div>
  );
}
