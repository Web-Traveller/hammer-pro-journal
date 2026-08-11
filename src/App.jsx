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
  Save
} from 'lucide-react';
import './App.css';
import {
  extractExecutions,
  matchTradesFIFO,
  compileDailyStats,
  compileSingleDayAnalytics,
  compileECNAnalytics,
  compileOverallAnalytics,
  parseTime,
  isDarkpool
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
  const [sessionTab, setSessionTab] = useState('stocks'); // 'stocks', 'ecn', 'raw'
  const [editingSessionLog, setEditingSessionLog] = useState('');
  const [copied, setCopied] = useState(false);

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
    loadLogsFromBackend();
    if (isTauri) {
      checkForAutoUpdates();
    }
  }, []);

  async function checkForAutoUpdates() {
    try {
      const update = await checkTauriUpdate();
      if (update && update.available) {
        showToast(`Downloading update v${update.version} in background...`, "info");
        await update.downloadAndInstall();
        showToast("Update downloaded! Will apply automatically when you restart.", "success");
      }
    } catch (e) {
      console.log("No update available or web environment:", e);
    }
  }

  useEffect(() => {
    if (sessionDate) {
      loadSessionScreenshots(sessionDate);
      setEditingSessionLog(logs[sessionDate] || '');
    }
  }, [sessionDate, logs]);

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
        setSessionPopYear(y);
        setSessionPopMonth(m - 1);
        setImportPopYear(y);
        setImportPopMonth(m - 1);
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

  async function loadSessionScreenshots(date) {
    try {
      const imgs = await safeInvoke("load_session_screenshots", { date });
      setSessionScreenshots(imgs || []);
    } catch (e) {
      console.error("Failed to load session screenshots:", e);
    }
  }

  const handlePasteChange = (e) => {
    const text = e.target.value;
    setPastedText(text);
    const m = text.match(/(\d{2})[/.\-](\d{2})[/.\-](\d{2,4})/);
    if (m) {
      let [_, month, day, year] = m;
      if (year.length === 2) year = "20" + year;
      const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
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
        const filename = `img_${i + 1}.png`;
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
    } catch (e) {
      showToast(`Error saving log: ${e}`, "error");
    }
  };

  // Save edits to session raw log content directly from Quick Editor
  const handleSaveEditedSessionLog = async () => {
    if (!sessionDate) return;
    try {
      await safeInvoke("save_log", { date: sessionDate, content: editingSessionLog });
      setLogs(prev => ({
        ...prev,
        [sessionDate]: editingSessionLog
      }));
      showToast(`Log content for ${sessionDate} updated & re-parsed!`, "success");
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

  // Global Analytics compilation
  const { allExecutions, allTrades, dailyStatsMap, overallAnalytics, globalECNAnalytics } = useMemo(() => {
    let executions = [];
    const statsMap = {};
    
    Object.keys(logs).forEach(date => {
      const dayExecs = extractExecutions(logs[date], date);
      executions = executions.concat(dayExecs);
      const stats = compileDailyStats(dayExecs);
      if (stats) {
        statsMap[date] = stats;
      }
    });
    
    const trades = matchTradesFIFO(executions);
    const analytics = compileOverallAnalytics(trades, statsMap);
    const ecnAnalytics = compileECNAnalytics(executions);
    
    return {
      allExecutions: executions,
      allTrades: trades,
      dailyStatsMap: statsMap,
      overallAnalytics: analytics,
      globalECNAnalytics: ecnAnalytics
    };
  }, [logs]);

  const singleSessionAnalytics = useMemo(() => {
    if (!sessionDate || !logs[sessionDate]) return null;
    const dayExecs = extractExecutions(logs[sessionDate], sessionDate);
    return compileSingleDayAnalytics(dayExecs);
  }, [sessionDate, logs]);

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
    if (!overallAnalytics || !overallAnalytics.equityCurve || overallAnalytics.equityCurve.length === 0) return null;
    const labels = overallAnalytics.equityCurve.map(point => point.date);
    const data = overallAnalytics.equityCurve.map(point => point.cumulativePnl);
    
    return {
      labels,
      datasets: [
        {
          label: 'Cumulative P&L',
          data,
          borderColor: '#064e3b',
          borderWidth: 2.5,
          pointBackgroundColor: '#064e3b',
          pointRadius: 4,
          fill: true,
          backgroundColor: (context) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, 'rgba(6, 78, 59, 0.18)');
            gradient.addColorStop(1, 'rgba(6, 78, 59, 0.0)');
            return gradient;
          }
        }
      ]
    };
  }, [overallAnalytics]);

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
          pointRadius: 5,
          pointHoverRadius: 7,
          fill: true,
          backgroundColor: (context) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 260);
            gradient.addColorStop(0, 'rgba(16, 185, 129, 0.15)');
            gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
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
      for (let i = 0; i < startDay; i++) {
        days.push({ dayNum: null, dateStr: null });
      }
      for (let d = 1; d <= monthDays; d++) {
        const mmStr = (m + 1).toString().padStart(2, '0');
        const ddStr = d.toString().padStart(2, '0');
        const dateStr = `${year}-${mmStr}-${ddStr}`;
        days.push({ dayNum: d, dateStr });
      }
      months.push({ monthIndex: m, name: new Date(year, m).toLocaleString('default', { month: 'long' }), days });
    }
    return months;
  }, []);

  const getHeatmapDayColor = (dateStr) => {
    if (!dateStr || !dailyStatsMap[dateStr]) return '#f3f4f6';
    const pnl = dailyStatsMap[dateStr].pnl;
    if (pnl > 0) return '#a7f3d0';
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

  // Calculate Win Rate for Single Session (Strict 2 Decimals)
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
              {currentView === 'stockAnalysis' && 'Per-Stock Performance'}
              {currentView === 'heatmap' && 'P&L Calendar Heatmap'}
              {currentView === 'pasteLogs' && 'Import Broker Logs'}
            </h2>
            <p>
              {currentView === 'singleSession' && 'Intraday trade P&L curve, screenshots, Darkpool entries/exits, stock fills, and log editing'}
              {currentView === 'dashboard' && 'Accumulated performance, equity growth, and trading metrics'}
              {currentView === 'ecnAnalytics' && 'ECN vs. Darkpool liquidity analysis and venue breakdown'}
              {currentView === 'stockAnalysis' && 'Performance distribution, volume, and holding times per symbol'}
              {currentView === 'heatmap' && 'Calendar view of daily return density for 2026'}
              {currentView === 'pasteLogs' && 'Paste raw broker execution logs and save session files directly on disk'}
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
                {/* Active Open Positions Warning Box (If entries exist without exit) */}
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

                {/* Session Stat Cards Row */}
                <div className="grid-cards">
                  {/* Card 1: Realized P&L */}
                  <div className="card card-hero">
                    <div className="card-top">
                      <span className="card-title">Session Realized P&L</span>
                      <button className="card-icon-btn"><ArrowUpRight size={16} /></button>
                    </div>
                    <div className="card-value">
                      {singleSessionAnalytics.pnl >= 0 ? '+' : ''}${singleSessionAnalytics.pnl.toFixed(2)}
                    </div>
                    <span className="card-footer-tag tag-profit">
                      {singleSessionAnalytics.totalOrders} Trades Closed
                    </span>
                  </div>

                  {/* Card 2: Win Rate & Scalps Count */}
                  <div className="card">
                    <div className="card-top">
                      <span className="card-title">Win Rate & Trades</span>
                      <button className="card-icon-btn"><Percent size={16} /></button>
                    </div>
                    <div className="card-value">
                      {sessionWinRate}%
                    </div>
                    <span className="card-footer-tag tag-profit">
                      {singleSessionAnalytics.winningTrades} Win / {singleSessionAnalytics.losingTrades} Loss
                    </span>
                  </div>

                  {/* Card 3: Avg Win & Avg Loss (Combined) */}
                  <div className="card">
                    <div className="card-top">
                      <span className="card-title">Avg Win / Avg Loss</span>
                      <button className="card-icon-btn"><Scale size={16} /></button>
                    </div>
                    <div className="card-value" style={{ fontSize: '1.25rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ color: 'var(--hero-green)' }}>+${singleSessionAnalytics.avgWin.toFixed(2)}</span>
                      <span style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>/</span>
                      <span style={{ color: 'var(--rose-text)' }}>-${singleSessionAnalytics.avgLoss.toFixed(2)}</span>
                    </div>
                    <span className="card-footer-tag" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
                      R:R {singleSessionAnalytics.winLossRatio.toFixed(2)}x
                    </span>
                  </div>

                  {/* Card 4: Avg Hold Time & Volume */}
                  <div className="card">
                    <div className="card-top">
                      <span className="card-title">Avg Hold & Volume</span>
                      <button className="card-icon-btn"><Clock size={16} /></button>
                    </div>
                    <div className="card-value">
                      {formatHoldTime(singleSessionAnalytics.stockBreakdown.length > 0 ? (singleSessionAnalytics.stockBreakdown.reduce((acc, s) => acc + s.avgHoldTime, 0) / (singleSessionAnalytics.stockBreakdown.length || 1)) : 0)}
                    </div>
                    <span className="card-footer-tag" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
                      {singleSessionAnalytics.totalFills} Fills ({singleSessionAnalytics.totalBoughtQty} shs)
                    </span>
                  </div>
                </div>

                {/* Intraday Realized Cumulative Equity Curve */}
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                  <div className="card-top">
                    <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                      Intraday Realized Equity Curve ({sessionDate})
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Realized cumulative growth trade by trade (Gridless)</span>
                  </div>
                  <div className="chart-container">
                    {singleSessionChartData && <Line data={singleSessionChartData} options={smoothIntradayChartOptions} />}
                  </div>
                </div>

                {/* Attached Screenshots Section */}
                {sessionScreenshots.length > 0 && (
                  <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <div className="card-top">
                      <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                        Session Attached Screenshots ({sessionScreenshots.length})
                      </span>
                    </div>
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
                  </div>
                )}

                {/* Sub-tab Navigation Bar below chart */}
                <div className="tab-bar">
                  <button 
                    className={`tab-btn ${sessionTab === 'stocks' ? 'active' : ''}`}
                    onClick={() => setSessionTab('stocks')}
                  >
                    <BarChart3 size={15} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Per-Stock Performance
                  </button>
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

                {/* TAB 1: PER-STOCK BREAKDOWN */}
                {sessionTab === 'stocks' && (
                  <div className="card">
                    <div className="card-top">
                      <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                        Per-Stock Performance & Darkpool Routes ({sessionDate})
                      </span>
                    </div>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Symbol</th>
                            <th>Realized P&L</th>
                            <th>Trades</th>
                            <th>Total Shares</th>
                            <th>Avg Hold</th>
                            <th>Darkpool Vol vs ECN Vol</th>
                            <th>Entry Venues</th>
                            <th>Exit Venues</th>
                          </tr>
                        </thead>
                        <tbody>
                          {singleSessionAnalytics.stockBreakdown.map((stock) => (
                            <tr key={stock.symbol}>
                              <td style={{ fontWeight: 800 }}>{stock.symbol}</td>
                              <td style={{ fontWeight: 800, color: stock.pnl >= 0 ? 'var(--hero-green)' : 'var(--rose-text)' }}>
                                {stock.pnl >= 0 ? '+' : ''}${stock.pnl.toFixed(2)}
                              </td>
                              <td>{stock.tradesCount}</td>
                              <td>{stock.totalQty}</td>
                              <td>{formatHoldTime(stock.avgHoldTime)}</td>
                              <td>
                                <span style={{ color: 'var(--purple-text)', fontWeight: 700 }}>{stock.darkpoolVolume} dp</span>
                                <span style={{ color: 'var(--text-light)', margin: '0 4px' }}>/</span>
                                <span style={{ color: 'var(--blue-text)', fontWeight: 600 }}>{stock.litVolume} ecn</span>
                              </td>
                              <td>
                                {stock.entryDarkpools.length > 0 ? (
                                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                    {stock.entryDarkpools.map(dp => (
                                      <span key={dp} className="badge badge-darkpool">{dp}</span>
                                    ))}
                                  </div>
                                ) : <span className="badge badge-route">ECN</span>}
                              </td>
                              <td>
                                {stock.exitDarkpools.length > 0 ? (
                                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                    {stock.exitDarkpools.map(dp => (
                                      <span key={dp} className="badge badge-darkpool">{dp}</span>
                                    ))}
                                  </div>
                                ) : <span className="badge badge-route">ECN</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TAB 2: ECN & ROUTE BREAKDOWN */}
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

                {/* TAB 3: RAW LOG & QUICK EDITOR */}
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

        {/* VIEW: DASHBOARD */}
        {currentView === 'dashboard' && (
          <div>
            <div className="grid-cards">
              <div className="card card-hero">
                <div className="card-top">
                  <span className="card-title">Accumulated Net P&L</span>
                  <button className="card-icon-btn"><ArrowUpRight size={16} /></button>
                </div>
                <div className="card-value">
                  {overallAnalytics.totalPnl >= 0 ? '+' : ''}${overallAnalytics.totalPnl.toFixed(2)}
                </div>
                <span className="card-footer-tag tag-profit">
                  {overallAnalytics.winRate.toFixed(2)}% Win Rate
                </span>
              </div>

              <div className="card">
                <div className="card-top">
                  <span className="card-title">Total Trades Closed</span>
                  <button className="card-icon-btn"><FileText size={16} /></button>
                </div>
                <div className="card-value">{overallAnalytics.totalTrades}</div>
                <span className="card-footer-tag" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
                  {overallAnalytics.totalShares} Total Shares
                </span>
              </div>

              <div className="card">
                <div className="card-top">
                  <span className="card-title">Profit Factor</span>
                  <button className="card-icon-btn"><Percent size={16} /></button>
                </div>
                <div className="card-value">{overallAnalytics.profitFactor.toFixed(2)}</div>
                <span className="card-footer-tag tag-profit">Gross Return Ratio</span>
              </div>

              <div className="card">
                <div className="card-top">
                  <span className="card-title">Avg Hold Time</span>
                  <button className="card-icon-btn"><Clock size={16} /></button>
                </div>
                <div className="card-value">{formatHoldTime(overallAnalytics.avgHoldTime)}</div>
                <span className="card-footer-tag" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
                  Trade Hold Duration
                </span>
              </div>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="card-top">
                <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                  Equity Growth Curve
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Realized cumulative performance across active sessions</span>
              </div>
              <div className="chart-container">
                {cumulativeEquityChartData && <Line data={cumulativeEquityChartData} options={smoothEquityChartOptions} />}
              </div>
            </div>
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

            {/* Full Page Height 2-Column Grid */}
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

        {/* VIEW: STOCK ANALYSIS */}
        {currentView === 'stockAnalysis' && (
          <div>
            <div className="card">
              <div className="card-top">
                <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                  Stock-by-Stock Accumulated Metrics
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: CALENDAR HEATMAP */}
        {currentView === 'heatmap' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
              {heatmapData.map(m => (
                <div key={m.monthIndex} className="card" style={{ padding: '1rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--text-main)' }}>{m.name}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.35rem' }}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((wd, idx) => (
                      <div key={idx} style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600 }}>{wd}</div>
                    ))}
                    {m.days.map((day, dIdx) => (
                      <div
                        key={dIdx}
                        style={{
                          aspectRatio: '1',
                          borderRadius: '0.25rem',
                          backgroundColor: getHeatmapDayColor(day.dateStr),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 600,
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
                    ))}
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
                
                {/* Popover Calendar Date Picker for Import View */}
                <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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

                <textarea
                  value={pastedText}
                  onChange={handlePasteChange}
                  placeholder="Paste tab-separated broker execution logs here..."
                ></textarea>

                {/* Screenshot Attachments Dropzone */}
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

              {/* History list of saved log files */}
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
                                </span> • {stats.totalOrders} Trades
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
      </div>
    </div>
  );
}
