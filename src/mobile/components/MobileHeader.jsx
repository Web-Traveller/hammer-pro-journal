import React from 'react';
import { RefreshCw, Zap, Clock, User } from 'lucide-react';

export function MobileHeader({
  timezone,
  onTimezoneChange,
  userProfile,
  onOpenProfile,
  syncState = {},
  onSyncNow,
  activeAccount,
  onOpenAccountsModal
}) {
  const isSyncing = syncState.status === 'syncing';
  const isSynced = syncState.status === 'synced';

  return (
    <header className="mobile-top-bar">
      <div className="mobile-logo-group">
        <Zap size={19} color="#064e3b" />
        <span className="mobile-logo-title">Hammer Pro</span>
      </div>

      <div className="mobile-top-actions">
        {/* Active Trading Account Pill */}
        {onOpenAccountsModal && (
          <button
            className="mobile-pill-btn"
            onClick={onOpenAccountsModal}
            type="button"
            title="Switch Trading Account"
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <div
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: activeAccount?.color || '#10b981',
                flexShrink: 0
              }}
            />
            <span style={{ maxWidth: '68px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }}>
              {activeAccount?.name || 'Main'}
            </span>
          </button>
        )}

        {/* 1-Tap Cloud Sync Button */}
        <button
          className="mobile-pill-btn"
          onClick={onSyncNow}
          disabled={isSyncing}
          title="Tap to sync cloud trades"
          type="button"
        >
          <RefreshCw
            size={13}
            className={isSyncing ? 'anim-spin' : ''}
            color={isSynced ? '#059669' : isSyncing ? '#d97706' : '#6b7280'}
          />
          <span style={{ color: isSynced ? '#059669' : isSyncing ? '#d97706' : '#374151' }}>
            {isSyncing ? 'Syncing...' : isSynced ? 'Synced' : 'Sync'}
          </span>
        </button>

        {/* Timezone Switcher */}
        <button
          className="mobile-pill-btn"
          onClick={() => onTimezoneChange(timezone === 'US_EASTERN' ? 'INDIA_IST' : 'US_EASTERN')}
          type="button"
        >
          <Clock size={13} />
          <span>{timezone === 'US_EASTERN' ? 'EDT' : 'IST'}</span>
        </button>

        {/* Avatar / Profile Button */}
        <button
          className="mobile-avatar-btn"
          onClick={onOpenProfile}
          type="button"
          title="Account & Sync Settings"
        >
          {userProfile?.avatarUrl ? (
            <img src={userProfile.avatarUrl} alt={userProfile.name || 'User'} />
          ) : (
            <User size={16} color="#6b7280" />
          )}
        </button>
      </div>
    </header>
  );
}
