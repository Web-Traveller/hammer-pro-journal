import React, { useState } from 'react';
import './MobileApp.css';
import { MobileHeader } from './components/MobileHeader';
import { MobileDashboardView } from './components/MobileDashboardView';
import { MobilePulseView } from './components/MobilePulseView';
import { MobileHeatmapView } from './components/MobileHeatmapView';
import { MobileSettingsSheet } from './components/MobileSettingsSheet';
import { AnnouncementBanner } from '../components/common/AnnouncementBanner';
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Settings
} from 'lucide-react';
import { executeTwoTierSync } from '../services/authService';

export function MobileApp({
  sessionDate,
  setSessionDate,
  singleSessionAnalytics,
  dailyStatsMap = {},
  timezone,
  onTimezoneChange,
  userProfile,
  onOpenAuthModal,
  syncState,
  settings,
  onSaveSettings,
  activeBroadcast,
  onDismissBroadcast,
  accounts = [],
  activeAccountId = 'default',
  activeAccount = null,
  onSwitchAccount,
  onOpenAccountsModal
}) {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'session' | 'heatmap'
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);

  const availableDates = Object.keys(dailyStatsMap || {}).sort().reverse();
  const activeSessionDate = sessionDate && dailyStatsMap[sessionDate]
    ? sessionDate
    : (availableDates.length > 0 ? availableDates[0] : sessionDate);

  const activeAnalytics = singleSessionAnalytics || dailyStatsMap[activeSessionDate] || null;

  const handleSyncNow = async () => {
    await executeTwoTierSync(dailyStatsMap);
  };

  return (
    <div className="mobile-shell">
      {/* MOBILE TOP BAR */}
      <MobileHeader
        timezone={timezone}
        onTimezoneChange={onTimezoneChange}
        userProfile={userProfile}
        onOpenProfile={() => setShowSettingsSheet(true)}
        syncState={syncState}
        onSyncNow={handleSyncNow}
        activeAccount={activeAccount}
        onOpenAccountsModal={onOpenAccountsModal}
      />

      {/* Global Admin Broadcast Banner */}
      <AnnouncementBanner
        broadcast={activeBroadcast}
        onDismiss={onDismissBroadcast}
      />

      {/* 1. OVERALL DASHBOARD VIEW */}
      {activeTab === 'dashboard' && (
        <MobileDashboardView
          dailyStatsMap={dailyStatsMap}
          onSelectDate={(d) => setSessionDate(d)}
          onNavigateToSession={() => setActiveTab('session')}
          onNavigateToCalendar={() => setActiveTab('heatmap')}
        />
      )}

      {/* 2. SINGLE SESSION VIEW */}
      {activeTab === 'session' && (
        <MobilePulseView
          sessionDate={activeSessionDate}
          setSessionDate={setSessionDate}
          availableDates={availableDates}
          analytics={activeAnalytics}
          timezone={timezone}
        />
      )}

      {/* 3. MONTHLY CALENDAR VIEW */}
      {activeTab === 'heatmap' && (
        <MobileHeatmapView
          dailyStatsMap={dailyStatsMap}
          selectedDate={activeSessionDate}
          onSelectDate={(d) => setSessionDate(d)}
          onNavigateToPulse={() => setActiveTab('session')}
        />
      )}

      {/* MOBILE BOTTOM DOCK (Dashboard, Session, Calendar, Settings) */}
      <nav className="mobile-dock">
        <button
          className={`mobile-dock-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
          type="button"
        >
          <LayoutDashboard size={20} className="mobile-dock-icon" />
          <span className="mobile-dock-label">Dashboard</span>
        </button>

        <button
          className={`mobile-dock-tab ${activeTab === 'session' ? 'active' : ''}`}
          onClick={() => setActiveTab('session')}
          type="button"
        >
          <BookOpen size={20} className="mobile-dock-icon" />
          <span className="mobile-dock-label">Session</span>
        </button>

        <button
          className={`mobile-dock-tab ${activeTab === 'heatmap' ? 'active' : ''}`}
          onClick={() => setActiveTab('heatmap')}
          type="button"
        >
          <Calendar size={20} className="mobile-dock-icon" />
          <span className="mobile-dock-label">Calendar</span>
        </button>

        <button
          className="mobile-dock-tab"
          onClick={() => setShowSettingsSheet(true)}
          type="button"
        >
          <Settings size={20} className="mobile-dock-icon" />
          <span className="mobile-dock-label">Settings</span>
        </button>
      </nav>

      {/* BOTTOM SETTINGS SHEET */}
      <MobileSettingsSheet
        isOpen={showSettingsSheet}
        onClose={() => setShowSettingsSheet(false)}
        userProfile={userProfile}
        onOpenAuthModal={onOpenAuthModal}
        onSyncNow={handleSyncNow}
        syncState={syncState}
        timezone={timezone}
        onTimezoneChange={onTimezoneChange}
        settings={settings}
        onSaveSettings={onSaveSettings}
        accounts={accounts}
        activeAccountId={activeAccountId}
        onSwitchAccount={onSwitchAccount}
        onOpenAccountsModal={onOpenAccountsModal}
      />
    </div>
  );
}
