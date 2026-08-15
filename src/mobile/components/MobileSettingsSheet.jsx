import React from 'react';
import {
  X,
  RefreshCw,
  Clock,
  User,
  ShieldCheck,
  DollarSign,
  Calendar,
  LogOut
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
  onSaveSettings
}) {
  if (!isOpen) return null;

  const isSyncing = syncState.status === 'syncing';
  const isSynced = syncState.status === 'synced';

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
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: '#ffffff',
          borderTopLeftRadius: '1.5rem',
          borderTopRightRadius: '1.5rem',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          boxShadow: '0 -10px 30px rgba(0, 0, 0, 0.15)',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxSizing: 'border-box'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Quick Trader Settings
          </div>
          <button
            onClick={onClose}
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
          >
            <X size={18} />
          </button>
        </div>

        {/* TRADER ACCOUNT CARD */}
        <div
          style={{
            background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
            borderRadius: '1.1rem',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            boxShadow: '0 4px 16px rgba(6, 78, 59, 0.25)',
            color: '#ffffff'
          }}
        >
          <img
            src={userProfile?.avatarUrl || 'https://api.dicebear.com/7.x/bottts/svg?seed=trader'}
            alt="Avatar"
            style={{ width: '46px', height: '46px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', background: '#ffffff' }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
              {userProfile?.name || 'Local Trader'}
              {userProfile && <ShieldCheck size={16} color="#34d399" />}
            </div>
            <div style={{ fontSize: '0.76rem', opacity: 0.85 }}>
              {userProfile?.email || 'Offline Mode'}
            </div>
          </div>
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
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Timezone</span>
          </div>
          <button
            onClick={() => onTimezoneChange(timezone === 'US_EASTERN' ? 'INDIA_IST' : 'US_EASTERN')}
            className="mobile-pill-btn"
            type="button"
          >
            {timezone === 'US_EASTERN' ? '🇺🇸 US Eastern (EDT)' : '🇮🇳 India (IST)'}
          </button>
        </div>

        {/* FEES CALCULATION TOGGLE */}
        {onSaveSettings && (
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
              <DollarSign size={18} color="#6b7280" />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Deduct Broker Fees</span>
            </div>
            <button
              onClick={() => onSaveSettings({ ...settings, enableFees: !settings?.enableFees })}
              className="mobile-pill-btn"
              style={{
                backgroundColor: settings?.enableFees ? '#d1fae5' : '#ffffff',
                color: settings?.enableFees ? '#065f46' : 'var(--text-main)'
              }}
              type="button"
            >
              {settings?.enableFees ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        )}



        {userProfile && (
          <button
            onClick={async () => {
              await signOutUser();
              onClose();
            }}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #fecdd3',
              borderRadius: '0.85rem',
              color: '#e11d48',
              padding: '0.75rem',
              fontWeight: 700,
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              cursor: 'pointer'
            }}
            type="button"
          >
            <LogOut size={16} /> Sign Out
          </button>
        )}
      </div>
    </div>
  );
}
