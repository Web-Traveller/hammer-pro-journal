import { useState, useRef, useCallback } from 'react';
import { validateLogBatch } from '../parser';
import { compressScreenshot } from '../utils/imageCompression';
import {
  saveLogToStorage,
  saveJournalToStorage,
  saveScreenshotsToStorage
} from '../services/storageService';

export function useImportHandlers({
  logs,
  setLogs,
  setSessionDate,
  setCurrentView,
  settings,
  dailyStatsMap,
  licenseCheck,
  showToast,
  onQueueSync,
  activeAccountId = 'default'
}) {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pastedText, setPastedText] = useState('');
  const [pendingScreenshots, setPendingScreenshots] = useState([]);
  const [showPreImportModal, setShowPreImportModal] = useState(false);
  const [preImportReport, setPreImportReport] = useState(null);

  // Date Picker Popover State
  const [showImportCalendar, setShowImportCalendar] = useState(false);
  const [importPopYear, setImportPopYear] = useState(new Date().getFullYear());
  const [importPopMonth, setImportPopMonth] = useState(new Date().getMonth());
  const importCalendarRef = useRef(null);

  // Global User-Selected Date Lock Flag
  const isDateManuallyLockedRef = useRef(false);

  const handleSelectImportDate = useCallback((date) => {
    if (!date) return;
    isDateManuallyLockedRef.current = true;
    setSelectedDate(date);
  }, []);

  const handlePasteChange = useCallback((eOrText) => {
    const text = (eOrText && eOrText.target && typeof eOrText.target.value === 'string')
      ? eOrText.target.value
      : (typeof eOrText === 'string' ? eOrText : '');
    const cleaned = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    setPastedText(cleaned);

    // If user has not manually locked a date and pasted text contains an explicit date, auto-detect it
    if (!isDateManuallyLockedRef.current && cleaned && cleaned.trim().length > 10) {
      const report = validateLogBatch(cleaned, selectedDate, settings?.dateFormat);
      if (report && report.hasExplicitDate && report.detectedDate) {
        setSelectedDate(report.detectedDate);
      }
    }
  }, [selectedDate, settings?.dateFormat]);

  const handleFileSelect = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    const maxAllowed = licenseCheck?.features?.max_screenshots || (licenseCheck?.status === 'trial_active' ? 1 : 999);
    if (pendingScreenshots.length + files.length > maxAllowed) {
      if (showToast) showToast(`Screenshot limit reached (${maxAllowed} per session on your plan).`, 'error');
      return;
    }
    files.forEach(async (file) => {
      try {
        const compressed = await compressScreenshot(file, 1920, 0.82);
        setPendingScreenshots(prev => [...prev, { filename: `${Date.now()}_${file.name}`, dataUrl: compressed }]);
      } catch (err) {
        if (showToast) showToast(`Failed to load ${file.name}`, 'error');
      }
    });
  }, [pendingScreenshots.length, licenseCheck, showToast]);

  const handleRemovePendingScreenshot = useCallback((index) => {
    setPendingScreenshots(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleTriggerPreImport = useCallback(() => {
    if (!pastedText.trim()) {
      if (showToast) showToast("Please paste some log content first.", "error");
      return;
    }
    const report = validateLogBatch(pastedText, selectedDate, settings?.dateFormat);
    if (!report || (!report.valid && !report.isValid)) {
      if (showToast) showToast(report?.message || "No valid trade execution fills found in pasted text.", "error");
      return;
    }
    if (!report.hasExplicitDate) {
      report.detectedDate = selectedDate;
    }
    setPreImportReport(report);
    setShowPreImportModal(true);
  }, [pastedText, selectedDate, settings?.dateFormat, showToast]);

  const handleTriggerManualPreImport = useCallback((manualData) => {
    if (!manualData || !manualData.date) {
      if (showToast) showToast("Please select a session date.", "error");
      return;
    }
    const grossPnlVal = parseFloat(manualData.grossPnl || 0);
    const totalSharesVal = parseInt(manualData.totalShares || 0, 10);
    const roundTripSharesVal = parseInt(manualData.roundTripShares || totalSharesVal, 10);
    const feeRate = settings?.enableFees ? (parseFloat(settings?.feePerShare) || 0.005) : 0;
    const dynamicFees = roundTripSharesVal * feeRate;

    const netPnlVal = (manualData.netPnl !== undefined && manualData.netPnl !== '' && !isNaN(parseFloat(manualData.netPnl)))
      ? parseFloat(manualData.netPnl)
      : (grossPnlVal - dynamicFees);
    const totalTradesVal = parseInt(manualData.totalTrades || 1, 10);
    const tickersArr = manualData.tickers
      ? manualData.tickers.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
      : [];

    const report = {
      isManualSummary: true,
      isValid: true,
      valid: true,
      detectedDate: manualData.date.trim(),
      hasExplicitDate: true,
      previewGrossPnl: grossPnlVal,
      grossPnl: grossPnlVal,
      netPnl: netPnlVal,
      previewShares: totalSharesVal,
      totalShares: totalSharesVal,
      roundTripShares: roundTripSharesVal,
      fees: dynamicFees,
      executionsCount: totalTradesVal,
      totalOrders: totalTradesVal,
      totalTrades: totalTradesVal,
      symbols: tickersArr,
      manualPayload: manualData
    };

    setPreImportReport(report);
    setShowPreImportModal(true);
  }, [showToast, settings?.enableFees, settings?.feePerShare]);

  const handleSaveManualSession = useCallback(async (manualData) => {
    if (!manualData || !manualData.date) {
      if (showToast) showToast("Please select a session date.", "error");
      return;
    }
    const sessionDateStr = manualData.date.trim();
    const grossPnl = parseFloat(manualData.grossPnl || 0);
    const totalShares = parseInt(manualData.totalShares || manualData.roundTripShares || 0, 10);
    const roundTripShares = parseInt(manualData.roundTripShares || manualData.totalShares || 0, 10);
    const totalOrders = parseInt(manualData.totalOrders || manualData.totalTrades || 1, 10);
    const tradesCount = parseInt(manualData.tradesCount || manualData.totalTrades || totalOrders, 10);

    const feeRate = settings?.enableFees ? (parseFloat(settings?.feePerShare) || 0.005) : 0;
    const dynamicFees = roundTripShares * feeRate;

    let netPnl = grossPnl - dynamicFees;
    let fees = dynamicFees;

    if (manualData.netPnl !== undefined && manualData.netPnl !== '' && !isNaN(parseFloat(manualData.netPnl)) && parseFloat(manualData.netPnl) !== grossPnl) {
      netPnl = parseFloat(manualData.netPnl);
      fees = Math.max(0, grossPnl - netPnl);
    }

    const payload = JSON.stringify({
      isManualSummary: true,
      type: 'manual_summary',
      date: sessionDateStr,
      grossPnl,
      netPnl,
      fees,
      totalShares,
      roundTripShares,
      totalOrders,
      tradesCount,
      winTradesCount: parseInt(manualData.winTradesCount || 0, 10),
      lossTradesCount: parseInt(manualData.lossTradesCount || 0, 10),
      longTrades: parseInt(manualData.longTrades || 0, 10),
      shortTrades: parseInt(manualData.shortTrades || 0, 10),
      tickers: manualData.tickers || '',
      symbols: manualData.tickers ? manualData.tickers.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : [],
      notes: manualData.notes || '',
      savedAt: new Date().toISOString()
    }, null, 2);

    try {
      await saveLogToStorage(sessionDateStr, payload, activeAccountId);
      if (pendingScreenshots.length > 0) {
        await saveScreenshotsToStorage(sessionDateStr, pendingScreenshots);
      }
      if (manualData.notes) {
        await saveJournalToStorage(sessionDateStr, manualData.notes, activeAccountId);
      }
      const updatedLogs = { ...logs, [sessionDateStr]: payload };
      setLogs(updatedLogs);
      setSessionDate(sessionDateStr);
      setPendingScreenshots([]);
      isDateManuallyLockedRef.current = false;
      if (setCurrentView) setCurrentView('singleSession');
      if (showToast) showToast(`Manual session summary saved for ${sessionDateStr}!`, "success");

      // Deferred / smart queue sync (no aggressive blocking)
      if (onQueueSync) onQueueSync(updatedLogs);
    } catch (err) {
      console.error("Error saving manual session:", err);
      if (showToast) showToast("Failed to save manual session.", "error");
    }
  }, [logs, setLogs, setSessionDate, setCurrentView, pendingScreenshots, showToast, onQueueSync, activeAccountId, settings?.enableFees, settings?.feePerShare]);

  const handleConfirmImport = useCallback(async () => {
    if (!preImportReport) return;
    if (preImportReport.isManualSummary && preImportReport.manualPayload) {
      await handleSaveManualSession(preImportReport.manualPayload);
      setShowPreImportModal(false);
      setPreImportReport(null);
      return;
    }
    const dateToUse = (preImportReport.hasExplicitDate ? preImportReport.detectedDate : selectedDate) || preImportReport.detectedDate || selectedDate;
    try {
      await saveLogToStorage(dateToUse, pastedText, activeAccountId);
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
      isDateManuallyLockedRef.current = false;
      if (setCurrentView) setCurrentView('singleSession');
      if (showToast) showToast(`Session successfully imported for ${dateToUse}!`, "success");

      // Deferred / smart queue sync
      if (onQueueSync) onQueueSync(updatedLogs);
    } catch (err) {
      console.error("Error saving verified session:", err);
      if (showToast) showToast("Failed to save session to disk.", "error");
    }
  }, [preImportReport, selectedDate, pastedText, pendingScreenshots, logs, setLogs, setSessionDate, setCurrentView, showToast, handleSaveManualSession, onQueueSync, activeAccountId]);

  return {
    selectedDate,
    setSelectedDate,
    handleSelectImportDate,
    isDateManuallyLockedRef,
    pastedText,
    setPastedText,
    pendingScreenshots,
    setPendingScreenshots,
    showPreImportModal,
    setShowPreImportModal,
    preImportReport,
    setPreImportReport,
    showImportCalendar,
    setShowImportCalendar,
    importPopYear,
    setImportPopYear,
    importPopMonth,
    setImportPopMonth,
    importCalendarRef,
    handlePasteChange,
    handleFileSelect,
    handleRemovePendingScreenshot,
    handleTriggerPreImport,
    handleTriggerManualPreImport,
    handleConfirmImport,
    handleSaveManualSession
  };
}
