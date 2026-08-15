/**
 * StorageService - Defensive Unified Persistence Layer
 * Integrates Tauri File System, IndexedDB (Screenshots), LocalStorage (Metadata),
 * Export/Restore, and Two-Tier Cross-Device Sync (Supabase & Cloud Storage).
 */

import {
  idbSaveScreenshot,
  idbLoadScreenshots,
  idbDeleteScreenshot,
  idbDeleteSessionScreenshots
} from './indexedDbService';
import { APP_VERSION } from '../version';

export function isTauriEnvironment() {
  return typeof window !== 'undefined' && (window.__TAURI_INTERNALS__ !== undefined || window.__TAURI__ !== undefined);
}

export async function safeTauriInvoke(cmd, args = {}) {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke(cmd, args);
    } catch (e) {
      console.warn(`Tauri invoke '${cmd}' failed, falling back gracefully:`, e);
    }
  }
  return null;
}

/**
 * Defensive Save Log - Writes to disk in Tauri and mirrors to localStorage
 */
export async function persistLog(date, content) {
  if (!date || typeof content !== 'string') {
    throw new Error("Invalid log data: date and content are required.");
  }

  const cleanDate = date.trim();
  const tauriRes = await safeTauriInvoke("save_log", { date: cleanDate, content });
  
  try {
    localStorage.setItem(`trading_log_${cleanDate}`, content);
  } catch (e) {
    console.warn("LocalStorage backup quota warning:", e);
  }
  return tauriRes !== null;
}

/**
 * Defensive Load All Logs
 */
export async function retrieveAllLogs() {
  let logs = {};
  if (isTauriEnvironment()) {
    try {
      const result = await safeTauriInvoke("load_all_logs");
      if (result && typeof result === 'object' && Object.keys(result).length > 0) {
        logs = result;
      }
    } catch (e) {
      console.error("Failed to load logs from Tauri FS:", e);
    }
  }

  // Fallback / merge with LocalStorage if empty or running in web sandbox
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("trading_log_")) {
        const date = key.slice(12);
        if (!logs[date]) {
          logs[date] = localStorage.getItem(key);
        }
      }
    }
  } catch (e) {
    console.error("LocalStorage read error:", e);
  }

  return logs;
}

/**
 * Defensive Delete Log
 */
export async function removeLog(date) {
  if (!date) return;
  const cleanDate = date.trim();
  await safeTauriInvoke("delete_log", { date: cleanDate });
  await idbDeleteSessionScreenshots(cleanDate);

  try {
    localStorage.removeItem(`trading_log_${cleanDate}`);
    localStorage.removeItem(`trading_journal_${cleanDate}`);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`trading_img_${cleanDate}_`)) {
        localStorage.removeItem(key);
      }
    }
  } catch (e) {
    console.error("Storage delete cleanup error:", e);
  }
}

/**
 * High-Capacity Screenshot Persistence (Tauri Disk / IndexedDB)
 */
export async function loadScreenshotsFromStorage(date) {
  if (!date) return [];
  const cleanDate = date.trim();

  // 1. Try Tauri Disk Storage
  if (isTauriEnvironment()) {
    try {
      const result = await safeTauriInvoke("load_session_screenshots", { date: cleanDate });
      if (Array.isArray(result) && result.length > 0) {
        return result;
      }
    } catch (e) {
      console.warn("Tauri screenshot load fallback:", e);
    }
  }

  // 2. Try IndexedDB
  const idbImgs = await idbLoadScreenshots(cleanDate);
  if (idbImgs && idbImgs.length > 0) {
    return idbImgs;
  }

  // 3. Fallback to LocalStorage legacy
  try {
    const legacy = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`trading_img_${cleanDate}_`)) {
        const filename = key.replace(`trading_img_${cleanDate}_`, '');
        legacy.push({ filename, dataUrl: localStorage.getItem(key) });
      }
    }
    return legacy;
  } catch (e) {
    return [];
  }
}

export async function saveScreenshotsToStorage(date, screenshots) {
  if (!date || !Array.isArray(screenshots)) return;
  const cleanDate = date.trim();

  for (const img of screenshots) {
    if (!img || !img.filename || !img.dataUrl) continue;
    
    // In Tauri, save directly to disk
    if (isTauriEnvironment()) {
      await safeTauriInvoke("save_screenshot", {
        date: cleanDate,
        filename: img.filename,
        dataUrl: img.dataUrl
      });
    }

    // Also persist in IndexedDB for resilience
    await idbSaveScreenshot(cleanDate, img.filename, img.dataUrl);
  }
}

