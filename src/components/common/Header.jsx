import React from 'react';
import { Plus, Cloud, User, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

export function Header({
  currentView,
  setCurrentView,
  timezone,
  onTimezoneChange,
  singleSessionAnalytics,
  userProfile,
  onOpenAuthModal,
  syncState = {}
}) {
  const titles = {
    singleSession: 'Single Session Deep-Dive',
    dashboard: 'Trading Dashboard',
    ecnAnalytics: 'ECN & Darkpool Analytics',
    stockAnalysis: 'Stock Performance & Financial Terminal',
    heatmap: 'P&L Calendar Heatmap',
    pasteLogs: 'Import Broker Logs',
    settings: 'App Settings & Cloud Backup'
  };

  const descriptions = {
    singleSession: 'Intraday trade P&L curve, Level 2 scalper metrics, stock time matrix, and session journal',
    dashboard: 'Accumulated performance, equity growth, fees calculation, and month-by-month horizon metrics',
    ecnAnalytics: 'ECN vs. Darkpool liquidity analysis and venue breakdown',
    stockAnalysis: 'Toggle between Simple Table View and Advanced Finviz Live Scraper Terminal with 80+ snapshot metrics',
    heatmap: 'Calendar view of daily return density across years',
    pasteLogs: 'Paste raw broker execution logs with failure-proof date verification',
    settings: 'Configure fee rates, date formats, cross-device cloud sync, and silent auto-updates'
  };

  return (
    <div className="top-header">
      <div className="header-title">
        <h2>{titles[currentView] || 'Hammer Pro Journal'}</h2>
        <p>{descriptions[currentView] || 'Trading analytics platform for Level 2 tape scalpers'}</p>
      </div>

      <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
        {/* User Profile & Cross-Device Sync Status Pill */}
        <button
          className="header-user-btn"
          onClick={onOpenAuthModal}
          title={userProfile ? `Signed in as ${userProfile.name} • Click to manage account & cloud sync` : "Click to sign in or enable cross-device cloud sync"}
        >
          {userProfile ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <img
                src={userProfile.avatarUrl}
                alt={userProfile.name}
                style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#fff' }}
              />
              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)' }}>
                {userProfile.name.split(' ')[0]}
              </span>
              <span className="sync-status-dot dot-synced" title="Cloud Sync Active" />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
              <User size={15} />
              <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>Guest / Local</span>
              <span className="sync-status-dot dot-offline" title="Working Offline" />
            </div>
          )}
        </button>

        {/* Timezone Switcher Pill */}
        <div className="timezone-switcher" title="Toggle between US Eastern Market Time and Indian Standard Time (IST)">
          <button
            className={`timezone-btn ${timezone === 'US_EASTERN' ? 'active' : ''}`}
            onClick={() => onTimezoneChange('US_EASTERN')}
          >
            🇺🇸 US (EDT)
          </button>
          <button
            className={`timezone-btn ${timezone === 'INDIA_IST' ? 'active' : ''}`}
            onClick={() => onTimezoneChange('INDIA_IST')}
          >
            🇮🇳 India (IST)
          </button>
        </div>

        <button className="btn" onClick={() => setCurrentView('pasteLogs')}>
          <Plus size={16} /> Import Session
        </button>
      </div>
    </div>
  );
}
