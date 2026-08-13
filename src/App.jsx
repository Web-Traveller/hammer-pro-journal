import React, { useState, useEffect, useMemo, useRef } from 'react';
import { check as checkTauriUpdate } from '@tauri-apps/plugin-updater';
import { Line, Scatter, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import {
  LayoutDashboard,
  Calendar,
  BarChart3,
  Upload,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Percent,
  DollarSign,
  Activity,
  FileText,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  Plus,
  Server,
  Layers,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Zap,
  Image as ImageIcon,
  X,
  Maximize2,
  Scale,
  Edit3,
  Save,
  Settings as SettingsIcon,
  ChevronDown,
  ChevronUp,
  Download,
  Cloud,
  BookOpen,
  Search,
  RefreshCw,
  Award,
  AlertTriangle,
  ExternalLink,
  Sliders,
  Sparkles,
  Share2,
  Share,
  ShareIcon
} from 'lucide-react';
import './App.css';
import {
  extractExecutions,
  matchTradesFIFO,
  compileDailyStats,
  compileSingleDayAnalytics,
  compileECNAnalytics,
  compileOverallAnalytics,
  compileHourlyAnalytics,
  parseTime,
  isDarkpool,
  fetchStockMarketData
} from './parser';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;

async function safeInvoke(cmd, args = {}) {
  if (isTauri) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke(cmd, args);
    } catch (e) {
      console.error("Tauri invoke failed, falling back to local storage:", e);
    }
  }
  
  // Web Fallback (localStorage)
  if (cmd === "save_log") {
    localStorage.setItem(`trading_log_${args.date}`, args.content);
    return;
  } else if (cmd === "load_all_logs") {
    const logs = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("trading_log_")) {
        const date = key.slice(12);
        logs[date] = localStorage.getItem(key);
      }
    }
    return logs;
  } else if (cmd === "delete_log") {
    localStorage.removeItem(`trading_log_${args.date}`);
    localStorage.removeItem(`trading_journal_${args.date}`);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`trading_img_${args.date}_`)) {
        localStorage.removeItem(key);
      }
    }
    return;
  } else if (cmd === "save_screenshot") {
    localStorage.setItem(`trading_img_${args.date}_${args.filename}`, args.dataUrl);
    return;
  } else if (cmd === "load_session_screenshots") {
    const images = [];
    const prefix = `trading_img_${args.date}_`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const filename = key.replace(`trading_img_${args.date}_`, '');
        images.push({
          filename,
          dataUrl: localStorage.getItem(key)
        });
      }
    }
    images.sort((a, b) => a.filename.localeCompare(b.filename));
    return images;
  } else if (cmd === "delete_screenshot") {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.endsWith(args.filename)) {
        localStorage.removeItem(key);
        break;
      }
    }
    return;
  } else if (cmd === "save_settings") {
    localStorage.setItem("trading_settings", JSON.stringify(args.settings));
    return;
  } else if (cmd === "load_settings") {
    const s = localStorage.getItem("trading_settings");
    return s ? JSON.parse(s) : null;
  } else if (cmd === "save_journal") {
    localStorage.setItem(`trading_journal_${args.date}`, args.content);
    return;
  } else if (cmd === "load_journal") {
    return localStorage.getItem(`trading_journal_${args.date}`) || "";
  } else if (cmd === "get_log_dir") {
    return "Browser LocalStorage (Web Sandbox)";
  }
}

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function getCalendarPopoverGrid(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = new Date(year, month, 1).getDay();
  const grid = [];
  for (let i = 0; i < startWeekday; i++) {
    grid.push({ dayNum: null, dateStr: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = (month + 1).toString().padStart(2, '0');
    const dd = d.toString().padStart(2, '0');
    grid.push({ dayNum: d, dateStr: `${year}-${mm}-${dd}` });
  }
  return grid;
}

export default function App() {
  const [logs, setLogs] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('singleSession');
  const [pastedText, setPastedText] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [sessionTab, setSessionTab] = useState('stocks'); // 'stocks', 'ecn', 'raw', 'journal'
  const [editingSessionLog, setEditingSessionLog] = useState('');
  const [copied, setCopied] = useState(false);

  // Settings State
  const [settings, setSettings] = useState({
    dateFormat: 'DD-MM-YY', // 'DD-MM-YY', 'MM/DD/YY', 'YYYY-MM-DD'
    enableFees: true,
    feePerShare: 0.05,
    enableJournal: true,
    cloudProvider: 'none',
    r2AccountId: '',
    r2AccessKey: '',
    r2SecretKey: '',
    r2Bucket: '',
    silentUpdates: true,
    gdriveSyncPath: '',
    gdriveFolderId: '',
    gdriveAccessToken: '',
    r2BackupUrl: ''
  });


  // Session Journal State
  const [journalNotes, setJournalNotes] = useState('');

  // Expandable Stock Fills Drawer map
  const [expandedStockFills, setExpandedStockFills] = useState({});

  // Dashboard Month Horizon Filter State
  const [dashboardMonthFilter, setDashboardMonthFilter] = useState('ALL');



  // Heatmap View Mode State
  const [heatmapActiveOnly, setHeatmapActiveOnly] = useState(false);

  // Stock Performance View State (Simple vs Advanced Mode)
  const [stockViewMode, setStockViewMode] = useState('advanced'); // 'simple' | 'advanced'
  const [selectedStockTicker, setSelectedStockTicker] = useState('');
  const [customStockSearchInput, setCustomStockSearchInput] = useState('');
  const [stockMarketMeta, setStockMarketMeta] = useState(null);
  const [fetchingStockMeta, setFetchingStockMeta] = useState(false);

  // Toast Notification State
  const [toasts, setToasts] = useState([]);
  const showToast = (message, type = 'success', duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };

  // Screenshots state
  const [pendingScreenshots, setPendingScreenshots] = useState([]);
  const [sessionScreenshots, setSessionScreenshots] = useState([]);
  const [activeLightboxImg, setActiveLightboxImg] = useState(null);

  // Popover Calendar State (Session View)
  const [showSessionCalendar, setShowSessionCalendar] = useState(false);
  const [sessionPopYear, setSessionPopYear] = useState(2026);
  const [sessionPopMonth, setSessionPopMonth] = useState(7);
  const sessionCalendarRef = useRef(null);

  // Popover Calendar State (Import View)
  const [showImportCalendar, setShowImportCalendar] = useState(false);
  const [importPopYear, setImportPopYear] = useState(2026);
  const [importPopMonth, setImportPopMonth] = useState(7);
  const importCalendarRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (sessionCalendarRef.current && !sessionCalendarRef.current.contains(event.target)) {
        setShowSessionCalendar(false);
      }
      if (importCalendarRef.current && !importCalendarRef.current.contains(event.target)) {
        setShowImportCalendar(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    async function init() {
      const saved = await loadSettingsFromBackend();
      await loadLogsFromBackend();
      if (isTauri) {
        checkForAutoUpdates(saved);
      }
    }
    init();
  }, []);

  async function loadSettingsFromBackend() {
    try {
      const saved = await safeInvoke("load_settings");
      if (saved) {
        setSettings(prev => ({ ...prev, ...saved }));
        return saved;
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
    return null;
  }

  async function triggerCloudSync(currentSettings = settings) {
    if (currentSettings.cloudProvider === 'gdrive' && currentSettings.gdriveSyncPath) {
      try {
        await safeInvoke("sync_local_directory", { targetDir: currentSettings.gdriveSyncPath });
      } catch (e) {
        console.error("Local Google Drive directory sync failed:", e);
      }
    }

    if (currentSettings.cloudProvider === 'r2' && currentSettings.r2BackupUrl) {
      try {
        const backupData = {
          logs,
          journal: {},
          settings: currentSettings,
          timestamp: new Date().toISOString()
        };
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("trading_journal_")) {
            backupData.journal[key] = localStorage.getItem(key);
          }
        }
        await fetch(currentSettings.r2BackupUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(backupData)
        });
      } catch (e) {
        console.error("R2 backup upload failed:", e);
      }
    }

    if (currentSettings.cloudProvider === 'gdrive_api' && currentSettings.gdriveAccessToken && currentSettings.gdriveFolderId) {
      try {
        const backupData = {
          logs,
          settings: currentSettings,
          timestamp: new Date().toISOString()
        };
        const metadata = {
          name: 'hammer_pro_journal_backup.json',
          mimeType: 'application/json',
          parents: [currentSettings.gdriveFolderId]
        };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([JSON.stringify(backupData)], { type: 'application/json' }));

        await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${currentSettings.gdriveAccessToken}`
          },
          body: form
        });
      } catch (e) {
        console.error("Google Drive API backup failed:", e);
      }
    }
  }

  async function handleSaveSettings(newSettings) {
    try {
      setSettings(newSettings);
      await safeInvoke("save_settings", { settings: newSettings });
      await triggerCloudSync(newSettings);
      showToast("Settings saved and synced successfully!", "success");
    } catch (e) {
      showToast(`Error saving settings: ${e}`, "error");
    }
  }

  async function checkForAutoUpdates(currentSettings) {
    try {
      const update = await checkTauriUpdate();
      if (update && update.available) {
        const isSilent = currentSettings ? currentSettings.silentUpdates : settings.silentUpdates;
        if (!isSilent) {
          showToast(`Downloading update v${update.version} in background...`, "info");
        }
        await update.downloadAndInstall();
        if (!isSilent) {
          showToast("Update downloaded! Will apply automatically when you restart.", "success");
        }
      }
    } catch (e) {
      console.log("No update available or web environment:", e);
    }
  }


  useEffect(() => {
    if (sessionDate) {
      loadSessionScreenshots(sessionDate);
      loadSessionJournal(sessionDate);
      setEditingSessionLog(logs[sessionDate] || '');
    }
  }, [sessionDate, logs]);

  async function loadSessionScreenshots(date) {
    try {
      const imgs = await safeInvoke("load_session_screenshots", { date });
      setSessionScreenshots(imgs || []);
    } catch (e) {
      console.error("Failed to load session screenshots:", e);
    }
  }

  async function loadSessionJournal(date) {

    try {
      const notes = await safeInvoke("load_journal", { date });
      setJournalNotes(notes || '');
    } catch (e) {
      console.error("Failed to load journal:", e);
    }
  }

  async function handleSaveJournalNotes() {
    if (!sessionDate) return;
    try {
      await safeInvoke("save_journal", { date: sessionDate, content: journalNotes });
      showToast(`Session journal saved for ${sessionDate}!`, "success");
      await triggerCloudSync();
    } catch (e) {
      showToast(`Error saving journal: ${e}`, "error");
    }
  }


  async function loadLogsFromBackend() {
    try {
      const loaded = await safeInvoke("load_all_logs");
      const loadedLogs = loaded || {};
      setLogs(loadedLogs);
      
      const dates = Object.keys(loadedLogs).sort();
      if (dates.length > 0) {
        const latestDate = dates[dates.length - 1];
        setSessionDate(latestDate);
        setSelectedDate(latestDate);
        setEditingSessionLog(loadedLogs[latestDate] || '');
        const [y, m] = latestDate.split('-').map(Number);
        if (y && m) {
          setSessionPopYear(y);
          setSessionPopMonth(m - 1);
          setImportPopYear(y);
          setImportPopMonth(m - 1);
        }
      } else {
        const today = new Date().toISOString().split('T')[0];
        setSessionDate(today);
        setSelectedDate(today);
      }
    } catch (e) {
      console.error("Failed to load logs:", e);
    } finally {
      setLoading(false);
    }
  }

  const handlePasteChange = (e) => {
    const text = e.target.value;
    setPastedText(text);
    const m = text.match(/(\d{2})[/.\-](\d{2})[/.\-](\d{2,4})/);
    if (m) {
      let [_, p1, p2, p3] = m;
      if (p3.length === 2) p3 = "20" + p3;
      let formattedDate = `${p3}-${p1.padStart(2, '0')}-${p2.padStart(2, '0')}`;
      if (settings.dateFormat === 'DD-MM-YY') {
        formattedDate = `${p3}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`;
      }
      setSelectedDate(formattedDate);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setPendingScreenshots(prev => [
          ...prev,
          { name: file.name, dataUrl: uploadEvent.target.result }
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleInlineScreenshotSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0 || !sessionDate) return;

    let completed = 0;
    files.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = async (uploadEvent) => {
        const filename = `img_${sessionScreenshots.length + idx + 1}_${Date.now()}.png`;
        await safeInvoke("save_screenshot", {
          date: sessionDate,
          filename,
          dataUrl: uploadEvent.target.result
        });
        completed++;
        if (completed === files.length) {
          loadSessionScreenshots(sessionDate);
          showToast(`Attached ${files.length} screenshot(s) to ${sessionDate}`, "success");
          await triggerCloudSync();
        }
      };
      reader.readAsDataURL(file);
    });
  };


  const handleRemovePendingScreenshot = (index) => {
    setPendingScreenshots(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveLog = async () => {
    if (!pastedText.trim()) {
      showToast("Please paste some log content first.", "error");
      return;
    }
    try {
      await safeInvoke("save_log", { date: selectedDate, content: pastedText });
      
      for (let i = 0; i < pendingScreenshots.length; i++) {
        const filename = `img_${i + 1}_${Date.now()}.png`;
        await safeInvoke("save_screenshot", {
          date: selectedDate,
          filename,
          dataUrl: pendingScreenshots[i].dataUrl
        });
      }

      setLogs(prev => ({
        ...prev,
        [selectedDate]: pastedText
      }));
      
      setPastedText('');
      setPendingScreenshots([]);
      setSessionDate(selectedDate);
      setCurrentView('singleSession');
      showToast(`Session log and ${pendingScreenshots.length} screenshot(s) saved for ${selectedDate}`, "success");
      await triggerCloudSync();
    } catch (e) {
      showToast(`Error saving log: ${e}`, "error");
    }
  };


  const handleSaveEditedSessionLog = async () => {
    if (!sessionDate) return;
    try {
      await safeInvoke("save_log", { date: sessionDate, content: editingSessionLog });
      setLogs(prev => ({
        ...prev,
        [sessionDate]: editingSessionLog
      }));
      showToast(`Log content for ${sessionDate} updated & re-parsed!`, "success");
      await triggerCloudSync();
    } catch (e) {
      showToast(`Error updating log: ${e}`, "error");
    }
  };


  const handleDeleteLog = async (date) => {
    try {
      await safeInvoke("delete_log", { date });
      setLogs(prev => {
        const next = { ...prev };
        delete next[date];
        return next;
      });
      const dates = Object.keys(logs).filter(d => d !== date).sort();
      if (dates.length > 0) {
        setSessionDate(dates[dates.length - 1]);
      }
      showToast(`Deleted logs and screenshots for ${date}`, "info");
    } catch (e) {
      showToast(`Error deleting log: ${e}`, "error");
    }
  };

  const handleDeleteSessionScreenshot = async (filename) => {
    try {
      await safeInvoke("delete_screenshot", { filename });
      loadSessionScreenshots(sessionDate);
      showToast("Screenshot deleted", "info");
    } catch (e) {
      showToast(`Error deleting screenshot: ${e}`, "error");
    }
  };

  const handleCopyRawLog = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast("Raw log copied to clipboard!", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportBackup = () => {
    const backupData = {
      logs,
      settings,
      screenshots: {},
      journals: {}
    };
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("trading_img_")) {
        backupData.screenshots[key] = localStorage.getItem(key);
      } else if (key && key.startsWith("trading_journal_")) {
        backupData.journals[key] = localStorage.getItem(key);
      }
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `HammerProJournal_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("Full journal backup exported successfully!", "success");
  };

  const handleImportBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.logs) {
          Object.keys(parsed.logs).forEach(date => {
            localStorage.setItem(`trading_log_${date}`, parsed.logs[date]);
          });
        }
        if (parsed.settings) {
          localStorage.setItem("trading_settings", JSON.stringify(parsed.settings));
          setSettings(parsed.settings);
        }
        if (parsed.screenshots) {
          Object.keys(parsed.screenshots).forEach(k => {
            localStorage.setItem(k, parsed.screenshots[k]);
          });
        }
        if (parsed.journals) {
          Object.keys(parsed.journals).forEach(k => {
            localStorage.setItem(k, parsed.journals[k]);
          });
        }
        loadLogsFromBackend();
        showToast("Backup restored successfully!", "success");
      } catch (err) {
        showToast("Failed to restore backup: Invalid JSON", "error");
      }
    };
    reader.readAsText(file);
  };

  const toggleStockFillDrawer = (symbol) => {
    setExpandedStockFills(prev => ({
      ...prev,
      [symbol]: !prev[symbol]
    }));
  };

  // Global Analytics compilation
  const { allExecutions, allTrades, dailyStatsMap, overallAnalytics, globalECNAnalytics, hourlyAnalytics, availableMonths } = useMemo(() => {

    let executions = [];
    const statsMap = {};
    const monthsSet = new Set();
    
    Object.keys(logs).forEach(date => {
      const dayExecs = extractExecutions(logs[date], date, settings.dateFormat);
      executions = executions.concat(dayExecs);
      const stats = compileDailyStats(dayExecs, settings.feePerShare, settings.enableFees);
      if (stats) {
        statsMap[date] = stats;
        const [y, m] = date.split('-');
        if (y && m) monthsSet.add(`${y}-${m}`);
      }
    });
    
    const trades = matchTradesFIFO(executions);
    const analytics = compileOverallAnalytics(trades, statsMap, settings.feePerShare, settings.enableFees);
    const ecnAnalytics = compileECNAnalytics(executions);
    const hourlyStats = compileHourlyAnalytics(executions, settings.feePerShare, settings.enableFees);
    
    return {
      allExecutions: executions,
      allTrades: trades,
      dailyStatsMap: statsMap,
      overallAnalytics: analytics,
      globalECNAnalytics: ecnAnalytics,
      hourlyAnalytics: hourlyStats,
      availableMonths: Array.from(monthsSet).sort().reverse()
    };
  }, [logs, settings.dateFormat, settings.feePerShare, settings.enableFees]);

  // Dashboard Month Horizon Filtered Analytics
  const filteredDashboardAnalytics = useMemo(() => {
    if (dashboardMonthFilter === 'ALL') return overallAnalytics;

    const filteredMap = {};
    Object.keys(dailyStatsMap).forEach(d => {
      if (d.startsWith(dashboardMonthFilter)) {
        filteredMap[d] = dailyStatsMap[d];
      }
    });

    const monthExecs = [];
    Object.keys(logs).forEach(d => {
      if (d.startsWith(dashboardMonthFilter)) {
        monthExecs.push(...extractExecutions(logs[d], d, settings.dateFormat));
      }
    });

    const monthTrades = matchTradesFIFO(monthExecs);
    return compileOverallAnalytics(monthTrades, filteredMap, settings.feePerShare, settings.enableFees);
  }, [dashboardMonthFilter, overallAnalytics, dailyStatsMap, logs, settings.dateFormat, settings.feePerShare, settings.enableFees]);

  const singleSessionAnalytics = useMemo(() => {
    if (!sessionDate || !logs[sessionDate]) return null;
    const dayExecs = extractExecutions(logs[sessionDate], sessionDate, settings.dateFormat);
    const dayAnalytics = compileSingleDayAnalytics(dayExecs, settings.feePerShare, settings.enableFees);
    if (dayAnalytics) {
      dayAnalytics.hourlyBreakdown = compileHourlyAnalytics(dayExecs, settings.feePerShare, settings.enableFees);
    }
    return dayAnalytics;
  }, [sessionDate, logs, settings.dateFormat, settings.feePerShare, settings.enableFees]);




  // Stock Market Metadata Fetcher effect for Advanced Stock Analysis view
  useEffect(() => {
    if (currentView === 'stockAnalysis') {
      if (!selectedStockTicker && overallAnalytics.tickerStats.length > 0) {
        const topSym = overallAnalytics.tickerStats[0].symbol;
        setSelectedStockTicker(topSym);
      }
    }
  }, [currentView, overallAnalytics]);

  useEffect(() => {
    if (selectedStockTicker) {
      setFetchingStockMeta(true);
      fetchStockMarketData(selectedStockTicker).then(data => {
        setStockMarketMeta(data);
        setFetchingStockMeta(false);
      }).catch(() => {
        setFetchingStockMeta(false);
      });
    }
  }, [selectedStockTicker]);

  // Trader's personal stock performance breakdown for selectedStockTicker
  const selectedStockPersonalHistory = useMemo(() => {
    if (!selectedStockTicker) return { totalPnl: 0, netPnl: 0, winRate: 0, totalShares: 0, tradesCount: 0, sessions: [] };

    const sessions = [];
    let totalPnl = 0;
    let totalNetPnl = 0;
    let totalShares = 0;
    let totalTrades = 0;
    let wins = 0;

    Object.keys(logs).sort().reverse().forEach(date => {
      const dayExecs = extractExecutions(logs[date], date, settings.dateFormat);
      const dayStats = compileSingleDayAnalytics(dayExecs, settings.feePerShare, settings.enableFees);
      if (dayStats && dayStats.stockBreakdown) {
        const item = dayStats.stockBreakdown.find(s => s.symbol === selectedStockTicker);
        if (item) {
          totalPnl += item.pnl;
          totalNetPnl += item.netPnl;
          totalShares += item.totalQty;
          totalTrades += item.tradesCount;

          const winsInSession = item.matchedTrades ? item.matchedTrades.filter(t => t.pnl > 0).length : 0;
          wins += winsInSession;

          const buys = item.executions.filter(e => e.action === 'Bought');
          const sells = item.executions.filter(e => e.action === 'Sold');

          const avgBuyPrice = buys.length > 0 ? (buys.reduce((a, b) => a + b.execPrice * b.execQty, 0) / (buys.reduce((a, b) => a + b.execQty, 0) || 1)) : 0;
          const avgSellPrice = sells.length > 0 ? (sells.reduce((a, b) => a + b.execPrice * b.execQty, 0) / (sells.reduce((a, b) => a + b.execQty, 0) || 1)) : 0;

          sessions.push({
            date,
            pnl: item.pnl,
            netPnl: item.netPnl,
            tradesCount: item.tradesCount,
            totalQty: item.totalQty,
            avgHoldTime: item.avgHoldTime,
            avgBuyPrice,
            avgSellPrice,
            executions: item.executions
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
  }, [selectedStockTicker, logs, settings.dateFormat, settings.feePerShare, settings.enableFees]);

  const handleNextMonth = () => {
    if (availableMonths.length === 0) return;
    if (dashboardMonthFilter === 'ALL') {
      setDashboardMonthFilter(availableMonths[availableMonths.length - 1]);
      return;
    }
    const idx = availableMonths.indexOf(dashboardMonthFilter);
    if (idx > 0) {
      setDashboardMonthFilter(availableMonths[idx - 1]);
    }
  };

  const handlePrevMonth = () => {
    if (availableMonths.length === 0) return;
    if (dashboardMonthFilter === 'ALL') {
      setDashboardMonthFilter(availableMonths[0]);
      return;
    }
    const idx = availableMonths.indexOf(dashboardMonthFilter);
    if (idx < availableMonths.length - 1) {
      setDashboardMonthFilter(availableMonths[idx + 1]);
    }
  };

  const formatHoldTime = (secs) => {
    if (!secs || secs < 0) return '0s';
    if (secs < 60) return `${Math.round(secs)}s`;
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}m ${s}s`;
  };

  const smoothEquityChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    tension: 0.4,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        titleFont: { size: 12, weight: 'bold' },
        bodyFont: { size: 13 },
        padding: 10,
        displayColors: false,
        callbacks: {
          label: (ctx) => `Cumulative P&L: $${Number(ctx.parsed.y).toFixed(2)}`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#9ca3af', font: { size: 11 } }
      },
      y: {
        grid: { color: '#f3f4f6' },
        ticks: {
          color: '#9ca3af',
          font: { size: 11 },
          callback: (value) => `$${Number(value).toFixed(2)}`
        }
      }
    }
  };

  const smoothIntradayChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    tension: 0.35,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        titleFont: { size: 12, weight: 'bold' },
        bodyFont: { size: 12 },
        padding: 12,
        displayColors: false,
        callbacks: {
          label: (ctx) => {
            const raw = ctx.raw;
            if (!raw || raw.symbol === 'OPEN') return 'Trading Session Opened';
            return [
              `Trade P&L: ${raw.tradePnl >= 0 ? '+' : ''}$${Number(raw.tradePnl).toFixed(2)}`,
              `Cumulative Realized: $${Number(raw.execPnl).toFixed(2)}`,
              `Symbol: ${raw.symbol} (${raw.side === 'B' ? 'Long' : 'Short'})`,
              `Execution: ${raw.qty} shs @ $${Number(raw.exitPrice).toFixed(2)} (Entry: $${Number(raw.entryPrice).toFixed(2)})`,
              `Routes: ${raw.entryRoute} ➔ ${raw.exitRoute}`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#9ca3af', font: { size: 11 }, maxTicksLimit: 10 }
      },
      y: {
        grid: { color: '#f3f4f6' },
        ticks: {
          color: '#9ca3af',
          font: { size: 11 },
          callback: (value) => `$${Number(value).toFixed(2)}`
        }
      }
    }
  };

  const cumulativeEquityChartData = useMemo(() => {
    if (!filteredDashboardAnalytics || !filteredDashboardAnalytics.equityCurve || filteredDashboardAnalytics.equityCurve.length === 0) return null;
    const labels = filteredDashboardAnalytics.equityCurve.map(point => point.date);
    const data = filteredDashboardAnalytics.equityCurve.map(point => settings.enableFees ? point.cumulativeNetPnl : point.cumulativePnl);
    
    return {
      labels,
      datasets: [
        {
          label: 'Cumulative P&L',
          data,
          borderColor: '#064e3b',
          borderWidth: 2.5,
          pointBackgroundColor: '#064e3b',
          pointRadius: 1,
          pointHoverRadius: 4,
          fill: true,
          backgroundColor: (context) => {
            const chart = context.chart;
            const { ctx, chartArea, scales } = chart;
            if (!chartArea) return 'rgba(16, 185, 129, 0.12)';
            
            const yZero = scales.y ? scales.y.getPixelForValue(0) : chartArea.bottom;
            const top = chartArea.top;
            const bottom = chartArea.bottom;
            const height = bottom - top;
            const zeroRatio = Math.max(0, Math.min(1, (yZero - top) / (height || 1)));

            const gradient = ctx.createLinearGradient(0, top, 0, bottom);
            gradient.addColorStop(0, 'rgba(16, 185, 129, 0.18)');
            gradient.addColorStop(zeroRatio, 'rgba(16, 185, 129, 0.02)');
            gradient.addColorStop(Math.min(1, zeroRatio + 0.01), 'rgba(244, 63, 94, 0.02)');
            gradient.addColorStop(1, 'rgba(244, 63, 94, 0.18)');
            return gradient;
          }
        }
      ]
    };
  }, [filteredDashboardAnalytics, settings.enableFees]);

  const singleSessionChartData = useMemo(() => {
    if (!singleSessionAnalytics || !singleSessionAnalytics.intradayEquityCurve) return null;
    const curve = singleSessionAnalytics.intradayEquityCurve;
    const labels = curve.map(c => c.timeLabel);
    const dataPoints = curve.map(c => ({
      x: c.timeLabel,
      y: c.execPnl,
      tradePnl: c.tradePnl,
      execPnl: c.execPnl,
      symbol: c.symbol,
      side: c.side,
      qty: c.qty,
      entryPrice: c.entryPrice,
      exitPrice: c.exitPrice,
      entryRoute: c.entryRoute,
      exitRoute: c.exitRoute
    }));

    return {
      labels,
      datasets: [
        {
          label: 'Session Intraday P&L',
          data: dataPoints,
          borderColor: '#064e3b',
          borderWidth: 2.5,
          pointBackgroundColor: (ctx) => {
            const raw = ctx.raw;
            if (!raw) return '#064e3b';
            if (raw.symbol === 'OPEN') return '#9ca3af';
            return raw.tradePnl >= 0 ? '#10b981' : '#f43f5e';
          },
          pointRadius: 1,
          pointHoverRadius: 4,
          fill: true,
          backgroundColor: (context) => {
            const chart = context.chart;
            const { ctx, chartArea, scales } = chart;
            if (!chartArea) return 'rgba(16, 185, 129, 0.12)';
            
            const yZero = scales.y ? scales.y.getPixelForValue(0) : chartArea.bottom;
            const top = chartArea.top;
            const bottom = chartArea.bottom;
            const height = bottom - top;
            const zeroRatio = Math.max(0, Math.min(1, (yZero - top) / (height || 1)));

            const gradient = ctx.createLinearGradient(0, top, 0, bottom);
            gradient.addColorStop(0, 'rgba(16, 185, 129, 0.15)');
            gradient.addColorStop(zeroRatio, 'rgba(16, 185, 129, 0.02)');
            gradient.addColorStop(Math.min(1, zeroRatio + 0.01), 'rgba(244, 63, 94, 0.02)');
            gradient.addColorStop(1, 'rgba(244, 63, 94, 0.15)');
            return gradient;
          }
        }
      ]
    };
  }, [singleSessionAnalytics]);

  const heatmapData = useMemo(() => {
    const months = [];
    const year = 2026;
    for (let m = 0; m < 12; m++) {
      const monthDays = new Date(year, m + 1, 0).getDate();
      const startDay = new Date(year, m, 1).getDay();
      const days = [];
      let hasTradingDataInMonth = false;

      for (let i = 0; i < startDay; i++) {
        days.push({ dayNum: null, dateStr: null });
      }
      for (let d = 1; d <= monthDays; d++) {
        const mmStr = (m + 1).toString().padStart(2, '0');
        const ddStr = d.toString().padStart(2, '0');
        const dateStr = `${year}-${mmStr}-${ddStr}`;
        if (dailyStatsMap[dateStr]) hasTradingDataInMonth = true;
        days.push({ dayNum: d, dateStr });
      }
      if (!heatmapActiveOnly || hasTradingDataInMonth) {
        months.push({ monthIndex: m, name: new Date(year, m).toLocaleString('default', { month: 'long' }), days, hasData: hasTradingDataInMonth });
      }
    }
    return months;
  }, [dailyStatsMap, heatmapActiveOnly]);

  const getHeatmapDayColor = (dateStr) => {
    if (!dateStr || !dailyStatsMap[dateStr]) return '#f3f4f6';
    const pnl = settings.enableFees ? dailyStatsMap[dateStr].netPnl : dailyStatsMap[dateStr].pnl;
    if (pnl > 300) return '#059669';
    if (pnl > 100) return '#10b981';
    if (pnl > 0) return '#a7f3d0';
    if (pnl < -300) return '#e11d48';
    if (pnl < -100) return '#f43f5e';
    if (pnl < 0) return '#ffe4e6';
    return '#e5e7eb';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', width: '100vw', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f5f7' }}>
        <h3 style={{ color: '#111827', fontStyle: 'italic' }}>Loading Hammer Pro Journal...</h3>
      </div>
    );
  }

  const sessionWinRate = singleSessionAnalytics && singleSessionAnalytics.totalOrders > 0
    ? ((singleSessionAnalytics.winningTrades / singleSessionAnalytics.totalOrders) * 100).toFixed(2)
    : '0.00';

  return (
    <div style={{ display: 'flex', width: '100%' }}>
      {/* Toast Notification Container */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast-item toast-${t.type}`}>
            {t.type === 'success' && <Check size={18} />}
            {t.type === 'error' && <X size={18} />}
            {t.type === 'info' && <Zap size={18} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Lightbox Modal Image Overlay */}
      {activeLightboxImg && (
        <div className="lightbox-modal" onClick={() => setActiveLightboxImg(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close-btn" onClick={() => setActiveLightboxImg(null)}>
              <X size={18} />
            </button>
            <img src={activeLightboxImg} alt="Enlarged Closing Screenshot" />
          </div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <div className="sidebar">
        <div className="sidebar-logo">
          <Zap size={24} />
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-title">HAMMER PRO JOURNAL</span>
            <span className="sidebar-logo-author">by Ajinkya</span>
          </div>
        </div>



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

      {/* Main Panel Content */}
      <div className="main-content">
        
        {/* Top Header Bar */}
        <div className="top-header">
          <div className="header-title">
            <h2>
              {currentView === 'singleSession' && 'Single Session Deep-Dive'}
              {currentView === 'dashboard' && 'Trading Dashboard'}
              {currentView === 'ecnAnalytics' && 'ECN & Darkpool Analytics'}
              {currentView === 'stockAnalysis' && 'Stock Performance & Financial Terminal'}
              {currentView === 'heatmap' && 'P&L Calendar Heatmap'}
              {currentView === 'pasteLogs' && 'Import Broker Logs'}
              {currentView === 'settings' && 'App Settings & Cloud Backup'}
            </h2>
            <p>
              {currentView === 'singleSession' && 'Intraday trade P&L curve, screenshots, Darkpool entries/exits, stock fills, and session journal'}
              {currentView === 'dashboard' && 'Accumulated performance, equity growth, fees calculation, and month-by-month horizon metrics'}
              {currentView === 'ecnAnalytics' && 'ECN vs. Darkpool liquidity analysis and venue breakdown'}
              {currentView === 'stockAnalysis' && 'Toggle between Simple Table View and Advanced Finviz Live Scraper Terminal with 80+ snapshot metrics'}
              {currentView === 'heatmap' && 'Calendar view of daily return density for 2026'}
              {currentView === 'pasteLogs' && 'Paste raw broker execution logs and save session files directly on disk'}
              {currentView === 'settings' && 'Configure fee rates, date formats, journal options, and cloud backup integration'}
            </p>
          </div>

          <div className="header-actions">
            <button className="btn" onClick={() => setCurrentView('pasteLogs')}>
              <Plus size={16} /> Import Session
            </button>
          </div>
        </div>

        {/* VIEW: SINGLE SESSION DEEP-DIVE */}
        {currentView === 'singleSession' && (
          <div>
            {/* Interactive Popover Calendar Date Selector */}
            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="calendar-picker-wrapper" ref={sessionCalendarRef}>
                <button className="calendar-trigger-btn" onClick={() => setShowSessionCalendar(!showSessionCalendar)}>
                  <CalendarDays size={18} color="var(--hero-green)" />
                  <span>Session Date: {sessionDate || 'Select Session'}</span>
                </button>

                {showSessionCalendar && (
                  <div className="calendar-popover">
                    <div className="calendar-popover-header">
                      <button className="calendar-nav-btn" onClick={() => {
                        if (sessionPopMonth === 0) { setSessionPopMonth(11); setSessionPopYear(sessionPopYear - 1); }
                        else { setSessionPopMonth(sessionPopMonth - 1); }
                      }}><ChevronLeft size={18} /></button>
                      <span>{monthNames[sessionPopMonth]} {sessionPopYear}</span>
                      <button className="calendar-nav-btn" onClick={() => {
                        if (sessionPopMonth === 11) { setSessionPopMonth(0); setSessionPopYear(sessionPopYear + 1); }
                        else { setSessionPopMonth(sessionPopMonth + 1); }
                      }}><ChevronRight size={18} /></button>
                    </div>

                    <div className="popover-grid">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((wd, idx) => (
                        <div key={idx} className="popover-weekday">{wd}</div>
                      ))}
                      {getCalendarPopoverGrid(sessionPopYear, sessionPopMonth).map((day, dIdx) => {
                        const hasSession = day.dateStr && dailyStatsMap[day.dateStr];
                        const isProfitable = hasSession && dailyStatsMap[day.dateStr].pnl >= 0;
                        const isSelected = day.dateStr === sessionDate;

                        return (
                          <div
                            key={dIdx}
                            className={`popover-day-cell ${day.dayNum === null ? 'empty' : ''} ${isSelected ? 'selected' : ''}`}
                            onClick={() => {
                              if (day.dateStr) {
                                setSessionDate(day.dateStr);
                                setShowSessionCalendar(false);
                              }
                            }}
                          >
                            {day.dayNum}
                            {hasSession && (
                              <span className={`session-dot ${isProfitable ? 'dot-profit' : 'dot-loss'}`} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>



            {singleSessionAnalytics ? (
              <div>
                {/* Active Open Positions Warning Box */}
                {singleSessionAnalytics.openPositionsSummary && singleSessionAnalytics.openPositionsSummary.length > 0 && (
                  <div style={{
                    backgroundColor: '#fffbe6',
                    border: '1px solid #ffe58f',
                    borderRadius: '0.75rem',
                    padding: '0.85rem 1.25rem',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem'
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#d48806', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Zap size={18} /> Active Unclosed Position(s) Detected (Missing Exit Fill)
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#8c6b00', marginTop: '0.25rem' }}>
                        {singleSessionAnalytics.openPositionsSummary.map(op => (
                          <span key={op.symbol} style={{ marginRight: '1rem', fontWeight: 600 }}>
                            • {op.symbol}: {op.qty} shs {op.side === 'B' ? 'Long' : 'Short'} @ ${op.avgPrice.toFixed(2)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button 
                      className="btn" 
                      style={{ backgroundColor: '#faad14', borderColor: '#d48806', color: '#ffffff', fontSize: '0.78rem', padding: '0.4rem 0.8rem', whiteSpace: 'nowrap' }}
                      onClick={() => setSessionTab('raw')}
                    >
                      <Edit3 size={14} /> Edit Log to Add Exit
                    </button>
                  </div>
                )}

                {/* Session Sleek KPI Cards Row */}
                <div className="grid-cards">
                  {/* Card 1: Realized P&L */}
                  <div className="card card-hero">
                    <div className="card-top">
                      <span className="card-title">
                        {settings.enableFees ? 'Net Session P&L' : 'Session Realized P&L'}
                      </span>
                      <button className="card-icon-btn"><ArrowUpRight size={16} /></button>
                    </div>
                    <div className="card-value">
                      {(settings.enableFees ? singleSessionAnalytics.netPnl : singleSessionAnalytics.pnl) >= 0 ? '+' : ''}
                      ${(settings.enableFees ? singleSessionAnalytics.netPnl : singleSessionAnalytics.pnl).toFixed(2)}
                    </div>
                    <span className="card-footer-tag tag-profit">
                      {settings.enableFees ? `Gross: $${singleSessionAnalytics.grossPnl.toFixed(2)} • Fees: $${singleSessionAnalytics.fees.toFixed(2)}` : `${singleSessionAnalytics.consolidatedTrades.length} Trades Closed`}
                    </span>
                  </div>

                  {/* Card 2: Win Rate */}
                  <div className="card">
                    <div className="card-top">
                      <span className="card-title">Win Rate</span>
                      <button className="card-icon-btn"><Percent size={16} /></button>
                    </div>
                    <div className="card-value">
                      {sessionWinRate}%
                    </div>
                    <span className="card-footer-tag tag-profit">
                      {singleSessionAnalytics.winningTrades} Win / {singleSessionAnalytics.losingTrades} Loss
                    </span>
                  </div>

                  {/* Card 3: Trades & Fills */}
                  <div className="card">
                    <div className="card-top">
                      <span className="card-title">Trades & Fills</span>
                      <button className="card-icon-btn"><FileText size={16} /></button>
                    </div>
                    <div className="card-value">
                      {singleSessionAnalytics.consolidatedTrades.length} Trades
                    </div>
                    <span className="card-footer-tag" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
                      {singleSessionAnalytics.totalFills} Fills ({singleSessionAnalytics.roundTripShares} Shs)
                    </span>
                  </div>

                  {/* Card 4: Avg Hold Time */}
                  <div className="card">
                    <div className="card-top">
                      <span className="card-title">Avg Hold Duration</span>
                      <button className="card-icon-btn"><Clock size={16} /></button>
                    </div>
                    <div className="card-value">
                      {formatHoldTime(singleSessionAnalytics.stockBreakdown.length > 0 ? (singleSessionAnalytics.stockBreakdown.reduce((acc, s) => acc + s.avgHoldTime, 0) / (singleSessionAnalytics.stockBreakdown.length || 1)) : 0)}
                    </div>
                    <span className="card-footer-tag" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
                      {singleSessionAnalytics.totalBoughtQty} Shs Bought / {singleSessionAnalytics.totalSoldQty} Sold
                    </span>
                  </div>
                </div>

                {/* Intraday Realized Cumulative Equity Curve */}
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                  <div className="card-top">
                    <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                      Intraday Realized Equity Curve ({sessionDate})
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Realized cumulative growth trade by trade</span>
                  </div>
                  <div className="chart-container">
                    {singleSessionChartData && <Line data={singleSessionChartData} options={smoothIntradayChartOptions} />}
                  </div>
                </div>

                {/* Attached Screenshots Section */}
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                  <div className="card-top">
                    <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                      Session Attached Screenshots ({sessionScreenshots.length})
                    </span>
                    <label className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', cursor: 'pointer' }}>
                      <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleInlineScreenshotSelect} />
                      <Plus size={14} /> Add Screenshot
                    </label>
                  </div>
                  {sessionScreenshots.length > 0 ? (
                    <div className="screenshot-grid">
                      {sessionScreenshots.map((img, idx) => (
                        <div key={idx} className="screenshot-card" onClick={() => setActiveLightboxImg(img.dataUrl)}>
                          <img src={img.dataUrl} alt={`Session Screenshot ${idx + 1}`} />
                          <button className="delete-btn" onClick={(e) => { e.stopPropagation(); handleDeleteSessionScreenshot(img.filename); }}>
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                      No closing screenshots attached for this session yet. Click "+ Add Screenshot" to upload.
                    </div>
                  )}
                </div>

                {/* Sub-tab Navigation Bar */}
                <div className="tab-bar">
                  <button 
                    className={`tab-btn ${sessionTab === 'stocks' ? 'active' : ''}`}
                    onClick={() => setSessionTab('stocks')}
                  >
                    <BarChart3 size={15} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Per-Stock Performance
                  </button>
                  {settings.enableJournal && (
                    <button 
                      className={`tab-btn ${sessionTab === 'journal' ? 'active' : ''}`}
                      onClick={() => setSessionTab('journal')}
                    >
                      <BookOpen size={15} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Session Journal
                    </button>
                  )}
                  <button 
                    className={`tab-btn ${sessionTab === 'ecn' ? 'active' : ''}`}
                    onClick={() => setSessionTab('ecn')}
                  >
                    <Layers size={15} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> ECN & Route Breakdown
                  </button>
                  <button 
                    className={`tab-btn ${sessionTab === 'raw' ? 'active' : ''}`}
                    onClick={() => setSessionTab('raw')}
                  >
                    <Edit3 size={15} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Raw Log & Quick Editor
                  </button>
                </div>

                {/* TAB 1: PER-STOCK BREAKDOWN WITH EXPANDABLE SHOW FILLS */}
                {sessionTab === 'stocks' && (
                  <div className="card">
                    <div className="card-top">
                      <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                        Per-Stock Performance & Fills Breakdown ({sessionDate})
                      </span>
                    </div>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Symbol</th>
                            <th>Realized P&L</th>
                            {settings.enableFees && <th>Net P&L</th>}
                            <th>Trades</th>
                            <th>Total Shares</th>
                            <th>Avg Hold</th>
                            <th>Darkpool vs ECN</th>
                            <th>Fills Detail</th>
                          </tr>
                        </thead>
                        <tbody>
                          {singleSessionAnalytics.stockBreakdown.map((stock) => {
                            const isExpanded = expandedStockFills[stock.symbol];
                            return (
                              <React.Fragment key={stock.symbol}>
                                <tr>
                                  <td style={{ fontWeight: 800 }}>{stock.symbol}</td>
                                  <td style={{ fontWeight: 800, color: stock.pnl >= 0 ? 'var(--hero-green)' : 'var(--rose-text)' }}>
                                    {stock.pnl >= 0 ? '+' : ''}${stock.pnl.toFixed(2)}
                                  </td>
                                  {settings.enableFees && (
                                    <td style={{ fontWeight: 700, color: stock.netPnl >= 0 ? 'var(--hero-green)' : 'var(--rose-text)' }}>
                                      {stock.netPnl >= 0 ? '+' : ''}${stock.netPnl.toFixed(2)}
                                    </td>
                                  )}
                                  <td>{stock.tradesCount}</td>
                                  <td>{stock.totalQty}</td>
                                  <td>{formatHoldTime(stock.avgHoldTime)}</td>
                                  <td>
                                    <span style={{ color: 'var(--purple-text)', fontWeight: 700 }}>{stock.darkpoolVolume} dp</span>
                                    <span style={{ color: 'var(--text-light)', margin: '0 4px' }}>/</span>
                                    <span style={{ color: 'var(--blue-text)', fontWeight: 600 }}>{stock.litVolume} ecn</span>
                                  </td>
                                  <td>
                                    <button 
                                      className="btn btn-secondary" 
                                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                                      onClick={() => toggleStockFillDrawer(stock.symbol)}
                                    >
                                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                      {isExpanded ? 'Hide Fills' : `Show Fills (${stock.executions.length})`}
                                    </button>
                                  </td>
                                </tr>

                                {isExpanded && (
                                  <tr className="fill-drawer-row">
                                    <td colSpan={settings.enableFees ? 8 : 7}>
                                      <div style={{ padding: '0.5rem 0' }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                                          Matched Execution Fills for {stock.symbol}:
                                        </div>
                                        <table className="nested-fills-table">
                                          <thead>
                                            <tr>
                                              <th>Timestamp</th>
                                              <th>Action</th>
                                              <th>Shares</th>
                                              <th>Exec Price</th>
                                              <th>Route</th>
                                              <th>Order Description</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {stock.executions.map((e, idx) => (
                                              <tr key={idx}>
                                                <td>{e.timestamp}</td>
                                                <td style={{ fontWeight: 700, color: e.action === 'Bought' ? 'var(--hero-green)' : 'var(--rose-text)' }}>
                                                  {e.action}
                                                </td>
                                                <td>{e.execQty} shs</td>
                                                <td>${e.execPrice.toFixed(2)}</td>
                                                <td>
                                                  <span className={`badge ${isDarkpool(e.route) ? 'badge-darkpool' : 'badge-route'}`}>
                                                    {e.route}
                                                  </span>
                                                </td>
                                                <td style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{e.orderDesc || '-'}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TAB 2: SESSION JOURNAL */}
                {sessionTab === 'journal' && settings.enableJournal && (
                  <div>
                    <div className="journal-highlight-grid">
                      <div className="journal-card journal-card-best">
                        <div style={{ fontWeight: 800, color: 'var(--emerald)', fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Award size={18} /> Best Trade(s) of Session
                        </div>
                        {singleSessionAnalytics.bestTrades.length > 0 ? (
                          singleSessionAnalytics.bestTrades.map((t, idx) => (
                            <div key={idx} style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                              <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>{t.symbol}</span> ({t.side === 'B' ? 'Long' : 'Short'}) — {t.qty} shs @ ${t.entryPrice.toFixed(2)} ➔ ${t.exitPrice.toFixed(2)}
                              <span style={{ fontWeight: 800, color: 'var(--hero-green)', marginLeft: '0.5rem' }}>
                                +${t.pnl.toFixed(2)}
                              </span>
                            </div>
                          ))
                        ) : <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No winning trades recorded.</div>}
                      </div>

                      <div className="journal-card journal-card-worst">
                        <div style={{ fontWeight: 800, color: 'var(--rose-text)', fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <AlertTriangle size={18} /> Worst Trade(s) of Session
                        </div>
                        {singleSessionAnalytics.worstTrades.length > 0 ? (
                          singleSessionAnalytics.worstTrades.map((t, idx) => (
                            <div key={idx} style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                              <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>{t.symbol}</span> ({t.side === 'B' ? 'Long' : 'Short'}) — {t.qty} shs @ ${t.entryPrice.toFixed(2)} ➔ ${t.exitPrice.toFixed(2)}
                              <span style={{ fontWeight: 800, color: 'var(--rose-text)', marginLeft: '0.5rem' }}>
                                -${Math.abs(t.pnl).toFixed(2)}
                              </span>
                            </div>
                          ))
                        ) : <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No losing trades recorded.</div>}
                      </div>
                    </div>

                    <div className="card">
                      <div className="card-top" style={{ marginBottom: '0.75rem' }}>
                        <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                          Session Notes & Market Reflections ({sessionDate})
                        </span>
                      </div>
                      <textarea
                        value={journalNotes}
                        onChange={(e) => setJournalNotes(e.target.value)}
                        placeholder="Write down your session reflections, strategy execution notes, market conditions, or trader mindset lessons here..."
                        style={{ minHeight: '180px' }}
                      ></textarea>
                      <div style={{ marginTop: '0.75rem' }}>
                        <button className="btn" onClick={handleSaveJournalNotes}>
                          <Save size={16} /> Save Session Journal
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: ECN & ROUTE BREAKDOWN */}
                {sessionTab === 'ecn' && (
                  <div className="card">
                    <div className="card-top">
                      <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                        Session ECN Route & Darkpool Execution Fills ({sessionDate})
                      </span>
                    </div>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Route Venue</th>
                            <th>Type</th>
                            <th>Executed Volume</th>
                            <th>Fills Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {singleSessionAnalytics.ecnBreakdown.map((r) => (
                            <tr key={r.route}>
                              <td style={{ fontWeight: 800 }}>{r.route}</td>
                              <td>
                                <span className={`badge ${r.isDarkpool ? 'badge-darkpool' : 'badge-route'}`}>
                                  {r.isDarkpool ? 'Darkpool' : 'ECN'}
                                </span>
                              </td>
                              <td style={{ fontWeight: 700 }}>{r.volume} shares</td>
                              <td>{r.fills} fills</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TAB 4: RAW LOG EDITOR */}
                {sessionTab === 'raw' && (
                  <div className="card">
                    <div className="card-top" style={{ marginBottom: '0.75rem' }}>
                      <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                        Raw Broker Execution Log Editor ({sessionDate})
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Directly edit log text, fix missing exit fills, or add lines
                      </span>
                    </div>

                    <textarea
                      value={editingSessionLog}
                      onChange={(e) => setEditingSessionLog(e.target.value)}
                      style={{
                        width: '100%',
                        minHeight: '220px',
                        fontFamily: 'monospace',
                        fontSize: '0.85rem',
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-light)',
                        marginBottom: '1rem'
                      }}
                    ></textarea>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button className="btn" onClick={handleSaveEditedSessionLog}>
                        <Save size={16} /> Save & Re-Parse Session Log
                      </button>
                      <button className="btn btn-secondary" onClick={() => handleCopyRawLog(editingSessionLog)}>
                        <Copy size={16} /> Copy Log Text
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                <p style={{ color: 'var(--text-muted)' }}>No trade logs found for date {sessionDate}. Select another date from the calendar or import new logs.</p>
              </div>
            )}
          </div>
        )}

        {/* VIEW: DASHBOARD (REDESIGNED KPI CARDS & MONTH NAV) */}
        {currentView === 'dashboard' && (
          <div>
            {/* Top Month Time Horizon Bar */}
            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>Time Horizon:</span>
                
                <div className="month-nav-bar">
                  <button className="month-nav-btn" onClick={handlePrevMonth} title="Previous Month">
                    <ChevronLeft size={18} />
                  </button>
                  
                  <select
                    value={dashboardMonthFilter}
                    onChange={(e) => setDashboardMonthFilter(e.target.value)}
                    className="form-select"
                    style={{ border: 'none', background: 'transparent', padding: '0.35rem 0.5rem', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}
                  >
                    <option value="ALL">All Time (Entire History)</option>
                    {availableMonths.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>

                  <button className="month-nav-btn" onClick={handleNextMonth} title="Next Month">
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              {dashboardMonthFilter !== 'ALL' && (
                <button className="btn btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }} onClick={() => setDashboardMonthFilter('ALL')}>
                  Reset to All Time
                </button>
              )}
            </div>

            {/* Redesigned KPI Grid Cards */}
            <div className="grid-cards">
              {/* Card 1: Net P&L Hero Card */}
              <div className="card card-hero">
                <div className="card-top">
                  <span className="card-title">
                    {settings.enableFees ? 'Accumulated Net P&L' : 'Accumulated Realized P&L'}
                  </span>
                  <button className="card-icon-btn"><ArrowUpRight size={16} /></button>
                </div>
                <div className="card-value">
                  {filteredDashboardAnalytics.totalPnl >= 0 ? '+' : ''}${filteredDashboardAnalytics.totalPnl.toFixed(2)}
                </div>
                <span className="card-footer-tag tag-profit">
                  {settings.enableFees ? `Gross: $${filteredDashboardAnalytics.grossPnl.toFixed(2)} • Fees: $${filteredDashboardAnalytics.totalFees.toFixed(2)}` : 'Realized Total Return'}
                </span>
              </div>

              {/* Card 2: Win Rate % (Prominent Hero Card) */}
              <div className="card">
                <div className="card-top">
                  <span className="card-title">Overall Win Rate</span>
                  <button className="card-icon-btn"><Percent size={16} color="var(--hero-green)" /></button>
                </div>
                <div className="card-value" style={{ color: 'var(--hero-green)' }}>
                  {filteredDashboardAnalytics.winRate.toFixed(2)}%
                </div>
                <span className="card-footer-tag" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
                  Profit Factor: <strong style={{ marginLeft: '4px', color: 'var(--hero-green)' }}>{filteredDashboardAnalytics.profitFactor.toFixed(2)}</strong>
                </span>
              </div>

              {/* Card 3: Total Trades Closed */}
              <div className="card">
                <div className="card-top">
                  <span className="card-title">Total Trades Closed</span>
                  <button className="card-icon-btn"><FileText size={16} /></button>
                </div>
                <div className="card-value">{filteredDashboardAnalytics.totalTrades}</div>
                <span className="card-footer-tag" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
                  {filteredDashboardAnalytics.roundTripShares} Round-Trip Shares
                </span>
              </div>

              {/* Card 4: Avg Hold Duration */}
              <div className="card">
                <div className="card-top">
                  <span className="card-title">Avg Hold Duration</span>
                  <button className="card-icon-btn"><Clock size={16} /></button>
                </div>
                <div className="card-value">{formatHoldTime(filteredDashboardAnalytics.avgHoldTime)}</div>
                <span className="card-footer-tag" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
                  Average Position Hold
                </span>
              </div>
            </div>

            {/* Equity Curve Chart */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="card-top">
                <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                  Equity Growth Curve ({dashboardMonthFilter === 'ALL' ? 'All Time' : dashboardMonthFilter})
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Realized cumulative performance across active sessions</span>
              </div>
              <div className="chart-container">
                {cumulativeEquityChartData && <Line data={cumulativeEquityChartData} options={smoothEquityChartOptions} />}
              </div>
            </div>

            {/* Time-of-Day Hourly Performance (Golden Hour Finder) */}
            {hourlyAnalytics && hourlyAnalytics.length > 0 && (
              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-top">
                  <div>
                    <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Clock size={18} color="var(--hero-green)" /> Time-of-Day Hourly Performance (Golden Hour Finder)
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Analyze intraday trading hours to discover your highest win rate & profit windows
                    </span>
                  </div>
                </div>

                <div className="hourly-grid">
                  {(() => {
                    const maxHourPnl = Math.max(...hourlyAnalytics.map(h => settings.enableFees ? h.netPnl : h.pnl));
                    return hourlyAnalytics.map(h => {
                      const pnlVal = settings.enableFees ? h.netPnl : h.pnl;
                      const isBest = pnlVal > 0 && pnlVal === maxHourPnl;
                      return (
                        <div key={h.slotKey} className={`hourly-card ${isBest ? 'best-hour' : ''}`}>
                          <div className="hourly-card-time">{h.hourLabel}</div>
                          <div className="hourly-card-pnl" style={{ color: pnlVal >= 0 ? 'var(--hero-green)' : 'var(--rose-text)' }}>
                            {pnlVal >= 0 ? '+' : ''}${pnlVal.toFixed(2)}
                          </div>
                          <div className="hourly-card-meta">
                            {h.tradesCount} Trades • {h.winRate.toFixed(0)}% Win
                          </div>
                          {isBest && (
                            <span className="badge badge-darkpool" style={{ marginTop: '0.4rem', backgroundColor: '#d1fae5', color: '#065f46', fontSize: '0.68rem' }}>
                              🌟 Golden Hour
                            </span>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </div>
        )}


        {/* VIEW: ECN & DARKPOOLS */}
        {currentView === 'ecnAnalytics' && (
          <div>
            <div className="grid-cards">
              <div className="card card-hero">
                <div className="card-top">
                  <span className="card-title">Total Execution Volume</span>
                  <button className="card-icon-btn"><Layers size={16} /></button>
                </div>
                <div className="card-value">
                  {globalECNAnalytics.totalVolume} Shares
                </div>
                <span className="card-footer-tag tag-profit">
                  {globalECNAnalytics.routeStats.length} Unique Venues
                </span>
              </div>

              <div className="card">
                <div className="card-top">
                  <span className="card-title">ECN Volume</span>
                  <button className="card-icon-btn"><Activity size={16} color="var(--emerald)" /></button>
                </div>
                <div className="card-value">
                  {globalECNAnalytics.litVolume} Shares
                </div>
                <span className="card-footer-tag tag-profit">
                  {globalECNAnalytics.litPct.toFixed(2)}% ECN Market Share
                </span>
              </div>

              <div className="card">
                <div className="card-top">
                  <span className="card-title">Darkpool Liquidity Volume</span>
                  <button className="card-icon-btn"><Zap size={16} color="var(--purple-text)" /></button>
                </div>
                <div className="card-value" style={{ color: 'var(--purple-text)' }}>
                  {globalECNAnalytics.darkpoolVolume} Shares
                </div>
                <span className="card-footer-tag" style={{ backgroundColor: 'var(--purple-bg)', color: 'var(--purple-text)' }}>
                  {globalECNAnalytics.darkpoolPct.toFixed(2)}% Darkpool Share
                </span>
              </div>
            </div>

            <div className="row-2-col">
              <div className="card">
                <div className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700, marginBottom: '1rem' }}>
                  Venue Breakdown (ECNs vs Darkpools)
                </div>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Venue Route</th>
                        <th>Type</th>
                        <th>Routed Volume</th>
                        <th>Fills</th>
                        <th>% Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {globalECNAnalytics.routeStats.map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <span className={`badge ${item.isDarkpool ? 'badge-darkpool' : 'badge-route'}`}>
                              {item.route}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: item.isDarkpool ? 'var(--purple-text)' : 'var(--blue-text)' }}>
                            {item.typeLabel}
                          </td>
                          <td style={{ fontWeight: 700 }}>{item.volume} shares</td>
                          <td>{item.fills}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ flexGrow: 1, height: '6px', backgroundColor: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${item.pctVolume}%`, backgroundColor: item.isDarkpool ? '#6b21a8' : '#10b981' }}></div>
                              </div>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{item.pctVolume.toFixed(2)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card">
                <div className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700, marginBottom: '1rem' }}>
                  Darkpool Stock Usage Summary
                </div>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Symbol</th>
                        <th>Darkpool Vol</th>
                        <th>Entry Darkpools</th>
                        <th>Exit Darkpools</th>
                      </tr>
                    </thead>
                    <tbody>
                      {globalECNAnalytics.stockDarkpoolSummary.length > 0 ? (
                        globalECNAnalytics.stockDarkpoolSummary.map((item, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 800, color: 'var(--text-main)' }}>{item.symbol}</td>
                            <td style={{ fontWeight: 700, color: 'var(--purple-text)' }}>{item.darkpoolVolume} shs</td>
                            <td>
                              {item.entryDarkpools.length > 0 ? (
                                item.entryDarkpools.map(dp => <span key={dp} className="badge badge-darkpool" style={{ marginRight: '0.2rem' }}>{dp}</span>)
                              ) : <span style={{ color: 'var(--text-light)', fontSize: '0.75rem' }}>ECN Only</span>}
                            </td>
                            <td>
                              {item.exitDarkpools.length > 0 ? (
                                item.exitDarkpools.map(dp => <span key={dp} className="badge badge-darkpool" style={{ marginRight: '0.2rem' }}>{dp}</span>)
                              ) : <span style={{ color: 'var(--text-light)', fontSize: '0.75rem' }}>ECN Only</span>}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', padding: '2rem 0', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                            No Darkpool fills recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: STOCK ANALYSIS (SIMPLE MODE VS ADVANCED FINVIZ TERMINAL MODE) */}
        {currentView === 'stockAnalysis' && (
          <div>
            {/* Top Mode Switcher Bar */}
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div className="mode-toggle-bar">
                <button
                  className={`mode-toggle-btn ${stockViewMode === 'simple' ? 'active' : ''}`}
                  onClick={() => setStockViewMode('simple')}
                >
                  Simple Table Mode
                </button>
                <button
                  className={`mode-toggle-btn ${stockViewMode === 'advanced' ? 'active' : ''}`}
                  onClick={() => setStockViewMode('advanced')}
                >
                  <Sparkles size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Advanced Finviz Terminal
                </button>
              </div>

              {stockViewMode === 'advanced' && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Search ticker (e.g. CZFS)..."
                      value={customStockSearchInput}
                      onChange={(e) => setCustomStockSearchInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customStockSearchInput) {
                          setSelectedStockTicker(customStockSearchInput.trim().toUpperCase());
                        }
                      }}
                      style={{ paddingLeft: '30px', paddingRight: '10px', width: '220px', fontSize: '0.82rem' }}
                    />
                  </div>
                  {customStockSearchInput && (
                    <button className="btn" style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem' }} onClick={() => setSelectedStockTicker(customStockSearchInput.trim().toUpperCase())}>
                      Load Ticker
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* MODE 1: ADVANCED FINVIZ FINANCIAL TERMINAL */}
            {stockViewMode === 'advanced' && (
              <div>
                {/* Horizontal Ticker Selection Pill List */}
                <div className="ticker-pill-bar">
                  {overallAnalytics.tickerStats.map(stat => (
                    <div
                      key={stat.symbol}
                      className={`ticker-pill ${selectedStockTicker === stat.symbol ? 'active' : ''}`}
                      onClick={() => setSelectedStockTicker(stat.symbol)}
                    >
                      {stat.symbol} <span style={{ opacity: 0.85 }}>({stat.pnl >= 0 ? '+' : ''}${stat.pnl.toFixed(0)})</span>
                    </div>
                  ))}
                </div>

                {/* Finviz Live Scraped Terminal Card */}
                {selectedStockTicker && (
                  <div className="stock-terminal-header">
                    <div className="stock-terminal-title">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span className="stock-terminal-symbol">{selectedStockTicker}</span>
                          <span className="badge badge-route" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#ffffff', border: 'none' }}>
                            {stockMarketMeta ? stockMarketMeta.sector : 'Financials'}
                          </span>
                          <span className="badge badge-darkpool" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#a7f3d0', border: 'none' }}>
                            {stockMarketMeta ? stockMarketMeta.industry : 'Regional Banks'}
                          </span>
                        </div>
                        <div className="stock-terminal-name">
                          {stockMarketMeta ? stockMarketMeta.companyName : `${selectedStockTicker} Inc.`}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div className="stock-terminal-price-box">
                          <div className="stock-terminal-price">${stockMarketMeta ? stockMarketMeta.price : '0.00'}</div>
                          <div className={`stock-terminal-change ${stockMarketMeta && stockMarketMeta.change.includes('-') ? 'change-red' : 'change-green'}`}>
                            {stockMarketMeta ? stockMarketMeta.change : '0.00%'}
                          </div>
                        </div>

                        <a 
                          href={`https://finviz.com/quote.ashx?t=${selectedStockTicker}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="btn btn-secondary"
                          style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem', backgroundColor: 'rgba(255,255,255,0.1)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)' }}
                        >
                          <ExternalLink size={14} /> Open on Finviz
                        </a>
                      </div>
                    </div>

                    {/* Grouped Finviz stock metrics into 4 cards with tight 2x2 CSS grid layout */}
                    {stockMarketMeta && stockMarketMeta.metrics && (
                      <div className="finviz-grouped-cards">
                        {/* Card 1: Valuation & Ratios */}
                        <div className="metrics-group-card">
                          <div className="metrics-group-title">Valuation & Financial Info</div>
                          <div className="metrics-inner-grid">
                            {[
                              { key: 'Index', label: 'Index' },
                              { key: 'Market Cap', label: 'Market Cap' },
                              { key: 'P/E', label: 'P/E Ratio' },
                              { key: 'Target Price', label: 'Target Price' },
                              { key: 'Short Float', label: 'Short Float' }
                            ].map(item => {
                              const val = stockMarketMeta.metrics[item.key] || stockMarketMeta[item.key.toLowerCase()] || '-';
                              return (
                                <div key={item.key} className="metric-item">
                                  <span className="finviz-metric-label">{item.label}</span>
                                  <span className="finviz-metric-value">{val}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Card 2: Technicals & Price Range */}
                        <div className="metrics-group-card">
                          <div className="metrics-group-title">Technicals & Price Range</div>
                          <div className="metrics-inner-grid">
                            {[
                              { key: 'Price', label: 'Last Price' },
                              { key: 'Prev Close', label: 'Prev Close' },
                              { key: 'ATR (14)', label: 'ATR (14)' },
                              { key: 'Volatility', label: 'Volatility Range' },
                              { key: '52W High', label: '52-Week High' },
                              { key: '52W Low', label: '52-Week Low' }
                            ].map(item => {
                              const val = stockMarketMeta.metrics[item.key] || stockMarketMeta[item.key.toLowerCase()] || '-';
                              return (
                                <div key={item.key} className="metric-item">
                                  <span className="finviz-metric-label">{item.label}</span>
                                  <span className="finviz-metric-value">{val}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Card 3: Volume & Liquidity */}
                        <div className="metrics-group-card">
                          <div className="metrics-group-title">Volume & Liquidity</div>
                          <div className="metrics-inner-grid">
                            {[
                              { key: 'Volume', label: 'Session Volume' },
                              { key: 'Avg Volume', label: 'Avg Volume (3M)' },
                              { key: 'IPO', label: 'IPO Date' }
                            ].map(item => {
                              const val = stockMarketMeta.metrics[item.key] || stockMarketMeta[item.key.toLowerCase()] || '-';
                              return (
                                <div key={item.key} className="metric-item">
                                  <span className="finviz-metric-label">{item.label}</span>
                                  <span className="finviz-metric-value">{val}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Card 4: Corporate Calendar */}
                        <div className="metrics-group-card">
                          <div className="metrics-group-title">Corporate Calendar</div>
                          <div className="metrics-inner-grid">
                            {[
                              { key: 'Earnings', label: 'Earnings Release' },
                              { key: 'Dividend Ex-Date', label: 'Ex-Dividend Date' }
                            ].map(item => {
                              const val = stockMarketMeta.metrics[item.key] || stockMarketMeta[item.key.toLowerCase()] || '-';
                              return (
                                <div key={item.key} className="metric-item">
                                  <span className="finviz-metric-label">{item.label}</span>
                                  <span className="finviz-metric-value">{val}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                )}


                {/* Personal Trading Summary Card for Selected Stock */}
                <div className="grid-cards" style={{ marginBottom: '1.5rem' }}>
                  <div className="card card-hero">
                    <div className="card-top">
                      <span className="card-title">My Realized P&L on {selectedStockTicker}</span>
                      <button className="card-icon-btn"><ArrowUpRight size={16} /></button>
                    </div>
                    <div className="card-value">
                      {selectedStockPersonalHistory.totalPnl >= 0 ? '+' : ''}${selectedStockPersonalHistory.totalPnl.toFixed(2)}
                    </div>
                    <span className="card-footer-tag tag-profit">
                      {settings.enableFees ? `Net: $${selectedStockPersonalHistory.netPnl.toFixed(2)}` : 'Personal Symbol Performance'}
                    </span>
                  </div>

                  <div className="card">
                    <div className="card-top">
                      <span className="card-title">Win Rate on {selectedStockTicker}</span>
                      <button className="card-icon-btn"><Percent size={16} /></button>
                    </div>
                    <div className="card-value">
                      {selectedStockPersonalHistory.winRate.toFixed(2)}%
                    </div>
                    <span className="card-footer-tag tag-profit">
                      {selectedStockPersonalHistory.tradesCount} Trades Closed
                    </span>
                  </div>

                  <div className="card">
                    <div className="card-top">
                      <span className="card-title">Volume Traded</span>
                      <button className="card-icon-btn"><Layers size={16} /></button>
                    </div>
                    <div className="card-value">
                      {selectedStockPersonalHistory.totalShares} Shares
                    </div>
                    <span className="card-footer-tag" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
                      Across {selectedStockPersonalHistory.sessions.length} Sessions
                    </span>
                  </div>
                </div>

                {/* Day-by-Day Trade Log Table for Selected Stock */}
                <div className="card">
                  <div className="card-top">
                    <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                      Session-by-Session Performance Log for {selectedStockTicker}
                    </span>
                  </div>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Session Date</th>
                          <th>Realized P&L</th>
                          {settings.enableFees && <th>Net P&L</th>}
                          <th>Trades</th>
                          <th>Shares Traded</th>
                          <th>Avg Buy Price</th>
                          <th>Avg Sell Price</th>
                          <th>Avg Hold</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedStockPersonalHistory.sessions.length > 0 ? (
                          selectedStockPersonalHistory.sessions.map(s => (
                            <tr key={s.date}>
                              <td style={{ fontWeight: 800 }}>{s.date}</td>
                              <td style={{ fontWeight: 800, color: s.pnl >= 0 ? 'var(--hero-green)' : 'var(--rose-text)' }}>
                                {s.pnl >= 0 ? '+' : ''}${s.pnl.toFixed(2)}
                              </td>
                              {settings.enableFees && (
                                <td style={{ fontWeight: 700, color: s.netPnl >= 0 ? 'var(--hero-green)' : 'var(--rose-text)' }}>
                                  {s.netPnl >= 0 ? '+' : ''}${s.netPnl.toFixed(2)}
                                </td>
                              )}
                              <td>{s.tradesCount}</td>
                              <td>{s.totalQty} shs</td>
                              <td>${s.avgBuyPrice.toFixed(2)}</td>
                              <td>${s.avgSellPrice.toFixed(2)}</td>
                              <td>{formatHoldTime(s.avgHoldTime)}</td>
                              <td>
                                <button className="btn btn-secondary" style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }} onClick={() => { setSessionDate(s.date); setCurrentView('singleSession'); }}>
                                  Inspect Session
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="8" style={{ textAlign: 'center', padding: '2rem 0', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                              No trade logs found for ticker {selectedStockTicker}.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* MODE 2: SIMPLE TABLE MODE */}
            {stockViewMode === 'simple' && (
              <div className="card">
                <div className="card-top">
                  <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                    Stock-by-Stock Accumulated Performance
                  </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Ticker Symbol</th>
                        <th>Total Realized P&L</th>
                        <th>Total Trades</th>
                        <th>Win Rate</th>
                        <th>Shares Traded</th>
                        <th>Avg Hold Time</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overallAnalytics.tickerStats.map(stat => (
                        <tr key={stat.symbol}>
                          <td style={{ fontWeight: 800 }}>{stat.symbol}</td>
                          <td style={{ fontWeight: 800, color: stat.pnl >= 0 ? 'var(--hero-green)' : 'var(--rose-text)' }}>
                            {stat.pnl >= 0 ? '+' : ''}${stat.pnl.toFixed(2)}
                          </td>
                          <td>{stat.tradesCount}</td>
                          <td>{stat.winRate.toFixed(2)}%</td>
                          <td>{stat.volume}</td>
                          <td>{formatHoldTime(stat.avgHoldTime)}</td>
                          <td>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}
                              onClick={() => {
                                setSelectedStockTicker(stat.symbol);
                                setStockViewMode('advanced');
                              }}
                            >
                              Inspect Finviz Terminal
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW: CALENDAR HEATMAP */}
        {currentView === 'heatmap' && (
          <div>
            <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                2026 Daily Return Density
              </div>
              <button className="btn btn-secondary" onClick={() => setHeatmapActiveOnly(!heatmapActiveOnly)}>
                {heatmapActiveOnly ? 'Show All 12 Months' : 'Show Active Months Only'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
              {heatmapData.map(m => (
                <div key={m.monthIndex} className="card" style={{ padding: '1rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--text-main)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{m.name}</span>
                    {m.hasData && <span style={{ fontSize: '0.7rem', color: 'var(--emerald)', fontWeight: 800 }}>Active</span>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.35rem' }}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((wd, idx) => (
                      <div key={idx} style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600 }}>{wd}</div>
                    ))}
                    {m.days.map((day, dIdx) => {
                      const dayStat = day.dateStr ? dailyStatsMap[day.dateStr] : null;
                      return (
                        <div
                          key={dIdx}
                          title={dayStat ? `${day.dateStr}: ${dayStat.pnl >= 0 ? '+' : ''}$${dayStat.pnl.toFixed(2)} (${dayStat.totalOrders} trades)` : ''}
                          style={{
                            aspectRatio: '1',
                            borderRadius: '0.25rem',
                            backgroundColor: getHeatmapDayColor(day.dateStr),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: dayStat && Math.abs(dayStat.pnl) > 100 ? '#ffffff' : '#111827',
                            cursor: day.dateStr && dailyStatsMap[day.dateStr] ? 'pointer' : 'default'
                          }}
                          onClick={() => {
                            if (day.dateStr && dailyStatsMap[day.dateStr]) {
                              setSessionDate(day.dateStr);
                              setCurrentView('singleSession');
                            }
                          }}
                        >
                          {day.dayNum}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW: IMPORT LOGS */}
        {currentView === 'pasteLogs' && (
          <div>
            <div className="row-2-col">
              <div className="card">
                <div className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700, marginBottom: '1rem' }}>
                  Import Raw Broker Log & Attach Screenshots
                </div>
                
                <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Session Date:</span>
                    <div className="calendar-picker-wrapper" ref={importCalendarRef}>
                      <button className="calendar-trigger-btn" onClick={() => setShowImportCalendar(!showImportCalendar)}>
                        <CalendarDays size={16} color="var(--hero-green)" />
                        <span>{selectedDate || 'Select Date'}</span>
                      </button>

                      {showImportCalendar && (
                        <div className="calendar-popover">
                          <div className="calendar-popover-header">
                            <button className="calendar-nav-btn" onClick={() => {
                              if (importPopMonth === 0) { setImportPopMonth(11); setImportPopYear(importPopYear - 1); }
                              else { setImportPopMonth(importPopMonth - 1); }
                            }}><ChevronLeft size={18} /></button>
                            <span>{monthNames[importPopMonth]} {importPopYear}</span>
                            <button className="calendar-nav-btn" onClick={() => {
                              if (importPopMonth === 11) { setImportPopMonth(0); setImportPopYear(importPopYear + 1); }
                              else { setImportPopMonth(importPopMonth + 1); }
                            }}><ChevronRight size={18} /></button>
                          </div>

                          <div className="popover-grid">
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((wd, idx) => (
                              <div key={idx} className="popover-weekday">{wd}</div>
                            ))}
                            {getCalendarPopoverGrid(importPopYear, importPopMonth).map((day, dIdx) => {
                              const hasSession = day.dateStr && dailyStatsMap[day.dateStr];
                              const isProfitable = hasSession && dailyStatsMap[day.dateStr].pnl >= 0;
                              const isSelected = day.dateStr === selectedDate;

                              return (
                                <div
                                  key={dIdx}
                                  className={`popover-day-cell ${day.dayNum === null ? 'empty' : ''} ${isSelected ? 'selected' : ''}`}
                                  onClick={() => {
                                    if (day.dateStr) {
                                      setSelectedDate(day.dateStr);
                                      setShowImportCalendar(false);
                                    }
                                  }}
                                >
                                  {day.dayNum}
                                  {hasSession && (
                                    <span className={`session-dot ${isProfitable ? 'dot-profit' : 'dot-loss'}`} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>Date Format:</span>
                    <select
                      value={settings.dateFormat}
                      onChange={(e) => handleSaveSettings({ ...settings, dateFormat: e.target.value })}
                      className="form-select"
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                    >
                      <option value="DD-MM-YY">DD-MM-YY (Day First)</option>
                      <option value="MM/DD/YY">MM/DD/YY (US Month First)</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                    </select>
                  </div>
                </div>

                <textarea
                  value={pastedText}
                  onChange={handlePasteChange}
                  placeholder="Paste tab-separated broker execution logs here..."
                ></textarea>

                <div style={{ marginTop: '1rem' }}>
                  <label className="dropzone-container" style={{ display: 'block' }}>
                    <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileSelect} />
                    <ImageIcon size={22} color="var(--hero-green)" style={{ margin: '0 auto 0.25rem auto', display: 'block' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Click to attach closing screenshots (PNG/JPEG)</span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Saved directly on disk with log session file</div>
                  </label>

                  {pendingScreenshots.length > 0 && (
                    <div className="screenshot-grid">
                      {pendingScreenshots.map((img, idx) => (
                        <div key={idx} className="screenshot-card">
                          <img src={img.dataUrl} alt={`Upload Preview ${idx + 1}`} />
                          <button className="delete-btn" onClick={() => handleRemovePendingScreenshot(idx)}>
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '1.25rem', display: 'flex', gap: '1rem' }}>
                  <button className="btn" style={{ flexGrow: 1, justifyContent: 'center' }} onClick={handleSaveLog}>
                    <Plus size={16} /> Save Session & Screenshots
                  </button>
                  <button className="btn btn-secondary" onClick={() => { setPastedText(''); setPendingScreenshots([]); }}>
                    Clear
                  </button>
                </div>
              </div>

              <div className="card">
                <div className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700, marginBottom: '1rem' }}>
                  Saved Session Files on Disk
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {Object.keys(logs).length > 0 ? (
                    Object.keys(logs).sort().reverse().map(date => {
                      const stats = dailyStatsMap[date];
                      return (
                        <div key={date} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', border: '1px solid var(--border-light)', borderRadius: '0.5rem' }}>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{date}</div>
                            {stats && (
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                P&L: <span style={{ color: stats.pnl >= 0 ? 'var(--hero-green)' : 'var(--rose-text)', fontWeight: 700 }}>
                                  {(stats.pnl >= 0 ? '+' : '')}${stats.pnl.toFixed(2)}
                                </span> • {stats.totalOrders} Trades ({stats.roundTripShares} shs)
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }} onClick={() => { setSessionDate(date); setCurrentView('singleSession'); }}>
                              Inspect
                            </button>
                            <button className="btn btn-danger" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }} onClick={() => handleDeleteLog(date)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem 0' }}>
                      No saved sessions found.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: SETTINGS */}
        {currentView === 'settings' && (
          <div>
            <div className="settings-section">
              <div className="settings-title">General Preferences & Date Parsing</div>
              <div className="settings-desc">Configure date format parsing, journaling, and display behavior across your log sessions</div>

              <div className="form-group">
                <label className="form-label">Default Date Parsing Format</label>
                <select
                  value={settings.dateFormat}
                  onChange={(e) => handleSaveSettings({ ...settings, dateFormat: e.target.value })}
                  className="form-select"
                >
                  <option value="DD-MM-YY">DD-MM-YY / DD/MM/YYYY (Day First - Standard)</option>
                  <option value="MM/DD/YY">MM/DD/YY / MM-DD-YYYY (US Month First)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (ISO Standard)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    className="toggle-checkbox"
                    checked={settings.enableJournal}
                    onChange={(e) => handleSaveSettings({ ...settings, enableJournal: e.target.checked })}
                    style={{ display: 'none' }}
                  />
                  <span className="toggle-slider"></span>
                  <span className="form-label" style={{ marginBottom: 0 }}>Enable Session Journaling Tab</span>
                </label>
              </div>

              <div className="form-group" style={{ marginTop: '0.75rem' }}>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    className="toggle-checkbox"
                    checked={settings.silentUpdates}
                    onChange={(e) => handleSaveSettings({ ...settings, silentUpdates: e.target.checked })}
                    style={{ display: 'none' }}
                  />
                  <span className="toggle-slider"></span>
                  <span className="form-label" style={{ marginBottom: 0 }}>Enable Silent Background Auto-Updates</span>
                </label>
              </div>
            </div>




            <div className="settings-section">
              <div className="settings-title">Fees Calculation Engine</div>
              <div className="settings-desc">Track net profits by automatically deducting broker execution fees per round-trip share</div>

              <div className="form-group">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    className="toggle-checkbox"
                    checked={settings.enableFees}
                    onChange={(e) => handleSaveSettings({ ...settings, enableFees: e.target.checked })}
                    style={{ display: 'none' }}
                  />
                  <span className="toggle-slider"></span>
                  <span className="form-label" style={{ marginBottom: 0 }}>Enable Fees Deductions</span>
                </label>
              </div>

              {settings.enableFees && (
                <div className="form-group">
                  <label className="form-label">Fee Rate Per Round-Trip Share ($)</label>
                  <input
                    type="number"
                    step="0.005"
                    className="form-input"
                    value={settings.feePerShare}
                    onChange={(e) => handleSaveSettings({ ...settings, feePerShare: parseFloat(e.target.value) || 0 })}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Example: $0.05 per round-trip share (9 shares bought & sold = 9 × $0.05 = $0.45 fee)
                  </span>
                </div>
              )}
            </div>

            <div className="settings-section">
              <div className="settings-title">Cloud Backup & Local Journal Sync</div>
              <div className="settings-desc">Export compressed journal backups or configure automated free cloud sync</div>

              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <button className="btn" onClick={handleExportBackup}>
                  <Download size={16} /> Export Full Journal Backup (.json)
                </button>
                <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                  <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportBackup} />
                  <Upload size={16} /> Restore Backup File
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">Cloud Backup Provider</label>
                <select
                  value={settings.cloudProvider}
                  onChange={(e) => handleSaveSettings({ ...settings, cloudProvider: e.target.value })}
                  className="form-select"
                >
                  <option value="none">Disabled (Local Machine Storage Only)</option>
                  <option value="gdrive">Google Drive Local Folder Sync (Free 15GB)</option>
                  <option value="gdrive_api">Google Drive Direct API Upload (OAuth)</option>
                  <option value="r2">Cloudflare R2 Storage (S3 API - 10GB Free)</option>
                </select>
              </div>

              {settings.cloudProvider === 'gdrive' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginTop: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Google Drive Desktop Sync Folder Path</label>
                    <input
                      type="text"
                      className="form-input"
                      value={settings.gdriveSyncPath || ''}
                      onChange={(e) => handleSaveSettings({ ...settings, gdriveSyncPath: e.target.value })}
                      placeholder="e.g. C:\Users\Ajinkya\Google Drive\HammerJournal"
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Ensure Google Drive Desktop App is running on your machine. Hammer Pro Journal will copy all session files to this folder for automatic background cloud backup.
                    </span>
                  </div>
                </div>
              )}

              {settings.cloudProvider === 'gdrive_api' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Google Drive Folder ID</label>
                    <input
                      type="text"
                      className="form-input"
                      value={settings.gdriveFolderId || ''}
                      onChange={(e) => handleSaveSettings({ ...settings, gdriveFolderId: e.target.value })}
                      placeholder="Folder ID from Google Drive URL"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Google OAuth Access Token</label>
                    <input
                      type="password"
                      className="form-input"
                      value={settings.gdriveAccessToken || ''}
                      onChange={(e) => handleSaveSettings({ ...settings, gdriveAccessToken: e.target.value })}
                      placeholder="OAuth Access Token"
                    />
                  </div>
                </div>
              )}

              {settings.cloudProvider === 'r2' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">R2 Backup URL / Cloudflare Worker Endpoint</label>
                    <input
                      type="text"
                      className="form-input"
                      value={settings.r2BackupUrl || ''}
                      onChange={(e) => handleSaveSettings({ ...settings, r2BackupUrl: e.target.value })}
                      placeholder="https://your-worker.yourname.workers.dev/backup"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">R2 Account ID</label>
                    <input
                      type="text"
                      className="form-input"
                      value={settings.r2AccountId || ''}
                      onChange={(e) => handleSaveSettings({ ...settings, r2AccountId: e.target.value })}
                      placeholder="Account ID"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bucket Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={settings.r2Bucket || ''}
                      onChange={(e) => handleSaveSettings({ ...settings, r2Bucket: e.target.value })}
                      placeholder="hammer-journal-backup"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Access Key ID</label>
                    <input
                      type="password"
                      className="form-input"
                      value={settings.r2AccessKey || ''}
                      onChange={(e) => handleSaveSettings({ ...settings, r2AccessKey: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Secret Access Key</label>
                    <input
                      type="password"
                      className="form-input"
                      value={settings.r2SecretKey || ''}
                      onChange={(e) => handleSaveSettings({ ...settings, r2SecretKey: e.target.value })}
                    />
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
