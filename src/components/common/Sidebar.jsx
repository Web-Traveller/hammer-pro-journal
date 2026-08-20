import React from 'react';
import {
  CalendarDays,
  LayoutDashboard,
  Layers,
  BarChart3,
  Calendar,
  Upload,
  Settings as SettingsIcon,
  Zap,
  User,
  Cloud
} from 'lucide-react';
import { APP_VERSION } from '../../version';

export function Sidebar({ currentView, setCurrentView, userProfile, onOpenAuthModal }) {
  return (
    <div className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="sidebar-logo">
        <Zap size={24} />
        <div className="sidebar-logo-text">
          <span className="sidebar-logo-title">HAMMER PRO JOURNAL</span>
          <span className="sidebar-logo-author">by Ajinkya • v{APP_VERSION}</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="nav-section-title">MENU</div>
        <div className="nav-links">
          <div className={`nav-item ${currentView === 'singleSession' ? 'active' : ''}`} onClick={() => setCurrentView('singleSession')}>
            <CalendarDays size={18} />
            <span>Single Session</span>
          </div>
          <div className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentView('dashboard')}>
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </div>
          <div className={`nav-item ${currentView === 'ecnAnalytics' ? 'active' : ''}`} onClick={() => setCurrentView('ecnAnalytics')}>
            <Layers size={18} />
            <span>ECN & Darkpools</span>
          </div>
        </div>

        <div className="nav-section-title">ANALYTICS</div>
        <div className="nav-links">
          <div className={`nav-item ${currentView === 'stockAnalysis' ? 'active' : ''}`} onClick={() => setCurrentView('stockAnalysis')}>
            <BarChart3 size={18} />
            <span>Stock Analysis</span>
          </div>
          <div className={`nav-item ${currentView === 'heatmap' ? 'active' : ''}`} onClick={() => setCurrentView('heatmap')}>
            <Calendar size={18} />
            <span>Calendar Heatmap</span>
          </div>
        </div>

        <div className="nav-section-title">GENERAL</div>
        <div className="nav-links">
          <div className={`nav-item ${currentView === 'pasteLogs' ? 'active' : ''}`} onClick={() => setCurrentView('pasteLogs')}>
            <Upload size={18} />
            <span>Import Session</span>
          </div>
          <div className={`nav-item ${currentView === 'settings' ? 'active' : ''}`} onClick={() => setCurrentView('settings')}>
            <SettingsIcon size={18} />
            <span>Settings</span>
          </div>
        </div>
      </div>

      {/* User Profile Card at Bottom of Sidebar */}
      <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border-light)', marginTop: 'auto' }}>
        <div
          onClick={onOpenAuthModal}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            padding: '0.55rem',
            borderRadius: '0.65rem',
            cursor: 'pointer',
            backgroundColor: userProfile ? 'rgba(6, 78, 59, 0.04)' : '#f8fafc',
            border: '1px solid var(--border-light)',
            transition: 'all 0.2s ease'
          }}
          className="sidebar-profile-card"
        >
          {userProfile ? (
            <>
              <img
                src={userProfile.avatarUrl}
                alt={userProfile.name}
                style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#fff', border: '1px solid var(--border-light)' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {userProfile.name}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--hero-green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Cloud size={10} /> {userProfile.planTier === 'pro' ? 'Pro Cloud Sync' : 'Free Sync'}
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                <User size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)' }}>Guest Trader</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Click to Sign In</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
