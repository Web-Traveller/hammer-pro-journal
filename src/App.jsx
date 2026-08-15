import React from 'react';
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
      />

      {/* Main Content Area */}
      <div className="main-content">
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
              onSaveSettings={state.handleSaveSettings}
              timezone={state.timezone}
              onTimezoneChange={state.handleTimezoneChange}
              updateStatus={state.updateStatus}
              checkingUpdate={state.checkingUpdate}
              onManualCheckUpdate={state.handleManualCheckUpdate}
              onExportBackup={state.handleExportBackup}
              onImportBackup={state.handleImportBackup}
              onExportCSV={state.handleExportCSV}
              onPrintReport={state.handlePrintReport}
              activeSessionDate={state.sessionDate}
              userProfile={state.userProfile}
              onOpenAuthModal={() => state.setShowAuthModal(true)}
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
      </div>
    </div>
  );
}
