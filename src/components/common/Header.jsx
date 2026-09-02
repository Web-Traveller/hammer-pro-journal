import React from 'react';
import { Plus, Cloud, User, CheckCircle, AlertCircle, RefreshCw, Briefcase, ChevronDown } from 'lucide-react';

export function Header({
  currentView,
  setCurrentView,
  timezone,
  onTimezoneChange,
  singleSessionAnalytics,
  userProfile,
  onOpenAuthModal,
  syncState = {},
  hasUnsyncedChanges = false,
  activeAccount = null,
  onOpenAccountsModal
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

      <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'nowrap', flexShrink: 0 }}>
        {/* Trading Account Switcher Pill */}
        {onOpenAccountsModal && (
          <button
            type="button"
            className="header-user-btn"
            onClick={onOpenAccountsModal}
            title="Switch or manage trading accounts (e.g. Premarket vs Market Hours)"
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.4rem 0.75rem', flexShrink: 0 }}
          >
            <div
              style={{
                width: '9px',
                height: '9px',
                borderRadius: '50%',
                backgroundColor: activeAccount?.color || '#10b981',
                flexShrink: 0
              }}
            />
            <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeAccount?.name || 'Main Account'}
            </span>
            <ChevronDown size={13} color="var(--text-muted)" />
          </button>
        )}

        {/* Timezone Switcher Pill */}
        <div className="timezone-switcher" style={{ flexShrink: 0 }} title="Toggle between US Eastern Market Time and Indian Standard Time (IST)">
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

        <button className="btn" style={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={() => setCurrentView('pasteLogs')}>
          <Plus size={16} /> Import Session
        </button>
      </div>
    </div>
  );
}
