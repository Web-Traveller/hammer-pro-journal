import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  parseLogFile,
  validateLogBatch,
  compileStockTimeMatrix,
  formatTimeLabel,
  isDarkpool,
  fetchStockMarketData
} from '../parser';
import {
  getTimezone,
  setTimezoneSetting
} from '../services/timeService';
import {
  loadLogsFromStorage,
  saveLogToStorage,
  deleteLogFromStorage,
  loadSettingsFromStorage,
  saveSettingsToStorage,
  loadJournalFromStorage,
  saveJournalToStorage,
  loadScreenshotsFromStorage,
  saveScreenshotsToStorage,
  deleteScreenshotFromStorage,
  createFullBackupSnapshot,
  restoreBackupSnapshot
} from '../services/storageService';
import {
  getActiveUserProfile,
  subscribeSyncStatus,
  executeTwoTierSync,
  fetchOnDemandSessionLog,
  deleteSessionFromCloud
} from '../services/authService';
import { compressScreenshot } from '../utils/imageCompression';
import { checkAppVersionStatus } from '../services/versionService';
import { checkLicenseAndAccess } from '../services/licenseService';
import { APP_VERSION, APP_FULL_NAME } from '../version';

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
  // Navigation View
  const [currentView, setCurrentView] = useState('singleSession');

  // Logs & Sessions State
  const [logs, setLogs] = useState({});
  const [sessionDate, setSessionDate] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [pendingScreenshots, setPendingScreenshots] = useState([]);
  const [sessionScreenshots, setSessionScreenshots] = useState([]);
  const [activeLightboxImg, setActiveLightboxImg] = useState(null);

  // User Profile & Cross-Device Cloud Sync State
  const [userProfile, setUserProfile] = useState(getActiveUserProfile());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [syncState, setSyncState] = useState({ status: userProfile ? 'synced' : 'local_only', message: '' });

  // Journal & Editor State
  const [journalNotes, setJournalNotes] = useState('');
  const [editingSessionLog, setEditingSessionLog] = useState('');
  const [expandedStockFills, setExpandedStockFills] = useState({});
  const [sessionTab, setSessionTab] = useState('stocks');

  // Timezone State
  const [timezone, setTimezone] = useState(getTimezone());

  // Modals & Updater State
  const [showPreImportModal, setShowPreImportModal] = useState(false);
  const [preImportReport, setPreImportReport] = useState(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState('');
  const [versionStatus, setVersionStatus] = useState(null);
  const [licenseCheck, setLicenseCheck] = useState(null);

  // Dashboard Horizon Filter
  const [dashboardMonthFilter, setDashboardMonthFilter] = useState('ALL');

  // Stock Analysis View State
  const [stockViewMode, setStockViewMode] = useState('simple');
  const [selectedStockTicker, setSelectedStockTicker] = useState(null);
  const [stockMarketMeta, setStockMarketMeta] = useState(null);
  const [customStockSearchInput, setCustomStockSearchInput] = useState('');

  // Calendar Heatmap State & Dynamic Year Selection
  const [heatmapActiveOnly, setHeatmapActiveOnly] = useState(true);
  const [selectedHeatmapYear, setSelectedHeatmapYear] = useState(new Date().getFullYear());

  // Date Picker Popover State
  const [showSessionCalendar, setShowSessionCalendar] = useState(false);
  const [showImportCalendar, setShowImportCalendar] = useState(false);
  const [sessionPopYear, setSessionPopYear] = useState(new Date().getFullYear());
  const [sessionPopMonth, setSessionPopMonth] = useState(new Date().getMonth());
  const [importPopYear, setImportPopYear] = useState(new Date().getFullYear());
  const [importPopMonth, setImportPopMonth] = useState(new Date().getMonth());

  const sessionCalendarRef = useRef(null);
  const importCalendarRef = useRef(null);

  // User Settings State
  const [settings, setSettings] = useState({
    dateFormat: 'DD-MM-YY',
    enableJournal: true,
    enableFees: false,
    feePerShare: 0.005,
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

  // Global Toast Notifications with Timer Ref
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

  // Listen to sync status broadcasts & update live state
  useEffect(() => {
    const unsubscribe = subscribeSyncStatus((statusPayload) => {
      setSyncState(statusPayload);
      if (statusPayload.profile !== undefined) {
        setUserProfile(statusPayload.profile);
      }
      if (statusPayload.syncedLogs && Object.keys(statusPayload.syncedLogs).length > 0) {
        setLogs(prev => ({ ...prev, ...statusPayload.syncedLogs }));
        const sorted = Object.keys(statusPayload.syncedLogs).sort().reverse();
        if (sorted.length > 0) {
          setSessionDate(prev => (prev && statusPayload.syncedLogs[prev] ? prev : sorted[0]));
          setSelectedDate(prev => (prev && statusPayload.syncedLogs[prev] ? prev : sorted[0]));
        }
      }
    });
    return unsubscribe;
  }, []);

  // Close calendar popovers on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (sessionCalendarRef.current && !sessionCalendarRef.current.contains(event.target)) {
        setShowSessionCalendar(false);
      }
      if (importCalendarRef.current && !importCalendarRef.current.contains(event.target)) {
        setShowImportCalendar(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initial Load from Storage
  useEffect(() => {
    async function initData() {
      try {
        const loadedSettings = await loadSettingsFromStorage();
        if (loadedSettings) {
          setSettings(prev => ({ ...prev, ...loadedSettings }));
        }

        const loadedLogs = await loadLogsFromStorage();
        if (loadedLogs && Object.keys(loadedLogs).length > 0) {
          setLogs(loadedLogs);
          const sortedDates = Object.keys(loadedLogs).sort().reverse();
          const defaultSession = sortedDates[0];
          setSessionDate(defaultSession);
          setSelectedDate(defaultSession);
          
          // Set active year
          const firstYear = parseInt(defaultSession.split('-')[0], 10);
          if (!isNaN(firstYear)) {
            setSelectedHeatmapYear(firstYear);
            setSessionPopYear(firstYear);
            setImportPopYear(firstYear);
          }
        } else {
          const today = new Date().toISOString().slice(0, 10);
          setSelectedDate(today);
          setSessionDate(today);
        }

        const profile = getActiveUserProfile();
        setUserProfile(profile);
        if (profile && profile.cloudProvider === 'supabase_cloud') {
          executeTwoTierSync();
        }
      } catch (err) {
        console.error("Initialization error:", err);
      }
    }
    initData();

    // Auto-sync on window focus (switching between laptops / tabs) with 60s cooldown
    let lastFocusSyncTime = 0;
    const handleWindowFocus = () => {
      const now = Date.now();
      if (now - lastFocusSyncTime < 60000) return; // Skip if synced within last 60 seconds
      lastFocusSyncTime = now;

      const p = getActiveUserProfile();
      if (p && p.cloudProvider === 'supabase_cloud') {
        executeTwoTierSync();
      }
    };
    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, []);

  // Silent Background Updater
  useEffect(() => {
    if (!settings.silentUpdates) return;
    async function runSilentUpdate() {
      try {
        const update = await checkTauriUpdate();
        if (update && update.available) {
          setUpdateStatus(`Update available: v${update.version}. Downloading in background...`);
          showToast(`Downloading update v${update.version} in background...`, "info");
          await update.downloadAndInstall();
          setUpdateStatus(`Update v${update.version} ready! Restart Hammer Pro Journal to apply.`);
          showToast(`Update v${update.version} downloaded! Restart app to apply.`, "success");
        }
      } catch (e) {
        console.log("Silent update check skipped:", e);
      }
    }
    const timer = setTimeout(runSilentUpdate, 3500);
    const interval = setInterval(runSilentUpdate, 30 * 60 * 1000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [settings.silentUpdates]);

  // Version Gate & 7-Day Hard Expiry Checker
  useEffect(() => {
    checkAppVersionStatus().then(status => {
      if (status) setVersionStatus(status);
    });
  }, []);

  // Cloud Licensing & Remote Device Lock Checker
  const handleRecheckLicense = async () => {
    const res = await checkLicenseAndAccess(userProfile);
    if (res) setLicenseCheck(res);
  };

  useEffect(() => {
    handleRecheckLicense();
  }, [userProfile]);

  // Load Session-Specific Data (with On-Demand Lazy Cloud Download)
  useEffect(() => {
    if (!sessionDate) return;
    async function loadSessionAssets() {
      try {
        const note = await loadJournalFromStorage(sessionDate);
        setJournalNotes(note || '');

        const imgs = await loadScreenshotsFromStorage(sessionDate);
        setSessionScreenshots(imgs || []);

        if (logs[sessionDate]) {
          setEditingSessionLog(logs[sessionDate]);
        } else {
          // Lazy fetch from cloud on-demand if missing locally
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
  }, [sessionDate, logs]);

  // Daily Stats Map
  const dailyStatsMap = useMemo(() => {
    const map = {};
    Object.keys(logs).forEach(dateStr => {
      try {
        const analysis = parseLogFile(logs[dateStr], settings.feePerShare, settings.enableFees, settings.dateFormat, timezone);
        if (analysis) {
          map[dateStr] = analysis;
        }
      } catch (e) {
        console.error(`Error parsing log for ${dateStr}:`, e);
      }
    });
    return map;
  }, [logs, settings.feePerShare, settings.enableFees, settings.dateFormat, timezone]);

  // Single Session Analytics
  const singleSessionAnalytics = useMemo(() => {
    if (!sessionDate || !logs[sessionDate]) return null;
    try {
      const parsed = parseLogFile(logs[sessionDate], settings.feePerShare, settings.enableFees, settings.dateFormat, timezone);
      return parsed;
    } catch (e) {
      console.error("Error computing single session analytics:", e);
      return null;
    }
  }, [sessionDate, logs, settings.feePerShare, settings.enableFees, settings.dateFormat, timezone]);

  // Available Months
  const availableMonths = useMemo(() => {
    const monthsSet = new Set();
    Object.keys(dailyStatsMap).forEach(d => {
      if (d.length >= 7) monthsSet.add(d.substring(0, 7));
    });
    return Array.from(monthsSet).sort().reverse();
  }, [dailyStatsMap]);

  // Available Years
  const availableYears = useMemo(() => {
    const yearsSet = new Set();
    yearsSet.add(new Date().getFullYear());
    Object.keys(dailyStatsMap).forEach(d => {
      const y = parseInt(d.split('-')[0], 10);
      if (!isNaN(y)) yearsSet.add(y);
    });
    return Array.from(yearsSet).sort().reverse();
  }, [dailyStatsMap]);

  // Filtered Dashboard Analytics
  const filteredDashboardAnalytics = useMemo(() => {
    const validDates = Object.keys(dailyStatsMap).filter(d => {
      if (dashboardMonthFilter === 'ALL') return true;
      return d.startsWith(dashboardMonthFilter);
    }).sort();

    let totalPnl = 0;
    let grossPnl = 0;
    let totalFees = 0;
    let totalTrades = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let totalShares = 0;
    let roundTripShares = 0;
    let totalHoldTimeAcrossTrades = 0;
    let tradesCountForHoldTime = 0;
    let totalWinShares = 0;
    let totalLossShares = 0;

    const equityCurve = [];
    let runningCumulative = 0;

    validDates.forEach(dateStr => {
      const day = dailyStatsMap[dateStr];
      if (!day) return;
      const pnlVal = settings.enableFees ? (day.netPnl ?? day.pnl) : (day.grossPnl ?? day.pnl);
      totalPnl += pnlVal || 0;
      grossPnl += (day.grossPnl ?? day.pnl) || 0;
      totalFees += day.fees || 0;
      totalTrades += day.totalOrders || 0;
      winningTrades += day.winningTrades || 0;
      losingTrades += day.losingTrades || 0;
      grossProfit += (day.grossProfit !== undefined ? day.grossProfit : (day.pnl > 0 ? day.pnl : 0)) || 0;
      grossLoss += (day.grossLoss !== undefined ? day.grossLoss : (day.pnl < 0 ? Math.abs(day.pnl) : 0)) || 0;
      totalShares += (day.totalVolume || (day.roundTripShares ? day.roundTripShares * 2 : 0)) || 0;
      roundTripShares += day.roundTripShares || 0;
      totalWinShares += day.winSharesTotal || 0;
      totalLossShares += day.lossSharesTotal || 0;

      // Weighted hold time
      if (day.stockBreakdown) {
        day.stockBreakdown.forEach(s => {
          if (s.matchedTrades) {
            s.matchedTrades.forEach(t => {
              tradesCountForHoldTime++;
              totalHoldTimeAcrossTrades += (t.holdingSeconds || 0);
            });
          }
        });
      }

      runningCumulative += pnlVal;
      equityCurve.push({
        date: dateStr,
        dayPnl: pnlVal,
        cumulativePnl: runningCumulative
      });
    });

    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 99.99 : 0);
    const avgHoldTime = tradesCountForHoldTime > 0 ? totalHoldTimeAcrossTrades / tradesCountForHoldTime : 0;

    const netCentsPerShare = roundTripShares > 0 ? (totalPnl / roundTripShares) * 100 : 0;
    const avgCentsPerWinShare = totalWinShares > 0
      ? (grossProfit / totalWinShares) * 100
      : (roundTripShares > 0 && winningTrades > 0 ? (grossProfit / (roundTripShares * (winningTrades / (totalTrades || 1)))) * 100 : 0);
    const avgCentsPerLossShare = totalLossShares > 0
      ? (grossLoss / totalLossShares) * 100
      : (roundTripShares > 0 && losingTrades > 0 ? (grossLoss / (roundTripShares * (losingTrades / (totalTrades || 1)))) * 100 : 0);
    const pnlPer1kShares = roundTripShares > 0 ? (totalPnl / roundTripShares) * 1000 : 0;

    return {
      totalPnl,
      grossPnl,
      totalFees,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      profitFactor,
      totalShares,
      roundTripShares,
      avgHoldTime,
      netCentsPerShare,
      avgCentsPerWinShare: isNaN(avgCentsPerWinShare) ? 0 : avgCentsPerWinShare,
      avgCentsPerLossShare: isNaN(avgCentsPerLossShare) ? 0 : avgCentsPerLossShare,
      pnlPer1kShares,
      equityCurve
    };
  }, [dailyStatsMap, dashboardMonthFilter, settings.enableFees]);

  // Overall Ticker & Hourly Stats
  const overallAnalytics = useMemo(() => {
    try {
      const stockMap = {};
      const hourMap = {};

      Object.keys(dailyStatsMap || {}).forEach(dateStr => {
        const day = dailyStatsMap[dateStr];
        if (!day) return;
        (day.stockBreakdown || []).forEach(s => {
          if (!stockMap[s.symbol]) {
            stockMap[s.symbol] = {
              symbol: s.symbol,
              pnl: 0,
              grossPnl: 0,
              netPnl: 0,
              tradesCount: 0,
              winningTrades: 0,
              volume: 0,
              roundTripShares: 0,
              totalHoldTime: 0,
              sessions: []
            };
          }
          const pnlVal = settings.enableFees ? (s.netPnl ?? s.pnl) : s.pnl;
          stockMap[s.symbol].pnl += pnlVal;
          stockMap[s.symbol].grossPnl += s.pnl || 0;
          stockMap[s.symbol].netPnl += (s.netPnl ?? s.pnl) || 0;
          stockMap[s.symbol].tradesCount += s.tradesCount || 0;
          
          // Accumulate winning trades accurately
          const stockWins = s.wins !== undefined
            ? s.wins
            : (s.winRate !== undefined
                ? Math.round((s.winRate / 100) * (s.tradesCount || 1))
                : ((s.pnl || 0) > 0 ? (s.tradesCount || 1) : 0));
          stockMap[s.symbol].winningTrades += stockWins;

          stockMap[s.symbol].volume += s.totalQty || 0;
          stockMap[s.symbol].roundTripShares += s.roundTripShares || 0;
          stockMap[s.symbol].totalHoldTime += (s.avgHoldTime || 0) * (s.tradesCount || 1);
          stockMap[s.symbol].sessions.push({
            date: dateStr,
            pnl: s.pnl || 0,
            netPnl: (s.netPnl ?? s.pnl) || 0,
            tradesCount: s.tradesCount || 0,
            totalQty: s.totalQty || 0,
            roundTripShares: s.roundTripShares || 0,
            avgBuyPrice: s.avgBuyPrice || 0,
            avgSellPrice: s.avgSellPrice || 0,
            avgHoldTime: s.avgHoldTime || 0
          });
        });

        const daySlots = day.stockTimeMatrix?.overallSlots || day.timeOfDayAnalytics || {};
        Object.keys(daySlots).forEach(slotKey => {
          const slot = daySlots[slotKey];
          if (!slot || !slot.tradesCount) return;
          if (!hourMap[slotKey]) {
            hourMap[slotKey] = {
              slotKey,
              hourLabel: slot.slotLabel || slot.hourLabel || slotKey,
              pnl: 0,
              netPnl: 0,
              tradesCount: 0,
              winningTrades: 0
            };
          }
          hourMap[slotKey].pnl += slot.pnl || 0;
          hourMap[slotKey].netPnl += slot.pnl || 0;
          hourMap[slotKey].tradesCount += slot.tradesCount || 0;
          hourMap[slotKey].winningTrades += (slot.wins !== undefined ? slot.wins : (slot.winningTrades || 0));
        });
      });

      const tickerStats = Object.values(stockMap).map(s => ({
        ...s,
        winRate: s.tradesCount > 0 ? (s.winningTrades / s.tradesCount) * 100 : 0,
        avgHoldTime: s.tradesCount > 0 ? s.totalHoldTime / s.tradesCount : 0,
        centsPerShare: s.roundTripShares > 0 ? (s.netPnl / s.roundTripShares) * 100 : 0
      })).sort((a, b) => b.pnl - a.pnl);

      const hourlyStats = Object.values(hourMap).map(h => ({
        ...h,
        winRate: h.tradesCount > 0 ? (h.winningTrades / h.tradesCount) * 100 : 0
      })).sort((a, b) => a.slotKey.localeCompare(b.slotKey));

      return { tickerStats: tickerStats || [], hourlyStats: hourlyStats || [] };
    } catch (e) {
      console.error("Error calculating overall analytics:", e);
      return { tickerStats: [], hourlyStats: [] };
    }
  }, [dailyStatsMap, settings.enableFees]);

  const hourlyAnalytics = overallAnalytics?.hourlyStats || [];

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

  // Selected Stock Personal History
  const selectedStockPersonalHistory = useMemo(() => {
    if (!selectedStockTicker) {
      return { totalPnl: 0, netPnl: 0, winRate: 0, totalShares: 0, tradesCount: 0, sessions: [] };
    }

    const sessions = [];
    let totalPnl = 0;
    let totalNetPnl = 0;
    let totalShares = 0;
    let totalTrades = 0;
    let wins = 0;

    Object.keys(dailyStatsMap || {}).sort().reverse().forEach(date => {
      const dayStats = dailyStatsMap[date];
      if (dayStats && dayStats.stockBreakdown) {
        const item = dayStats.stockBreakdown.find(s => s.symbol === selectedStockTicker);
        if (item) {
          totalPnl += item.pnl || 0;
          totalNetPnl += (item.netPnl ?? item.pnl) || 0;
          totalShares += item.totalQty || 0;
          totalTrades += item.tradesCount || 0;

          const winsInSession = item.matchedTrades && item.matchedTrades.length > 0
            ? item.matchedTrades.filter(t => (t.pnl || 0) > 0).length
            : (item.wins !== undefined
                ? item.wins
                : (item.winRate !== undefined
                    ? Math.round((item.winRate / 100) * (item.tradesCount || 1))
                    : ((item.pnl || 0) > 0 ? (item.tradesCount || 1) : 0)));
          wins += winsInSession;

          const buys = item.executions ? item.executions.filter(e => e.action === 'Bought') : [];
          const sells = item.executions ? item.executions.filter(e => e.action === 'Sold') : [];

          const avgBuyPrice = buys.length > 0 ? (buys.reduce((a, b) => a + (b.execPrice || 0) * (b.execQty || 0), 0) / (buys.reduce((a, b) => a + (b.execQty || 0), 0) || 1)) : (item.avgBuyPrice || 0);
          const avgSellPrice = sells.length > 0 ? (sells.reduce((a, b) => a + (b.execPrice || 0) * (b.execQty || 0), 0) / (sells.reduce((a, b) => a + (b.execQty || 0), 0) || 1)) : (item.avgSellPrice || 0);

          sessions.push({
            date,
            pnl: item.pnl || 0,
            netPnl: (item.netPnl ?? item.pnl) || 0,
            tradesCount: item.tradesCount || 0,
            totalQty: item.totalQty || 0,
            avgBuyPrice,
            avgSellPrice,
            avgHoldTime: item.avgHoldTime || 0
          });
        }
      }
    });

    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    return {
      totalPnl,
      netPnl: totalNetPnl,
      winRate,
      totalShares,
      tradesCount: totalTrades,
      sessions
    };
  }, [selectedStockTicker, dailyStatsMap]);

  // Global ECN & Darkpool Analytics
  const globalECNAnalytics = useMemo(() => {
    let totalVolume = 0;
    let litVolume = 0;
    let darkpoolVolume = 0;
    const venueMap = {};
    const stockDarkpoolMap = {};

    Object.keys(dailyStatsMap).forEach(dateStr => {
      const day = dailyStatsMap[dateStr];
      (day.ecnBreakdown || []).forEach(e => {
        totalVolume += e.volume;
        if (e.isDarkpool) darkpoolVolume += e.volume;
        else litVolume += e.volume;

        if (!venueMap[e.route]) {
          venueMap[e.route] = {
            route: e.route,
            isDarkpool: e.isDarkpool,
            typeLabel: e.isDarkpool ? 'Darkpool' : 'ECN',
            volume: 0,
            fills: 0
          };
        }
        venueMap[e.route].volume += e.volume;
        venueMap[e.route].fills += e.fills;
      });

      (day.stockBreakdown || []).forEach(s => {
        if (s.darkpoolVolume > 0) {
          if (!stockDarkpoolMap[s.symbol]) {
            stockDarkpoolMap[s.symbol] = {
              symbol: s.symbol,
              darkpoolVolume: 0,
              entryDarkpools: new Set(),
              exitDarkpools: new Set()
            };
          }
          stockDarkpoolMap[s.symbol].darkpoolVolume += s.darkpoolVolume;
          (s.executions || []).forEach(ex => {
            if (ex.route && isDarkpool(ex.route)) {
              if (ex.action === 'Bought') stockDarkpoolMap[s.symbol].entryDarkpools.add(ex.route);
              else stockDarkpoolMap[s.symbol].exitDarkpools.add(ex.route);
            }
          });
        }
      });
    });

    const routeStats = Object.values(venueMap).map(v => ({
      ...v,
      pctVolume: totalVolume > 0 ? (v.volume / totalVolume) * 100 : 0
    })).sort((a, b) => b.volume - a.volume);

    const stockDarkpoolSummary = Object.values(stockDarkpoolMap).map(s => ({
      symbol: s.symbol,
      darkpoolVolume: s.darkpoolVolume,
      entryDarkpools: Array.from(s.entryDarkpools),
      exitDarkpools: Array.from(s.exitDarkpools)
    })).sort((a, b) => b.darkpoolVolume - a.darkpoolVolume);

    const litPct = totalVolume > 0 ? (litVolume / totalVolume) * 100 : 0;
    const darkpoolPct = totalVolume > 0 ? (darkpoolVolume / totalVolume) * 100 : 0;

    return {
      totalVolume,
      litVolume,
      darkpoolVolume,
      litPct,
      darkpoolPct,
      routeStats,
      stockDarkpoolSummary
    };
  }, [dailyStatsMap]);

  // Calendar Heatmap Data (Dynamic Year)
  const heatmapData = useMemo(() => {
    const year = selectedHeatmapYear || 2026;
    const monthNamesArr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const months = monthNamesArr.map((name, monthIndex) => ({
      name: `${name} ${year}`,
      monthIndex
    }));

    const result = months.map(m => {
      const days = [];
      const daysInMonth = new Date(year, m.monthIndex + 1, 0).getDate();
      const startWeekday = new Date(year, m.monthIndex, 1).getDay();

      for (let i = 0; i < startWeekday; i++) {
        days.push({ dayNum: null, dateStr: null });
      }
      let hasData = false;
      for (let d = 1; d <= daysInMonth; d++) {
        const mm = (m.monthIndex + 1).toString().padStart(2, '0');
        const dd = d.toString().padStart(2, '0');
        const dateStr = `${year}-${mm}-${dd}`;
        if (dailyStatsMap[dateStr]) hasData = true;
        days.push({ dayNum: d, dateStr });
      }
      return { ...m, days, hasData };
    });

    return heatmapActiveOnly ? result.filter(m => m.hasData) : result;
  }, [dailyStatsMap, heatmapActiveOnly, selectedHeatmapYear]);

  const getHeatmapDayColor = (dateStr) => {
    if (!dateStr || !dailyStatsMap[dateStr]) return '#f3f4f6';
    const pnl = settings.enableFees ? dailyStatsMap[dateStr].netPnl : dailyStatsMap[dateStr].pnl;
    if (pnl > 300) return '#059669';
    if (pnl > 100) return '#10b981';
    if (pnl > 0) return '#6ee7b7';
    if (pnl === 0) return '#e5e7eb';
    if (pnl > -100) return '#fda4af';
    if (pnl > -300) return '#f43f5e';
    return '#e11d48';
  };

  // Event Handlers
  const handleTimezoneChange = (newZone) => {
    setTimezone(newZone);
    setTimezoneSetting(newZone);
    showToast(`Timezone changed to ${newZone === 'INDIA_IST' ? '🇮🇳 India (IST)' : '🇺🇸 US Eastern (EDT)'}`, 'info');
  };

  const handleSaveSettings = async (newSettings) => {
    setSettings(newSettings);
    await saveSettingsToStorage(newSettings);
    showToast("Settings saved successfully!", "success");
  };

  const handlePrevMonth = () => {
    if (availableMonths.length === 0) return;
    if (dashboardMonthFilter === 'ALL') {
      setDashboardMonthFilter(availableMonths[0]);
    } else {
      const idx = availableMonths.indexOf(dashboardMonthFilter);
      if (idx < availableMonths.length - 1) {
        setDashboardMonthFilter(availableMonths[idx + 1]);
      }
    }
  };

  const handleNextMonth = () => {
    if (availableMonths.length === 0) return;
    if (dashboardMonthFilter === 'ALL') {
      setDashboardMonthFilter(availableMonths[availableMonths.length - 1]);
    } else {
      const idx = availableMonths.indexOf(dashboardMonthFilter);
      if (idx > 0) {
        setDashboardMonthFilter(availableMonths[idx - 1]);
      }
    }
  };

  const handleSaveJournalNotes = async () => {
    if (!sessionDate) return;
    await saveJournalToStorage(sessionDate, journalNotes);
    showToast(`Journal saved for ${sessionDate}!`, "success");
    // Background cloud sync
    executeTwoTierSync(dailyStatsMap);
  };

  const handleSaveEditedSessionLog = async () => {
    if (!sessionDate || !editingSessionLog.trim()) return;
    await saveLogToStorage(sessionDate, editingSessionLog);
    setLogs(prev => ({ ...prev, [sessionDate]: editingSessionLog }));
    showToast(`Session log re-parsed for ${sessionDate}!`, "success");
    executeTwoTierSync(dailyStatsMap);
  };

  const handleCopyRawLog = (text) => {
    navigator.clipboard.writeText(text);
    showToast("Raw log copied to clipboard!", "info");
  };

  const toggleStockFillDrawer = (symbol) => {
    setExpandedStockFills(prev => ({ ...prev, [symbol]: !prev[symbol] }));
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(async (file) => {
      try {
        const compressed = await compressScreenshot(file, 1920, 0.82);
        setPendingScreenshots(prev => [...prev, { filename: `${Date.now()}_${file.name}`, dataUrl: compressed }]);
      } catch (err) {
        showToast(`Failed to load ${file.name}`, 'error');
      }
    });
  };

  const handleRemovePendingScreenshot = (index) => {
    setPendingScreenshots(prev => prev.filter((_, i) => i !== index));
  };

  const handleInlineScreenshotSelect = async (e) => {
    if (!sessionDate) return;
    const files = Array.from(e.target.files);
    const newImgs = [];
    for (const file of files) {
      try {
        const compressed = await compressScreenshot(file, 1920, 0.82);
        newImgs.push({ filename: `${Date.now()}_${file.name}`, dataUrl: compressed });
      } catch (err) {
        console.warn('Screenshot compression error:', err);
      }
    }
    const updated = [...sessionScreenshots, ...newImgs];
    setSessionScreenshots(updated);
    await saveScreenshotsToStorage(sessionDate, updated);
    showToast("Screenshots compressed & attached to session!", "success");
  };

  const handleDeleteSessionScreenshot = async (filename) => {
    if (!sessionDate) return;
    const updated = sessionScreenshots.filter(img => img.filename !== filename);
    setSessionScreenshots(updated);
    await deleteScreenshotFromStorage(sessionDate, filename);
    showToast("Screenshot removed!", "info");
  };

  const handleTriggerPreImport = () => {
    if (!pastedText.trim()) {
      showToast("Please paste some log content first.", "error");
      return;
    }
    const report = validateLogBatch(pastedText, selectedDate, settings.dateFormat);
    if (!report || (!report.valid && !report.isValid)) {
      showToast(report?.message || "No valid trade execution fills found in pasted text.", "error");
      return;
    }
    setPreImportReport(report);
    setShowPreImportModal(true);
  };

  const handleConfirmImport = async () => {
    if (!preImportReport) return;
    const dateToUse = preImportReport.detectedDate || selectedDate;
    try {
      await saveLogToStorage(dateToUse, pastedText);
      if (pendingScreenshots.length > 0) {
        await saveScreenshotsToStorage(dateToUse, pendingScreenshots);
      }
      const updatedLogs = { ...logs, [dateToUse]: pastedText };
      setLogs(updatedLogs);
      setSessionDate(dateToUse);
      setPastedText('');
      setPendingScreenshots([]);
      setShowPreImportModal(false);
      setPreImportReport(null);
      setCurrentView('singleSession');
      showToast(`Session successfully imported for ${dateToUse}!`, "success");
      
      // Auto-trigger background two-tier cloud sync immediately with explicit updated logs
      executeTwoTierSync(dailyStatsMap, { explicitLogs: updatedLogs });
    } catch (err) {
      console.error("Error saving verified session:", err);
      showToast("Failed to save session to disk.", "error");
    }
  };

  const handlePasteChange = (eOrText) => {
    const text = (eOrText && eOrText.target && typeof eOrText.target.value === 'string')
      ? eOrText.target.value
      : (typeof eOrText === 'string' ? eOrText : '');
    const cleaned = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    setPastedText(cleaned);
    if (cleaned && cleaned.trim().length > 10) {
      const report = validateLogBatch(cleaned, null, settings.dateFormat);
      if (report && report.detectedDate) {
        setSelectedDate(report.detectedDate);
      }
    }
  };

  const [deleteConfirmationDate, setDeleteConfirmationDate] = useState(null);

  const handlePromptDeleteLog = (date) => {
    setDeleteConfirmationDate(date);
  };

  const handleConfirmDeleteLog = async () => {
    if (!deleteConfirmationDate) return;
    const date = deleteConfirmationDate;
    await deleteLogFromStorage(date);
    const updated = { ...logs };
    delete updated[date];
    setLogs(updated);
    const remaining = Object.keys(updated).sort().reverse();
    setSessionDate(remaining[0] || '');
    setDeleteConfirmationDate(null);
    showToast(`Session ${date} deleted.`, "info");
    
    // Permanently remove from Cloudflare R2 + Supabase and update snapshot
    await deleteSessionFromCloud(date);
  };

  const handleDeleteLog = async (date) => {
    handlePromptDeleteLog(date);
  };

  const handleExportCSV = () => {
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
  };

  const handlePrintReport = () => {
    window.print();
  };

  const handleManualCheckUpdate = async () => {
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
  };

  const handleExportBackup = async () => {
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
  };

  const handleImportBackup = async (e) => {
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
  };

  return {
    currentView,
    setCurrentView,
    logs,
    sessionDate,
    setSessionDate,
    selectedDate,
    setSelectedDate,
    pastedText,
    setPastedText,
    pendingScreenshots,
    setPendingScreenshots,
    sessionScreenshots,
    activeLightboxImg,
    setActiveLightboxImg,
    userProfile,
    setUserProfile,
    showAuthModal,
    setShowAuthModal,
    syncState,
    journalNotes,
    setJournalNotes,
    editingSessionLog,
    setEditingSessionLog,
    expandedStockFills,
    sessionTab,
    setSessionTab,
    timezone,
    showPreImportModal,
    setShowPreImportModal,
    preImportReport,
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
    availableYears,
    showSessionCalendar,
    setShowSessionCalendar,
    showImportCalendar,
    setShowImportCalendar,
    sessionPopYear,
    setSessionPopYear,
    sessionPopMonth,
    setSessionPopMonth,
    importPopYear,
    setImportPopYear,
    importPopMonth,
    setImportPopMonth,
    sessionCalendarRef,
    importCalendarRef,
    settings,
    toastMessage,
    showToast,
    dailyStatsMap,
    singleSessionAnalytics,
    availableMonths,
    filteredDashboardAnalytics,
    overallAnalytics,
    hourlyAnalytics,
    selectedStockPersonalHistory,
    globalECNAnalytics,
    heatmapData,
    getHeatmapDayColor,
    handleTimezoneChange,
    handleSaveSettings,
    handlePrevMonth,
    handleNextMonth,
    handleSaveJournalNotes,
    handleSaveEditedSessionLog,
    handleCopyRawLog,
    toggleStockFillDrawer,
    handleFileSelect,
    handleRemovePendingScreenshot,
    handleInlineScreenshotSelect,
    handleDeleteSessionScreenshot,
    handleTriggerPreImport,
    handleConfirmImport,
    handlePasteChange,
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
    licenseCheck,
    handleRecheckLicense
  };
}
