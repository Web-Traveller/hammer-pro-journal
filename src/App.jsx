import React, { useState, useEffect } from 'react';
import './App.css';
import { useTradingState } from './hooks/useTradingState';
import { smoothIntradayChartOptions, smoothEquityChartOptions } from './utils/chartConfig';

// Modular Components
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Sidebar } from './components/common/Sidebar';
import { Header } from './components/common/Header';
import { SingleSessionView } from './components/session/SingleSessionView';
import { DashboardView } from './components/dashboard/DashboardView';
import { ECNAnalyticsView } from './components/analytics/ECNAnalyticsView';
import { StockAnalysisView } from './components/analytics/StockAnalysisView';
import { HeatmapView } from './components/analytics/HeatmapView';
import { ImportLogsView } from './components/import/ImportLogsView';
import { SettingsView } from './components/settings/SettingsView';
import { PreImportModal } from './components/modals/PreImportModal';
import { DeleteConfirmModal } from './components/modals/DeleteConfirmModal';
import { AuthProfileModal } from './components/modals/AuthProfileModal';
import { AccountsModal } from './components/modals/AccountsModal';
import { ForceUpdateModal } from './components/modals/ForceUpdateModal';
import { LicenseGateModal } from './components/modals/LicenseGateModal';
import { MandatoryAuthGateModal } from './components/modals/MandatoryAuthGateModal';
import { AnnouncementBanner } from './components/common/AnnouncementBanner';
import { MobileApp } from './mobile/MobileApp';
import { MobileAuthScreen } from './mobile/components/MobileAuthScreen';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function App() {
  const state = useTradingState();
  const [isMobileMode, setIsMobileMode] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth <= 768;
  });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setIsMobileMode(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Render isolated Mobile Quick-Check App on mobile viewports
  if (isMobileMode) {
    if (!state.userProfile) {
      return (
        <>
          {state.toastMessage && (
            <div className="toast-container">
              <div className={`toast-item toast-${state.toastMessage.type}`}>
                {state.toastMessage.type === 'success' && <CheckCircle size={18} />}
                {state.toastMessage.type === 'error' && <AlertCircle size={18} />}
                {state.toastMessage.type === 'info' && <Info size={18} />}
                <span>{state.toastMessage.msg}</span>
              </div>
            </div>
          )}
          <MobileAuthScreen
            onLoginSuccess={(profile) => {
              state.setUserProfile(profile);
            }}
            onToast={state.showToast}
          />
        </>
      );
    }

    return (
      <>
        {state.toastMessage && (
          <div className="toast-container">
            <div className={`toast-item toast-${state.toastMessage.type}`}>
              {state.toastMessage.type === 'success' && <CheckCircle size={18} />}
              {state.toastMessage.type === 'error' && <AlertCircle size={18} />}
              {state.toastMessage.type === 'info' && <Info size={18} />}
              <span>{state.toastMessage.msg}</span>
            </div>
          </div>
        )}

        <MobileApp
          sessionDate={state.sessionDate}
          setSessionDate={state.setSessionDate}
          singleSessionAnalytics={state.singleSessionAnalytics}
          dailyStatsMap={state.dailyStatsMap}
          timezone={state.timezone}
          onTimezoneChange={state.handleTimezoneChange}
          userProfile={state.userProfile}
          onOpenAuthModal={() => state.setShowAuthModal(true)}
          syncState={state.syncState}
          settings={state.settings}
          onSaveSettings={state.handleSaveSettings}
          activeBroadcast={state.activeBroadcast}
          onDismissBroadcast={state.handleDismissBroadcast}
        />

        {/* Global Auth Modal */}
        <AuthProfileModal
          isOpen={state.showAuthModal}
          onClose={() => state.setShowAuthModal(false)}
          onToast={state.showToast}
          dailyStatsMap={state.dailyStatsMap}
        />

        {/* Mobile Accounts Modal */}
        <AccountsModal
          isOpen={state.showAccountsModal}
          onClose={() => state.setShowAccountsModal(false)}
          accounts={state.accounts}
          activeAccountId={state.activeAccountId}
          onSwitchAccount={state.handleSwitchAccount}
          onCreateAccount={state.handleCreateAccount}
          onUpdateAccount={state.handleUpdateAccount}
          onDeleteAccount={state.handleDeleteAccount}
        />

        {/* 7-Day Hard Expiry & Force Update Modal */}
        <ForceUpdateModal versionStatus={state.versionStatus} />

        {/* Mandatory User Account Authentication Gate */}
        <MandatoryAuthGateModal
          isOpen={!state.userProfile || !state.userProfile.id}
          onAuthenticated={state.handleAuthenticatedUser}
          onToast={state.showToast}
        />

        {/* Cloud Licensing & Device Lock Gate */}
        <LicenseGateModal
          licenseCheck={state.licenseCheck}
          userProfile={state.userProfile}
          onLicenseActivated={state.handleRecheckLicense}
        />
      </>
    );
  }

  return (
    <div className="app-container">
      {/* Floating Toast Notification Container */}
      {state.toastMessage && (
        <div className="toast-container">
          <div className={`toast-item toast-${state.toastMessage.type}`}>
            {state.toastMessage.type === 'success' && <CheckCircle size={18} />}
            {state.toastMessage.type === 'error' && <AlertCircle size={18} />}
            {state.toastMessage.type === 'info' && <Info size={18} />}
            <span>{state.toastMessage.msg}</span>
          </div>
        </div>
      )}

      {/* Lightbox Modal Image Overlay */}
      {state.activeLightboxImg && (
        <div className="lightbox-modal" onClick={() => state.setActiveLightboxImg(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close-btn" onClick={() => state.setActiveLightboxImg(null)}>
              <X size={18} />
            </button>
            <img src={state.activeLightboxImg} alt="Enlarged Closing Screenshot" />
          </div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <Sidebar
        currentView={state.currentView}
        setCurrentView={state.setCurrentView}
        userProfile={state.userProfile}
        onOpenAuthModal={() => state.setShowAuthModal(true)}
        hasUnsyncedChanges={state.hasUnsyncedChanges}
      />

      {/* Main Content Area */}
      <div className="main-content">
        {/* Global Admin Broadcast Announcement Banner */}
        <AnnouncementBanner
          broadcast={state.activeBroadcast}
          onDismiss={state.handleDismissBroadcast}
        />

        {/* Top Header */}
        <Header
          currentView={state.currentView}
          setCurrentView={state.setCurrentView}
          timezone={state.timezone}
          onTimezoneChange={state.handleTimezoneChange}
          singleSessionAnalytics={state.singleSessionAnalytics}
          onExportCSV={state.handleExportCSV}
          onPrintReport={state.handlePrintReport}
          userProfile={state.userProfile}
          onOpenAuthModal={() => state.setShowAuthModal(true)}
          syncState={state.syncState}
          hasUnsyncedChanges={state.hasUnsyncedChanges}
          activeAccount={state.activeAccount}
          onOpenAccountsModal={() => state.setShowAccountsModal(true)}
        />

        {/* View Router Protected with Error Boundary */}
        <ErrorBoundary resetKey={state.currentView} onReset={() => state.setCurrentView('dashboard')}>
          {state.currentView === 'singleSession' && (
            <SingleSessionView
              sessionDate={state.sessionDate}
              setSessionDate={state.setSessionDate}
              singleSessionAnalytics={state.singleSessionAnalytics}
              dailyStatsMap={state.dailyStatsMap}
              settings={state.settings}
              timezone={state.timezone}
              sessionTab={state.sessionTab}
              setSessionTab={state.setSessionTab}
              expandedStockFills={state.expandedStockFills}
              toggleStockFillDrawer={state.toggleStockFillDrawer}
              sessionScreenshots={state.sessionScreenshots}
              onAddScreenshots={state.handleInlineScreenshotSelect}
              onDeleteScreenshot={state.handleDeleteSessionScreenshot}
              onOpenLightbox={(img) => state.setActiveLightboxImg(img)}
              journalNotes={state.journalNotes}
              setJournalNotes={state.setJournalNotes}
              onSaveJournalNotes={state.handleSaveJournalNotes}
              editingSessionLog={state.editingSessionLog}
              setEditingSessionLog={state.setEditingSessionLog}
              onSaveEditedSessionLog={state.handleSaveEditedSessionLog}
              onCopyRawLog={state.handleCopyRawLog}
              showSessionCalendar={state.showSessionCalendar}
              setShowSessionCalendar={state.setShowSessionCalendar}
              sessionPopYear={state.sessionPopYear}
              setSessionPopYear={state.setSessionPopYear}
              sessionPopMonth={state.sessionPopMonth}
              setSessionPopMonth={state.setSessionPopMonth}
              sessionCalendarRef={state.sessionCalendarRef}
              smoothIntradayChartOptions={smoothIntradayChartOptions}
            />
          )}

          {state.currentView === 'dashboard' && (
            <DashboardView
              dashboardMonthFilter={state.dashboardMonthFilter}
              setDashboardMonthFilter={state.setDashboardMonthFilter}
              availableMonths={state.availableMonths}
              handlePrevMonth={state.handlePrevMonth}
              handleNextMonth={state.handleNextMonth}
              filteredDashboardAnalytics={state.filteredDashboardAnalytics}
              hourlyAnalytics={state.hourlyAnalytics}
              settings={state.settings}
              timezone={state.timezone}
              smoothEquityChartOptions={smoothEquityChartOptions}
            />
          )}

          {state.currentView === 'ecnAnalytics' && (
            <ECNAnalyticsView
              globalECNAnalytics={state.globalECNAnalytics}
            />
          )}

          {state.currentView === 'stockAnalysis' && (
            <StockAnalysisView
              stockViewMode={state.stockViewMode}
              setStockViewMode={state.setStockViewMode}
              tickerStats={state.overallAnalytics?.tickerStats || []}
              selectedStockTicker={state.selectedStockTicker}
              setSelectedStockTicker={state.setSelectedStockTicker}
              stockMarketMeta={state.stockMarketMeta}
              onRefreshStockMeta={state.handleRefreshStockMeta}
              customStockSearchInput={state.customStockSearchInput}
              setCustomStockSearchInput={state.setCustomStockSearchInput}
              selectedStockPersonalHistory={state.selectedStockPersonalHistory}
              settings={state.settings}
              timezone={state.timezone}
              onInspectSession={(date) => {
                state.setSessionDate(date);
                state.setCurrentView('singleSession');
              }}
            />
          )}

          {state.currentView === 'heatmap' && (
            <HeatmapView
              heatmapData={state.heatmapData}
              heatmapActiveOnly={state.heatmapActiveOnly}
              setHeatmapActiveOnly={state.setHeatmapActiveOnly}
              dailyStatsMap={state.dailyStatsMap}
              getHeatmapDayColor={state.getHeatmapDayColor}
              selectedHeatmapYear={state.selectedHeatmapYear}
              setSelectedHeatmapYear={state.setSelectedHeatmapYear}
              availableYears={state.availableYears}
              onSelectDate={(date) => {
                state.setSessionDate(date);
                state.setCurrentView('singleSession');
              }}
            />
          )}

          {state.currentView === 'pasteLogs' && (
            <ImportLogsView
              selectedDate={state.selectedDate}
              setSelectedDate={state.setSelectedDate}
              showImportCalendar={state.showImportCalendar}
              setShowImportCalendar={state.setShowImportCalendar}
              importPopYear={state.importPopYear}
              setImportPopYear={state.setImportPopYear}
              importPopMonth={state.importPopMonth}
              setImportPopMonth={state.setImportPopMonth}
              importCalendarRef={state.importCalendarRef}
              dailyStatsMap={state.dailyStatsMap}
              settings={state.settings}
              onSaveSettings={state.handleSaveSettings}
              pastedText={state.pastedText}
              setPastedText={state.setPastedText}
              onPasteChange={state.handlePasteChange}
              pendingScreenshots={state.pendingScreenshots}
              setPendingScreenshots={state.setPendingScreenshots}
              onFileSelect={state.handleFileSelect}
              onRemovePendingScreenshot={state.handleRemovePendingScreenshot}
              onTriggerPreImport={state.handleTriggerPreImport}
              onTriggerManualPreImport={state.handleTriggerManualPreImport}
              onSaveManualSession={state.handleSaveManualSession}
              logs={state.logs}
              onInspectSession={(date) => {
                state.setSessionDate(date);
                state.setCurrentView('singleSession');
              }}
              onDeleteLog={state.handleDeleteLog}
            />
          )}

          {state.currentView === 'settings' && (
            <SettingsView
              settings={state.settings}
              availableMonths={state.availableMonths}
              onSaveSettings={state.handleSaveSettings}
              timezone={state.timezone}
              onTimezoneChange={state.handleTimezoneChange}
              updateStatus={state.updateStatus}
              checkingUpdate={state.checkingUpdate}
              onManualCheckUpdate={state.handleManualCheckUpdate}
              onExportBackup={state.handleExportBackup}
              onImportBackup={state.handleImportBackup}
              userProfile={state.userProfile}
              onOpenAuthModal={() => state.setShowAuthModal(true)}
              licenseCheck={state.licenseCheck}
            />
          )}
        </ErrorBoundary>

        {/* USER PROFILE & CROSS-DEVICE AUTH MODAL */}
        <AuthProfileModal
          isOpen={state.showAuthModal}
          onClose={() => state.setShowAuthModal(false)}
          onToast={state.showToast}
          dailyStatsMap={state.dailyStatsMap}
        />

        {/* TRADING ACCOUNTS MODAL */}
        <AccountsModal
          isOpen={state.showAccountsModal}
          onClose={() => state.setShowAccountsModal(false)}
          accounts={state.accounts}
          activeAccountId={state.activeAccountId}
          onSwitchAccount={state.handleSwitchAccount}
          onCreateAccount={state.handleCreateAccount}
          onUpdateAccount={state.handleUpdateAccount}
          onDeleteAccount={state.handleDeleteAccount}
        />

        {/* REVIEW & CONFIRM IMPORT MODAL */}
        <PreImportModal
          isOpen={state.showPreImportModal}
          report={state.preImportReport}
          selectedDate={state.selectedDate}
          onClose={() => state.setShowPreImportModal(false)}
          onConfirm={state.handleConfirmImport}
        />

        {/* IN-APP DELETE SESSION CONFIRMATION MODAL */}
        <DeleteConfirmModal
          isOpen={!!state.deleteConfirmationDate}
          date={state.deleteConfirmationDate}
          onClose={() => state.setDeleteConfirmationDate(null)}
          onConfirm={state.handleConfirmDeleteLog}
        />

        {/* 7-DAY HARD EXPIRY & MANDATORY FORCE UPDATE MODAL */}
        <ForceUpdateModal versionStatus={state.versionStatus} />

        {/* MANDATORY USER ACCOUNT AUTHENTICATION GATE */}
        <MandatoryAuthGateModal
          isOpen={!state.userProfile || !state.userProfile.id}
          onAuthenticated={state.handleAuthenticatedUser}
          onToast={state.showToast}
        />

        {/* CRYPTOGRAPHIC CLOUD LICENSING & ACTIVATION GATE */}
        <LicenseGateModal
          isOpen={state.showLicenseModal}
          licenseCheck={state.licenseCheck}
          userProfile={state.userProfile}
          onLicenseActivated={state.handleRecheckLicense}
          onClose={() => state.setShowLicenseModal(false)}
        />
      </div>
    </div>
  );
}