export async function deleteScreenshotFromStorage(date, filename) {
  if (!date || !filename) return;
  const cleanDate = date.trim();

  if (isTauriEnvironment()) {
    const finalName = filename.startsWith(`${cleanDate}_`) ? filename : `${cleanDate}_img_${filename}`;
    await safeTauriInvoke("delete_screenshot", { filename: finalName });
  }

  await idbDeleteScreenshot(cleanDate, filename);

  try {
    localStorage.removeItem(`trading_img_${cleanDate}_${filename}`);
  } catch (e) {}
}

/**
 * Journal Notes Persistence
 */
export async function loadJournalFromStorage(date) {
  if (!date) return '';
  try {
    return localStorage.getItem(`trading_journal_${date.trim()}`) || '';
  } catch (e) {
    return '';
  }
}

export async function saveJournalToStorage(date, content) {
  if (!date) return;
  try {
    localStorage.setItem(`trading_journal_${date.trim()}`, content || '');
  } catch (e) {
    console.error("Failed to save journal:", e);
  }
}

/**
 * Settings Persistence
 */
export async function loadSettingsFromStorage() {
  try {
    const raw = localStorage.getItem("trading_settings");
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export async function saveSettingsToStorage(settings) {
  try {
    localStorage.setItem("trading_settings", JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save settings:", e);
  }
}

/**
 * Generate full backup snapshot
 */
export async function createFullBackupSnapshot() {
  const allLogs = await retrieveAllLogs();
  const journals = {};
  const screenshots = {};
  const settings = JSON.parse(localStorage.getItem("trading_settings") || "{}");

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith("trading_journal_")) {
      journals[key] = localStorage.getItem(key);
    }
  }

  // Collect screenshots from IndexedDB and Tauri
  const dates = Object.keys(allLogs);
  for (const d of dates) {
    const imgs = await loadScreenshotsFromStorage(d);
    if (imgs.length > 0) {
      screenshots[d] = imgs;
    }
  }

  return {
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    logs: allLogs,
    journals,
    screenshots,
    settings
  };
}

/**
 * Validates and restores a full backup snapshot safely
 */
export async function restoreBackupSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error("Invalid backup file: snapshot must be a valid JSON object.");
  }
  if (!snapshot.logs || typeof snapshot.logs !== 'object') {
    throw new Error("Invalid backup file: missing trading logs.");
  }

  // Restore Logs
  for (const [date, content] of Object.entries(snapshot.logs)) {
    if (date && typeof content === 'string') {
      await persistLog(date, content);
    }
  }

  // Restore Journals (Safe namespace verification)
  if (snapshot.journals && typeof snapshot.journals === 'object') {
    for (const [k, v] of Object.entries(snapshot.journals)) {
      if (typeof k === 'string' && k.startsWith("trading_journal_") && typeof v === 'string') {
        localStorage.setItem(k, v);
      }
    }
  }

  // Restore Screenshots
  if (snapshot.screenshots && typeof snapshot.screenshots === 'object') {
    for (const [date, imgs] of Object.entries(snapshot.screenshots)) {
      if (date && Array.isArray(imgs)) {
        await saveScreenshotsToStorage(date, imgs);
      }
    }
  }

  // Restore Settings
  if (snapshot.settings && typeof snapshot.settings === 'object') {
    localStorage.setItem("trading_settings", JSON.stringify(snapshot.settings));
  }

  return true;
}

/**
 * Personal Google Drive Cloud Backup (Zero-Cost / BYOC)
 */
export async function uploadToGoogleDrive(accessToken, folderId, snapshotData) {
  if (!accessToken) throw new Error("Google OAuth Access Token is required.");
  
  const metadata = {
    name: `HammerPro_Backup_${new Date().toISOString().slice(0, 10)}.json`,
    mimeType: 'application/json'
  };
  if (folderId) {
    metadata.parents = [folderId];
  }

  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelim = "\r\n--" + boundary + "--";

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(snapshotData) +
    closeDelim;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Drive upload failed (${res.status}): ${errText}`);
  }

  return await res.json();
}

// Aliases
export const loadLogsFromStorage = retrieveAllLogs;
export const saveLogToStorage = persistLog;
export const deleteLogFromStorage = removeLog;
