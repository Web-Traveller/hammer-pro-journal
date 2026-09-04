import { useState, useEffect, useRef, useCallback } from 'react';
import { formatTimeLabel, fetchStockMarketData } from '../parser';
import { getTimezone, setTimezoneSetting } from '../services/timeService';
import {
  loadLogsFromStorage,
  saveLogToStorage,
  deleteLogFromStorage,
  loadSettingsFromStorage,
  saveSettingsToStorage,
  loadJournalFromStorage,
  saveJournalToStorage,
  loadScreenshotsFromStorage,
  createFullBackupSnapshot,
  restoreBackupSnapshot,
  cleanExpiredBackupRevisions
} from '../services/storageService';
import {
  getActiveUserProfile,
  subscribeSyncStatus,
  executeTwoTierSync,
  refreshUserProfile,
  fetchOnDemandSessionLog,
  deleteSessionFromCloud
} from '../services/authService';
import { checkAppVersionStatus, checkAndApplySilentUpdate } from '../services/versionService';
import { checkLicenseAndAccess } from '../services/licenseService';
import { fetchActiveBroadcast, dismissBroadcast } from '../services/broadcastService';
import { APP_VERSION, APP_FULL_NAME } from '../version';

// Sub-hooks
import { useAccountState } from './useAccountState';
import { useScreenshotHandlers } from './useScreenshotHandlers';
import { useImportHandlers } from './useImportHandlers';
import { useAnalyticsMemos } from './useAnalyticsMemos';

// Safe Tauri updater loader
async function checkTauriUpdate() {
  if (typeof window === 'undefined' || (!window.__TAURI_INTERNALS__ && !window.__TAURI__)) {
    return null;
  }
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    return await check();
  } catch (err) {
    return null;
  }
}

