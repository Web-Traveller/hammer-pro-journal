import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Maximize2
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
      if (key.startsWith("trading_log_")) {
        const date = key.slice(12);
        logs[date] = localStorage.getItem(key);
      }
    }
    return logs;
  } else if (cmd === "delete_log") {
    localStorage.removeItem(`trading_log_${args.date}`);
    // Clear screenshots for this date
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

export default function App() {
  const [logs, setLogs] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' as primary entry point
  const [pastedText, setPastedText] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [selectedStockSymbol, setSelectedStockSymbol] = useState(null);
  const [sessionTab, setSessionTab] = useState('stocks'); // 'stocks', 'ecn', 'raw'
  const [copied, setCopied] = useState(false);

  // Screenshots state
  const [pendingScreenshots, setPendingScreenshots] = useState([]); // Base64 data URLs for new import
  const [sessionScreenshots, setSessionScreenshots] = useState([]); // Base64 data URLs loaded for current session
  const [activeLightboxImg, setActiveLightboxImg] = useState(null); // Lightbox preview data URL

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

  // Outside click listener for calendar popovers
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

  // Load logs on startup
  useEffect(() => {
    loadLogsFromBackend();
  }, []);

  // Load session screenshots whenever sessionDate changes
  useEffect(() => {
    if (sessionDate) {
      loadSessionScreenshots(sessionDate);
    }
  }, [sessionDate]);

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

  // Auto-detect date on log pasting
  const handlePasteChange = (e) => {
    const text = e.target.value;
    setPastedText(text);
    const m = text.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
    if (m) {
      let [_, month, day, year] = m;
      if (year.length === 2) year = "20" + year;
      const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      setSelectedDate(formattedDate);
    }
  };

  // Screenshot File Input Handler
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
      alert("Please paste some log content first.");
      return;
    }
    try {
      // 1. Save raw text log file
      await safeInvoke("save_log", { date: selectedDate, content: pastedText });
      
      // 2. Save screenshot image files on disk (<date>_img_1.png, <date>_img_2.png, etc.)
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
      alert(`Log and ${pendingScreenshots.length} screenshot(s) saved successfully for ${selectedDate}`);
    } catch (e) {
      alert(`Error saving log: ${e}`);
    }
  };

  const handleDeleteLog = async (date) => {
    if (!confirm(`Are you sure you want to delete logs and screenshots for ${date}?`)) return;
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
    } catch (e) {
      alert(`Error deleting log: ${e}`);
    }
  };

  const handleDeleteSessionScreenshot = async (filename) => {
    if (!confirm("Are you sure you want to delete this screenshot?")) return;
    try {
      await safeInvoke("delete_screenshot", { filename });
      loadSessionScreenshots(sessionDate);
    } catch (e) {
      alert(`Error deleting screenshot: ${e}`);
    }
  };

  const handleCopyRawLog = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Global Analytics compilation
  const { allExecutions, allTrades, dailyStatsMap, overallAnalytics, globalECNAnalytics } = useMemo(() => {
    let executions = [];
    const statsMap = {};
    
    Object.keys(logs).forEach(date => {
      const dayExecs = extractExecutions(logs[date]);
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

  // Single Session Specific Analytics
  const singleSessionAnalytics = useMemo(() => {
    if (!sessionDate || !logs[sessionDate]) return null;
    const dayExecs = extractExecutions(logs[sessionDate]);
    return compileSingleDayAnalytics(dayExecs);
  }, [sessionDate, logs]);

  const formatHoldTime = (seconds) => {
    if (!seconds || seconds <= 0) return '0s';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  // Intraday Realized P&L Equity Chart Data (Trade-by-Trade, Smooth, 9:30 AM - 4:00 PM Range, Subtle Dots)
  const singleSessionChartData = useMemo(() => {
    if (!singleSessionAnalytics || !singleSessionAnalytics.intradayEquityCurve) return null;
    const points = singleSessionAnalytics.intradayEquityCurve;
    return {
      labels: points.map(p => p.timeLabel),
      datasets: [
        {
          label: 'Realized Cumulative P&L ($)',
          data: points.map(p => p.execPnl),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          borderWidth: 2.2,
          fill: true,
          tension: 0.4,
          pointRadius: 1.5, // Small subtle reference point
          pointBackgroundColor: '#10b981',
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#064e3b',
          pointHoverBorderColor: '#10b981',
          pointHoverBorderWidth: 2
        }
      ]
    };
  }, [singleSessionAnalytics]);

  const smoothIntradayChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
            const raw = singleSessionAnalytics.intradayEquityCurve[context.dataIndex];
            if (raw.symbol === 'OPEN') return 'Session Open (9:30 AM): $0.00';
            const tradePnlStr = (raw.tradePnl >= 0 ? '+' : '') + '$' + raw.tradePnl.toFixed(2);
            const totalStr = (raw.execPnl >= 0 ? '+' : '') + '$' + raw.execPnl.toFixed(2);
            return [
              `Trade: ${raw.symbol} (${raw.side === 'B' ? 'Long' : 'Short'} ${raw.qty} shs)`,
              `Realized Trade P&L: ${tradePnlStr}`,
              `Cumulative Day P&L: ${totalStr}`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: '#6b7280',
          font: { size: 11, weight: '600' },
          maxTicksLimit: 9, // Evenly spaced interval ticks spanning 9:30 AM to 4:00 PM
          autoSkip: true,
          maxRotation: 0
        }
      },
      y: {
        grid: { display: false },
        ticks: { color: '#6b7280', font: { size: 11, weight: '600' } }
      }
    }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#6b7280', font: { size: 11 } } },
      y: { grid: { display: false }, ticks: { color: '#6b7280', font: { size: 11 } } }
    }
  };

  // ECN vs Darkpool Volume Doughnut Chart
  const darkpoolVolumeChartData = {
    labels: ['ECN Volume', 'Darkpool Volume'],
    datasets: [
      {
        data: [globalECNAnalytics.litVolume, globalECNAnalytics.darkpoolVolume],
        backgroundColor: ['#10b981', '#6b21a8'],
        borderWidth: 0
      }
    ]
  };

  // Global Equity Chart Data
  const equityChartData = {
    labels: overallAnalytics.equityCurve.map(e => e.date),
    datasets: [
      {
        label: 'Cumulative P&L ($)',
        data: overallAnalytics.equityCurve.map(e => e.cumulativePnl),
        borderColor: '#064e3b',
        backgroundColor: 'rgba(6, 78, 59, 0.06)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: '#10b981'
      }
    ]
  };

  // Helper for popover calendar grid
  const getCalendarPopoverGrid = (year, month) => {
    const monthDays = new Date(year, month + 1, 0).getDate();
    const startDay = new Date(year, month, 1).getDay();
    const days = [];
    for (let i = 0; i < startDay; i++) {
      days.push({ dayNum: null, dateStr: null });
    }
    for (let d = 1; d <= monthDays; d++) {
      const mmStr = (month + 1).toString().padStart(2, '0');
      const ddStr = d.toString().padStart(2, '0');
      const dateStr = `${year}-${mmStr}-${ddStr}`;
      days.push({ dayNum: d, dateStr });
    }
    return days;
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Calendar Heatmap for 2026
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

  return (
    <div style={{ display: 'flex', width: '100%' }}>
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
          <span>HAMMER PRO JOURNAL</span>
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

        {/* Minimal Subtle Developer Credit */}
        <div className="sidebar-footer-credit">
          by Ajinkya
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
              {currentView === 'singleSession' && 'Intraday trade P&L curve, screenshots, Darkpool entries/exits, and stock fills'}
              {currentView === 'dashboard' && 'Accumulated performance, equity growth, and trading metrics'}
              {currentView === 'ecnAnalytics' && 'ECN vs. Darkpool liquidity analysis and venue breakdown'}
              {currentView === 'stockAnalysis' && 'Performance distribution, volume, and holding times per symbol'}
              {currentView === 'heatmap' && 'Calendar view of daily return density for 2026'}
              {currentView === 'pasteLogs' && 'Paste raw broker execution logs and attach screenshots to save them on disk'}
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
                {/* Session Stat Cards Row */}
                <div className="grid-cards">
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

                  <div className="card">
                    <div className="card-top">
                      <span className="card-title">Fills / Orders</span>
                      <button className="card-icon-btn"><Activity size={16} /></button>
                    </div>
                    <div className="card-value">
                      {singleSessionAnalytics.totalFills} / {singleSessionAnalytics.totalOrders}
                    </div>
                    <span className="card-footer-tag" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
                      {singleSessionAnalytics.totalBoughtQty} Shares Volume
                    </span>
                  </div>

                  <div className="card">
                    <div className="card-top">
                      <span className="card-title">Long Trades</span>
                      <button className="card-icon-btn"><TrendingUp size={16} color="var(--emerald)" /></button>
                    </div>
                    <div className="card-value" style={{ color: singleSessionAnalytics.longStats.pnl >= 0 ? 'var(--hero-green)' : 'var(--rose-text)' }}>
                      {singleSessionAnalytics.longStats.pnl >= 0 ? '+' : ''}${singleSessionAnalytics.longStats.pnl.toFixed(2)}
                    </div>
                    <span className="card-footer-tag tag-profit">
                      {singleSessionAnalytics.longStats.count} Long Trades
                    </span>
                  </div>

                  <div className="card">
                    <div className="card-top">
                      <span className="card-title">Short Trades</span>
                      <button className="card-icon-btn"><TrendingDown size={16} color="var(--rose-accent)" /></button>
                    </div>
                    <div className="card-value" style={{ color: singleSessionAnalytics.shortStats.pnl >= 0 ? 'var(--hero-green)' : 'var(--rose-text)' }}>
                      {singleSessionAnalytics.shortStats.pnl >= 0 ? '+' : ''}${singleSessionAnalytics.shortStats.pnl.toFixed(2)}
                    </div>
                    <span className="card-footer-tag tag-loss">
                      {singleSessionAnalytics.shortStats.count} Short Trades
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
                      <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ImageIcon size={18} color="var(--hero-green)" /> Screenshots ({sessionScreenshots.length})
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Click thumbnail to inspect full-screen</span>
                    </div>
                    <div className="screenshot-grid">
                      {sessionScreenshots.map((img, idx) => (
                        <div key={idx} className="screenshot-card" onClick={() => setActiveLightboxImg(img.dataUrl)}>
                          <img src={img.dataUrl} alt={`Session Screenshot ${idx + 1}`} />
                          <button
                            className="delete-btn"
                            title="Delete Screenshot"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSessionScreenshot(img.filename);
                            }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tabs Area: Stock Breakdown, ECN Routes, Raw Log */}
                <div className="card">
                  <div className="tab-bar">
                    <button className={`tab-btn ${sessionTab === 'stocks' ? 'active' : ''}`} onClick={() => setSessionTab('stocks')}>
                      Stock Breakdown ({singleSessionAnalytics.stockBreakdown.length})
                    </button>
                    <button className={`tab-btn ${sessionTab === 'ecn' ? 'active' : ''}`} onClick={() => setSessionTab('ecn')}>
                      ECN & Darkpools
                    </button>
                    <button className={`tab-btn ${sessionTab === 'raw' ? 'active' : ''}`} onClick={() => setSessionTab('raw')}>
                      Verbatim Raw Log
                    </button>
                  </div>

                  {/* TAB 1: Stock Breakdown */}
                  {sessionTab === 'stocks' && (
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Symbol</th>
                            <th>Day Realized P&L ($)</th>
                            <th>Volume (Shares)</th>
                            <th>Trades</th>
                            <th>Avg Hold Time</th>
                            <th>Darkpools Used</th>
                            <th>Fills Inspection</th>
                          </tr>
                        </thead>
                        <tbody>
                          {singleSessionAnalytics.stockBreakdown.map((stock, idx) => (
                            <React.Fragment key={idx}>
                              <tr className="clickable-row" onClick={() => setSelectedStockSymbol(selectedStockSymbol === stock.symbol ? null : stock.symbol)}>
                                <td style={{ fontWeight: 800, color: 'var(--text-main)' }}>{stock.symbol}</td>
                                <td style={{ fontWeight: 800, color: stock.pnl >= 0 ? 'var(--hero-green)' : 'var(--rose-text)' }}>
                                  {stock.pnl >= 0 ? '+' : ''}${stock.pnl.toFixed(2)}
                                </td>
                                <td>{stock.totalQty}</td>
                                <td>{stock.tradesCount}</td>
                                <td>{formatHoldTime(stock.avgHoldTime)}</td>
                                <td>
                                  {stock.entryDarkpools.concat(stock.exitDarkpools).length > 0 ? (
                                    Array.from(new Set(stock.entryDarkpools.concat(stock.exitDarkpools))).map(dp => (
                                      <span key={dp} className="badge badge-darkpool" style={{ marginRight: '0.25rem' }}>{dp}</span>
                                    ))
                                  ) : (
                                    <span style={{ color: 'var(--text-light)', fontSize: '0.8rem' }}>Lit ECNs Only</span>
                                  )}
                                </td>
                                <td style={{ color: 'var(--hero-green)', fontWeight: 700 }}>
                                  {selectedStockSymbol === stock.symbol ? 'Hide Fills' : 'View Fills'}
                                </td>
                              </tr>
                              {selectedStockSymbol === stock.symbol && (
                                <tr>
                                  <td colSpan="7" style={{ padding: '1rem', backgroundColor: '#f9fafb' }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                                      EXECUTION FILLS FOR {stock.symbol} ({sessionDate}):
                                    </div>
                                    <table style={{ width: '100%', backgroundColor: '#ffffff', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                                      <thead>
                                        <tr>
                                          <th>Timestamp</th>
                                          <th>Side</th>
                                          <th>Fill Details</th>
                                          <th>Venue Route</th>
                                          <th>Order Instructions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {stock.executions.map((exec, eIdx) => {
                                          const dark = isDarkpool(exec.route);
                                          return (
                                            <tr key={eIdx}>
                                              <td>{exec.timestamp}</td>
                                              <td>
                                                <span className={`badge ${exec.action === 'Bought' ? 'badge-long' : 'badge-short'}`}>
                                                  {exec.action === 'Bought' ? 'BUY' : 'SELL'}
                                                </span>
                                              </td>
                                              <td style={{ fontWeight: 700 }}>{exec.execQty} shares @ ${exec.execPrice}</td>
                                              <td>
                                                <span className={`badge ${dark ? 'badge-darkpool' : 'badge-route'}`}>
                                                  {exec.route} {dark ? '(Darkpool)' : ''}
                                                </span>
                                              </td>
                                              <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{exec.orderDesc}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* TAB 2: ECN & Darkpool Fills */}
                  {sessionTab === 'ecn' && (
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Venue Route</th>
                            <th>Venue Type</th>
                            <th>Fills Count</th>
                            <th>Routed Volume (Shares)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {singleSessionAnalytics.ecnBreakdown.map((item, idx) => (
                            <tr key={idx}>
                              <td>
                                <span className={`badge ${item.isDarkpool ? 'badge-darkpool' : 'badge-route'}`}>
                                  {item.route}
                                </span>
                              </td>
                              <td style={{ fontWeight: 700, color: item.isDarkpool ? 'var(--purple-text)' : 'var(--blue-text)' }}>
                                {item.isDarkpool ? 'Darkpool Liquidity' : 'ECN Exchange'}
                              </td>
                              <td>{item.fills}</td>
                              <td style={{ fontWeight: 700 }}>{item.volume} shares</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* TAB 3: Verbatim Raw Log */}
                  {sessionTab === 'raw' && (
                    <div style={{ position: 'relative' }}>
                      <div className="raw-log-box">
                        <button className="copy-btn" onClick={() => handleCopyRawLog(logs[sessionDate])}>
                          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy Raw Text'}
                        </button>
                        {logs[sessionDate]}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No session selected or saved yet. Click "+ Import Session" to paste daily logs.
              </div>
            )}
          </div>
        )}

        {/* VIEW: ECN & DARKPOOL ANALYTICS */}
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
                  {globalECNAnalytics.litPct.toFixed(1)}% ECN Market Share
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
                  {globalECNAnalytics.darkpoolPct.toFixed(1)}% Darkpool Share
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
                              <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{item.pctVolume.toFixed(1)}%</span>
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

        {/* VIEW: DASHBOARD */}
        {currentView === 'dashboard' && (
          <div>
            <div className="grid-cards">
              <div className="card card-hero">
                <div className="card-top">
                  <span className="card-title">Accumulated Net Return</span>
                  <button className="card-icon-btn"><ArrowUpRight size={16} /></button>
                </div>
                <div className="card-value">
                  {overallAnalytics.totalPnl >= 0 ? '+' : ''}${overallAnalytics.totalPnl.toFixed(2)}
                </div>
                <span className="card-footer-tag tag-profit">
                  {overallAnalytics.totalTrades} Total Trades
                </span>
              </div>

              <div className="card">
                <div className="card-top">
                  <span className="card-title">Profit Factor</span>
                  <button className="card-icon-btn"><TrendingUp size={16} /></button>
                </div>
                <div className="card-value">
                  {overallAnalytics.profitFactor.toFixed(2)}
                </div>
                <span className="card-footer-tag tag-profit">Gross Profits / Gross Losses</span>
              </div>

              <div className="card">
                <div className="card-top">
                  <span className="card-title">Win Rate</span>
                  <button className="card-icon-btn"><Percent size={16} /></button>
                </div>
                <div className="card-value">
                  {overallAnalytics.winRate.toFixed(1)}%
                </div>
                <span className="card-footer-tag tag-profit">{overallAnalytics.totalTrades} Trades</span>
              </div>

              <div className="card">
                <div className="card-top">
                  <span className="card-title">Avg Holding Time</span>
                  <button className="card-icon-btn"><Clock size={16} /></button>
                </div>
                <div className="card-value">
                  {formatHoldTime(overallAnalytics.avgHoldTime)}
                </div>
                <span className="card-footer-tag" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
                  Entry to Exit Fills
                </span>
              </div>
            </div>

            <div className="row-2-col">
              <div className="card">
                <div className="card-top">
                  <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                    Cumulative Equity Curve
                  </span>
                </div>
                <div className="chart-container">
                  <Line data={equityChartData} options={chartOptions} />
                </div>
              </div>

              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                  Stock Leaderboard
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flexGrow: 1 }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--hero-green)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      Top Performers
                    </div>
                    {overallAnalytics.tickerStats.filter(t => t.pnl > 0).slice(0, 3).map(t => (
                      <div key={t.symbol} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border-light)' }}>
                        <span style={{ fontWeight: 700 }}>{t.symbol}</span>
                        <span style={{ color: 'var(--hero-green)', fontWeight: 700 }}>+${t.pnl.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--rose-text)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      Underperformers
                    </div>
                    {overallAnalytics.tickerStats.filter(t => t.pnl < 0).slice(0, 3).map(t => (
                      <div key={t.symbol} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border-light)' }}>
                        <span style={{ fontWeight: 700 }}>{t.symbol}</span>
                        <span style={{ color: 'var(--rose-text)', fontWeight: 700 }}>-${Math.abs(t.pnl).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: STOCK ANALYSIS */}
        {currentView === 'stockAnalysis' && (
          <div>
            <div className="card">
              <div className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700, marginBottom: '1rem' }}>
                Stock Symbol Performance
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Net Return P&L</th>
                      <th>Total Trades</th>
                      <th>Win Rate</th>
                      <th>Shares Volume</th>
                      <th>Avg Hold Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overallAnalytics.tickerStats.map((stat, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 800, color: 'var(--text-main)' }}>{stat.symbol}</td>
                        <td style={{ fontWeight: 800, color: stat.pnl >= 0 ? 'var(--hero-green)' : 'var(--rose-text)' }}>
                          {stat.pnl >= 0 ? '+' : ''}${stat.pnl.toFixed(2)}
                        </td>
                        <td>{stat.tradesCount}</td>
                        <td>{stat.winRate.toFixed(1)}%</td>
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
                  Paste Raw Broker Log & Attach Screenshots
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