export function useTradingState() {
  // 1. Navigation View
  const [currentView, setCurrentView] = useState('singleSession');

  // 2. Global Toast System
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimerRef = useRef(null);
  const showToast = useCallback((msg, type = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage({ msg, type });
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 3500);
  }, []);

  // 3. Multi-Account Management Hook
  const accountState = useAccountState(showToast);
  const { activeAccountId } = accountState;

  // 4. Core Logs & Session Date State
  const [logs, setLogs] = useState({});
  const [sessionDate, setSessionDate] = useState('');
  const userLockedSessionDateRef = useRef(false);

  // Set session date with user intention tracking
  const handleSetSessionDate = useCallback((newDate) => {
    if (newDate) userLockedSessionDateRef.current = true;
    setSessionDate(newDate);
  }, []);

  // 5. User Settings State
  const [settings, setSettings] = useState({
    dateFormat: 'DD-MM-YY',
    enableJournal: true,
    journalTopTradesCount: 2,
    enableFees: false,
    feePerShare: 0.005,
    enableMonthlyPlatformFee: false,
    monthlyPlatformFee: 150,
    silentUpdates: true,
    cloudProvider: 'supabase_cloud',
    supabaseUrl: '',
    supabaseAnonKey: '',
    gdriveSyncPath: '',
    gdriveFolderId: '',
    gdriveAccessToken: '',
    r2BackupUrl: '',
    r2AccountId: '',
    r2Bucket: '',
    r2AccessKey: '',
    r2SecretKey: '',
    timezoneGroundTruth: 'US_EASTERN'
  });

  // 6. User Profile & Cloud Sync State
  const [userProfile, setUserProfile] = useState(getActiveUserProfile());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [syncState, setSyncState] = useState({ status: userProfile ? 'synced' : 'local_only', message: '' });
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);
  const pendingSyncRef = useRef(false);

  const queueDeferredSync = useCallback((explicitUpdatedLogs = null) => {
    const p = getActiveUserProfile();
    if (p && p.canCloudSync === true) {
      pendingSyncRef.current = true;
      setHasUnsyncedChanges(true);
    } else {
      pendingSyncRef.current = false;
      setHasUnsyncedChanges(false);
    }
  }, []);

  const handleAuthenticatedUser = useCallback((profile) => {
    setUserProfile(profile);
    if (profile && profile.canCloudSync === true) {
      executeTwoTierSync({}, { force: true });
    }
  }, []);

  // 7. Timezone State
  const [timezone, setTimezone] = useState(getTimezone());

  // 8. Modals & Version Gate State
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState('');
  const [versionStatus, setVersionStatus] = useState(null);
  const [activeBroadcast, setActiveBroadcast] = useState(null);
  const [licenseCheck, setLicenseCheck] = useState(null);
  const [showLicenseModal, setShowLicenseModal] = useState(false);

  const handleDismissBroadcast = useCallback(() => {
    if (activeBroadcast?.id) {
      dismissBroadcast(activeBroadcast.id);
    }
    setActiveBroadcast(null);
  }, [activeBroadcast]);

  // 9. Session Drawer & Tab State
  const [journalNotes, setJournalNotes] = useState('');
  const [editingSessionLog, setEditingSessionLog] = useState('');
  const [expandedStockFills, setExpandedStockFills] = useState({});
  const [sessionTab, setSessionTab] = useState('stocks');

  // 10. Dashboard & View Specific State
  const [dashboardMonthFilter, setDashboardMonthFilter] = useState('ALL');
  const [stockViewMode, setStockViewMode] = useState('simple');
  const [selectedStockTicker, setSelectedStockTicker] = useState(null);
  const [stockMarketMeta, setStockMarketMeta] = useState(null);
  const [customStockSearchInput, setCustomStockSearchInput] = useState('');
  const [heatmapActiveOnly, setHeatmapActiveOnly] = useState(true);
  const [selectedHeatmapYear, setSelectedHeatmapYear] = useState(new Date().getFullYear());

  // 11. Calendar Popovers State
  const [showSessionCalendar, setShowSessionCalendar] = useState(false);
  const [sessionPopYear, setSessionPopYear] = useState(new Date().getFullYear());
  const [sessionPopMonth, setSessionPopMonth] = useState(new Date().getMonth());
  const sessionCalendarRef = useRef(null);

  // 12. Modular Screenshot Handlers Hook
  const screenshotHandlers = useScreenshotHandlers({
    sessionDate,
    licenseCheck,
    userProfile,
    showToast,
    activeAccountId
  });

  // 13. Modular Import Handlers Hook
  const importHandlers = useImportHandlers({
    logs,
    setLogs,
    setSessionDate: handleSetSessionDate,
    setCurrentView,
    settings,
    licenseCheck,
    showToast,
    onQueueSync: queueDeferredSync,
    activeAccountId
  });

  // 14. Modular Analytics Memos Hook
  const analyticsMemos = useAnalyticsMemos({
    logs,
    sessionDate,
    settings,
    timezone,
    dashboardMonthFilter,
    selectedStockTicker,
    selectedHeatmapYear,
    heatmapActiveOnly
  });
  const { dailyStatsMap, overallAnalytics, singleSessionAnalytics, availableMonths } = analyticsMemos;

  // =========================================================================
  // LIFECYCLE & SYNC EFFECTS
  // =========================================================================

  // Initial Load from Storage & Account Switch Listener
  useEffect(() => {
    async function initData() {
      try {
        cleanExpiredBackupRevisions(14);
        const loadedSettings = await loadSettingsFromStorage();
        if (loadedSettings) {
          setSettings(prev => ({ ...prev, ...loadedSettings, enableJournal: true }));
        }

        const loadedLogs = await loadLogsFromStorage(activeAccountId);
        if (loadedLogs && Object.keys(loadedLogs).length > 0) {
          setLogs(loadedLogs);
          const sortedDates = Object.keys(loadedLogs).sort().reverse();
          const defaultSession = sortedDates[0];
          setSessionDate(defaultSession);
          importHandlers.setSelectedDate(defaultSession);

          const firstYear = parseInt(defaultSession.split('-')[0], 10);
          if (!isNaN(firstYear)) {
            setSelectedHeatmapYear(firstYear);
            setSessionPopYear(firstYear);
            importHandlers.setImportPopYear(firstYear);
          }
        } else {
          // Account has no logs yet (clean slate)
          setLogs({});
          const today = new Date().toISOString().slice(0, 10);
          setSessionDate(today);
          importHandlers.setSelectedDate(today);
        }

        const profile = getActiveUserProfile();
        setUserProfile(profile);
        if (profile && profile.canCloudSync === true) {
          executeTwoTierSync();
        }
      } catch (err) {
        console.error("Initialization error:", err);
      }
    }
    initData();
  }, [activeAccountId]);

  // Listen to sync broadcasts without overriding user-picked dates
  useEffect(() => {
    const unsubscribe = subscribeSyncStatus((statusPayload) => {
      setSyncState(statusPayload);
      if (statusPayload.profile !== undefined) {
        setUserProfile(prev => {
          if (!prev && !statusPayload.profile) return null;
          if (!prev || !statusPayload.profile) return statusPayload.profile;
          if (
            prev.id === statusPayload.profile.id &&
            prev.canCloudSync === statusPayload.profile.canCloudSync &&
            prev.dailyImageLimit === statusPayload.profile.dailyImageLimit &&
            prev.planTier === statusPayload.profile.planTier &&
            prev.isBlocked === statusPayload.profile.isBlocked &&
            prev.name === statusPayload.profile.name &&
            prev.email === statusPayload.profile.email &&
            prev.avatarUrl === statusPayload.profile.avatarUrl
          ) {
            return prev;
          }
          // If upgraded to cloud sync, trigger immediate sync
          if (prev && !prev.canCloudSync && statusPayload.profile.canCloudSync) {
            setTimeout(() => {
              executeTwoTierSync({}, { force: true });
            }, 150);
          }
          return statusPayload.profile;
        });
      }
      if (statusPayload.syncedLogs && Object.keys(statusPayload.syncedLogs).length > 0) {
        setLogs(prev => ({ ...prev, ...statusPayload.syncedLogs }));
        const sorted = Object.keys(statusPayload.syncedLogs).sort().reverse();

        // ONLY change date if user has not manually locked their selected date
        if (sorted.length > 0) {
          setSessionDate(prev => {
            if (userLockedSessionDateRef.current && prev) return prev;
            return (prev && statusPayload.syncedLogs[prev]) ? prev : sorted[0];
          });
          importHandlers.setSelectedDate(prev => {
            if (importHandlers.isDateManuallyLockedRef.current && prev) return prev;
            return (prev && statusPayload.syncedLogs[prev]) ? prev : sorted[0];
          });
        }
      }
    });
    return unsubscribe;
  }, []);

  // Deferred Background Sync (Flushes every 5 min ONLY if actual changes occurred)
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (pendingSyncRef.current) {
        const p = getActiveUserProfile();
        if (p && p.canCloudSync === true) {
          executeTwoTierSync(dailyStatsMap).then(res => {
            if (res && res.success) {
              pendingSyncRef.current = false;
              setHasUnsyncedChanges(false);
            }
          }).catch(e => console.warn('Deferred sync note:', e));
        } else {
          pendingSyncRef.current = false;
          setHasUnsyncedChanges(false);
        }
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(syncInterval);
  }, [dailyStatsMap]);

  // Window Focus Sync (Rate-limited to 60s cooldown)
  useEffect(() => {
    let lastFocusSyncTime = 0;
    const handleWindowFocus = () => {
      const now = Date.now();
      if (now - lastFocusSyncTime < 60000) return;
      lastFocusSyncTime = now;

      // Refresh latest profile entitlements on focus (e.g. admin enabled cloud sync)
      refreshUserProfile().then(refreshed => {
        const p = refreshed || getActiveUserProfile();
        if (p && p.canCloudSync === true) {
          executeTwoTierSync();
        }
      }).catch(() => {
        const p = getActiveUserProfile();
        if (p && p.canCloudSync === true) {
          executeTwoTierSync();
        }
      });
    };
    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, []);

  // Silent Background Auto-Updater
  useEffect(() => {
    async function runSilentUpdate() {
      try {
        await checkAndApplySilentUpdate(false, null);
      } catch (e) {}
    }
    const timer = setTimeout(runSilentUpdate, 3500);
    const interval = setInterval(runSilentUpdate, 30 * 60 * 1000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  // Version Gate & Expiry Checker + Broadcast Announcement + Profile Entitlements Refresh
  useEffect(() => {
    checkAppVersionStatus().then(status => {
      if (status) setVersionStatus(status);
    });
    fetchActiveBroadcast().then(b => {
      if (b) setActiveBroadcast(b);
    });
    // Check and refresh user profile entitlements silently from Supabase on startup
    refreshUserProfile().then(refreshed => {
      if (refreshed && refreshed.canCloudSync) {
        executeTwoTierSync({}, { force: true });
      }
    }).catch(() => {});
  }, []);

  // Licensing & Access Checker
  const handleRecheckLicense = async () => {
    const res = await checkLicenseAndAccess(userProfile);
    if (res) setLicenseCheck(res);
  };

  useEffect(() => {
    handleRecheckLicense();
  }, [userProfile]);

  // Outside Click Listener for Session Calendar Popover
  useEffect(() => {
    function handleClickOutside(event) {
      if (sessionCalendarRef.current && !sessionCalendarRef.current.contains(event.target)) {
        setShowSessionCalendar(false);
      }
      if (importHandlers.importCalendarRef.current && !importHandlers.importCalendarRef.current.contains(event.target)) {
        importHandlers.setShowImportCalendar(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [importHandlers.importCalendarRef]);

  // Session-Specific Assets Loading (Decoupled from editing text updates)
  useEffect(() => {
    if (!sessionDate) return;
    async function loadSessionAssets() {
      try {
        const note = await loadJournalFromStorage(sessionDate, activeAccountId);
        setJournalNotes(note || '');

        const imgs = await loadScreenshotsFromStorage(sessionDate);
        screenshotHandlers.setSessionScreenshots(imgs || []);

        if (logs[sessionDate]) {
          setEditingSessionLog(logs[sessionDate]);
        } else {
          const fetchedLog = await fetchOnDemandSessionLog(sessionDate);
          if (fetchedLog) {
            setLogs(prev => ({ ...prev, [sessionDate]: fetchedLog }));
            setEditingSessionLog(fetchedLog);
          }
        }
      } catch (e) {
        console.error("Error loading session assets:", e);
      }
    }
    loadSessionAssets();
  }, [sessionDate, activeAccountId]);

  // Keep editing text in sync if logs object changes
  useEffect(() => {
    if (sessionDate && logs[sessionDate] && !editingSessionLog) {
      setEditingSessionLog(logs[sessionDate]);
    }
  }, [sessionDate, logs]);

  // Auto-select first stock ticker when navigating to stock analysis view
  useEffect(() => {
    if (currentView === 'stockAnalysis') {
      if (!selectedStockTicker && overallAnalytics?.tickerStats?.length > 0) {
        setSelectedStockTicker(overallAnalytics.tickerStats[0].symbol);
      }
    }
  }, [currentView, overallAnalytics, selectedStockTicker]);

  // Fetch Live Stock Market Metadata from Finviz
  useEffect(() => {
    if (selectedStockTicker) {
      fetchStockMarketData(selectedStockTicker).then(data => {
        if (data) setStockMarketMeta(data);
      }).catch(err => {
        console.warn("Finviz metadata fetch failed:", err);
      });
    }
  }, [selectedStockTicker]);

  const handleRefreshStockMeta = useCallback((ticker) => {
    const sym = ticker || selectedStockTicker;
    if (sym) {
      fetchStockMarketData(sym, true).then(data => {
        if (data) setStockMarketMeta(data);
      }).catch(err => {
        console.warn("Finviz metadata refresh failed:", err);
      });
    }
  }, [selectedStockTicker]);

  // =========================================================================
  // ACTIONS & HANDLERS
  // =========================================================================

  const handleTimezoneChange = useCallback((newZone) => {
    setTimezone(newZone);
    setTimezoneSetting(newZone);
    showToast(`Timezone changed to ${newZone === 'INDIA_IST' ? '🇮🇳 India (IST)' : '🇺🇸 US Eastern (EDT)'}`, 'info');
  }, [showToast]);

  const handleSaveSettings = useCallback(async (newSettings) => {
    const updated = { ...newSettings, enableJournal: true };
    setSettings(updated);
    await saveSettingsToStorage(updated);
    showToast("Settings saved successfully!", "success");
  }, [showToast]);

  const handlePrevMonth = useCallback(() => {
    if (availableMonths.length === 0) return;
    if (dashboardMonthFilter === 'ALL') {
      setDashboardMonthFilter(availableMonths[0]);
    } else {
      const idx = availableMonths.indexOf(dashboardMonthFilter);
      if (idx < availableMonths.length - 1) {
        setDashboardMonthFilter(availableMonths[idx + 1]);
      }
    }
  }, [availableMonths, dashboardMonthFilter]);

  const handleNextMonth = useCallback(() => {
    if (availableMonths.length === 0) return;
    if (dashboardMonthFilter === 'ALL') {
      setDashboardMonthFilter(availableMonths[availableMonths.length - 1]);
    } else {
      const idx = availableMonths.indexOf(dashboardMonthFilter);
      if (idx > 0) {
        setDashboardMonthFilter(availableMonths[idx - 1]);
      }
    }
  }, [availableMonths, dashboardMonthFilter]);

  const handleSaveJournalNotes = useCallback(async () => {
    if (!sessionDate) return;
    await saveJournalToStorage(sessionDate, journalNotes, activeAccountId);
    showToast(`Journal saved for ${sessionDate}!`, "success");
    queueDeferredSync();
  }, [sessionDate, journalNotes, showToast, queueDeferredSync, activeAccountId]);

  const handleSaveEditedSessionLog = useCallback(async () => {
    if (!sessionDate || !editingSessionLog.trim()) return;
    await saveLogToStorage(sessionDate, editingSessionLog, activeAccountId);
    setLogs(prev => ({ ...prev, [sessionDate]: editingSessionLog }));
    showToast(`Session log re-parsed for ${sessionDate}!`, "success");
    queueDeferredSync();
  }, [sessionDate, editingSessionLog, showToast, queueDeferredSync, activeAccountId]);

  const handleCopyRawLog = useCallback((text) => {
    navigator.clipboard.writeText(text);
    showToast("Raw log copied to clipboard!", "info");
  }, [showToast]);

  const toggleStockFillDrawer = useCallback((symbol) => {
    setExpandedStockFills(prev => ({ ...prev, [symbol]: !prev[symbol] }));
  }, []);

  const [deleteConfirmationDate, setDeleteConfirmationDate] = useState(null);

  const handleDeleteLog = useCallback((date) => {
    setDeleteConfirmationDate(date);
  }, []);

  const handleConfirmDeleteLog = useCallback(async () => {
    if (!deleteConfirmationDate) return;
    const date = deleteConfirmationDate;
    await deleteLogFromStorage(date, activeAccountId);
    const updated = { ...logs };
    delete updated[date];
    setLogs(updated);
    const remaining = Object.keys(updated).sort().reverse();
    setSessionDate(remaining[0] || '');
    setDeleteConfirmationDate(null);
    showToast(`Session ${date} deleted.`, "info");
    await deleteSessionFromCloud(date);
  }, [deleteConfirmationDate, logs, showToast, activeAccountId]);

  const handleExportCSV = useCallback(() => {
    if (!singleSessionAnalytics || !singleSessionAnalytics.allExecutions) return;
    const headers = ["Timestamp", "Action", "Symbol", "Qty", "Price", "Route", "OrderDesc"];
    const rows = singleSessionAnalytics.allExecutions.map(e => [
      formatTimeLabel(e.dateObj, timezone),
      e.action,
      e.symbol,
      e.execQty,
      e.execPrice,
      e.route,
      `"${(e.orderDesc || '').replace(/"/g, '""')}"`
    ]);
    const csvString = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `HammerPro_Trades_${sessionDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("CSV export downloaded!", "success");
  }, [singleSessionAnalytics, sessionDate, timezone, showToast]);

  const handlePrintReport = useCallback(() => {
    window.print();
  }, []);

  const handleManualCheckUpdate = useCallback(async () => {
    setCheckingUpdate(true);
    setUpdateStatus("Connecting to release server...");
    try {
      const update = await checkTauriUpdate();
      if (update && update.available) {
        setUpdateStatus(`Update available: v${update.version}. Downloading in background...`);
        await update.downloadAndInstall();
        setUpdateStatus(`Update v${update.version} ready! Restart Hammer Pro Journal to apply.`);
        showToast(`Update v${update.version} downloaded! Restart app to apply.`, "success");
      } else {
        setUpdateStatus(`You are running the latest version of ${APP_FULL_NAME}.`);
        showToast("You are on the latest version!", "info");
      }
    } catch (e) {
      setUpdateStatus("Update check completed. Running latest build.");
      showToast("Running latest version.", "info");
    } finally {
      setCheckingUpdate(false);
    }
  }, [showToast]);

  const handleExportBackup = useCallback(async () => {
    try {
      const snapshot = await createFullBackupSnapshot();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `HammerPro_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showToast("Full backup archive downloaded!", "success");
    } catch (err) {
      showToast("Backup export failed.", "error");
    }
  }, [showToast]);

  const handleImportBackup = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        const res = await restoreBackupSnapshot(parsed);
        if (res) {
          showToast("Backup restored! Reloading data...", "success");
          setTimeout(() => window.location.reload(), 1200);
        }
      } catch (err) {
        showToast("Failed to parse backup JSON file.", "error");
      }
    };
    reader.readAsText(file);
  }, [showToast]);

  return {
    currentView,
    setCurrentView,
    logs,
    sessionDate,
    setSessionDate: handleSetSessionDate,
    selectedDate: importHandlers.selectedDate,
    setSelectedDate: importHandlers.handleSelectImportDate,
    pastedText: importHandlers.pastedText,
    setPastedText: importHandlers.setPastedText,
    pendingScreenshots: importHandlers.pendingScreenshots,
    setPendingScreenshots: importHandlers.setPendingScreenshots,
    sessionScreenshots: screenshotHandlers.sessionScreenshots,
    activeLightboxImg: screenshotHandlers.activeLightboxImg,
    setActiveLightboxImg: screenshotHandlers.setActiveLightboxImg,
    userProfile,
    setUserProfile,
    showAuthModal,
    setShowAuthModal,
    syncState,
    hasUnsyncedChanges,
    journalNotes,
    setJournalNotes,
    editingSessionLog,
    setEditingSessionLog,
    expandedStockFills,
    sessionTab,
    setSessionTab,
    timezone,
    showPreImportModal: importHandlers.showPreImportModal,
    setShowPreImportModal: importHandlers.setShowPreImportModal,
    preImportReport: importHandlers.preImportReport,
    checkingUpdate,
    updateStatus,
    dashboardMonthFilter,
    setDashboardMonthFilter,
    stockViewMode,
    setStockViewMode,
    selectedStockTicker,
    setSelectedStockTicker,
    stockMarketMeta,
    customStockSearchInput,
    setCustomStockSearchInput,
    heatmapActiveOnly,
    setHeatmapActiveOnly,
    selectedHeatmapYear,
    setSelectedHeatmapYear,
    availableYears: analyticsMemos.availableYears,
    showSessionCalendar,
    setShowSessionCalendar,
    showImportCalendar: importHandlers.showImportCalendar,
    setShowImportCalendar: importHandlers.setShowImportCalendar,
    sessionPopYear,
    setSessionPopYear,
    sessionPopMonth,
    setSessionPopMonth,
    importPopYear: importHandlers.importPopYear,
    setImportPopYear: importHandlers.setImportPopYear,
    importPopMonth: importHandlers.importPopMonth,
    setImportPopMonth: importHandlers.setImportPopMonth,
    sessionCalendarRef,
    importCalendarRef: importHandlers.importCalendarRef,
    settings,
    toastMessage,
    showToast,
    dailyStatsMap: analyticsMemos.dailyStatsMap,
    singleSessionAnalytics: analyticsMemos.singleSessionAnalytics,
    availableMonths: analyticsMemos.availableMonths,
    filteredDashboardAnalytics: analyticsMemos.filteredDashboardAnalytics,
    overallAnalytics: analyticsMemos.overallAnalytics,
    hourlyAnalytics: analyticsMemos.hourlyAnalytics,
    selectedStockPersonalHistory: analyticsMemos.selectedStockPersonalHistory,
    globalECNAnalytics: analyticsMemos.globalECNAnalytics,
    heatmapData: analyticsMemos.heatmapData,
    getHeatmapDayColor: analyticsMemos.getHeatmapDayColor,
    handleTimezoneChange,
    handleSaveSettings,
    handlePrevMonth,
    handleNextMonth,
    handleSaveJournalNotes,
    handleSaveEditedSessionLog,
    handleCopyRawLog,
    toggleStockFillDrawer,
    handleFileSelect: importHandlers.handleFileSelect,
    handleRemovePendingScreenshot: importHandlers.handleRemovePendingScreenshot,
    handleInlineScreenshotSelect: screenshotHandlers.handleInlineScreenshotSelect,
    handleDeleteSessionScreenshot: screenshotHandlers.handleDeleteSessionScreenshot,
    handleTriggerPreImport: importHandlers.handleTriggerPreImport,
    handleTriggerManualPreImport: importHandlers.handleTriggerManualPreImport,
    handleConfirmImport: importHandlers.handleConfirmImport,
    handleSaveManualSession: importHandlers.handleSaveManualSession,
    handlePasteChange: importHandlers.handlePasteChange,
    handleRefreshStockMeta,
    handleDeleteLog,
    deleteConfirmationDate,
    setDeleteConfirmationDate,
    handleConfirmDeleteLog,
    handleExportCSV,
    handlePrintReport,
    handleManualCheckUpdate,
    handleExportBackup,
    handleImportBackup,
    versionStatus,
    activeBroadcast,
    handleDismissBroadcast,
    licenseCheck,
    handleRecheckLicense,
    showLicenseModal,
    setShowLicenseModal,
    handleAuthenticatedUser,

    // Multi-Account Additions
    accounts: accountState.accounts,
    activeAccountId: accountState.activeAccountId,
    activeAccount: accountState.activeAccount,
    showAccountsModal: accountState.showAccountsModal,
    setShowAccountsModal: accountState.setShowAccountsModal,
    handleSwitchAccount: accountState.handleSwitchAccount,
    handleCreateAccount: accountState.handleCreateAccount,
    handleUpdateAccount: accountState.handleUpdateAccount,
    handleDeleteAccount: accountState.handleDeleteAccount
  };
}
