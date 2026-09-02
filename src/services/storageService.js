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
 * Automated Session Revision Backup Engine
 * Whenever a log file or session is edited or overwritten, creates an automatic
 * timestamped revision backup (e.g. trading_log_rev_2026-08-18_1724123456789)
 * and purges revisions older than 14 days to preserve space.
 */
export async function saveLogRevisionBackup(date, previousContent) {
  if (!date || !previousContent || typeof previousContent !== 'string') return;
  const cleanDate = date.trim();
  const timestamp = Date.now();
  const revKey = `trading_log_rev_${cleanDate}_${timestamp}`;

  try {
    localStorage.setItem(revKey, previousContent);
    console.log(`[Revision System] Saved backup revision for ${cleanDate}: ${revKey}`);
  } catch (e) {
    console.warn("[Revision System] Backup save warning:", e);
  }
}

export function cleanExpiredBackupRevisions(maxDays = 14) {
  try {
    const maxAgeMs = maxDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('trading_log_rev_')) {
        const parts = key.split('_');
        const tsStr = parts[parts.length - 1];
        const ts = parseInt(tsStr, 10);
        if (!isNaN(ts) && (now - ts > maxAgeMs)) {
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach(k => localStorage.removeItem(k));
    if (keysToRemove.length > 0) {
      console.log(`[Revision System] Purged ${keysToRemove.length} expired revision backups older than ${maxDays} days.`);
    }
  } catch (e) {
    console.warn("[Revision System] Auto-purge error:", e);
  }
}

const DELETED_SESSIONS_STORAGE_KEY = 'hammer_deleted_sessions_v1';

export function getDeletedSessionsTombstones() {
  try {
    const raw = localStorage.getItem(DELETED_SESSIONS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const now = Date.now();
    const active = {};
    for (const [date, info] of Object.entries(parsed)) {
      if (info && info.expiresAt && info.expiresAt > now) {
        active[date] = info;
      }
    }
    if (Object.keys(active).length !== Object.keys(parsed).length) {
      localStorage.setItem(DELETED_SESSIONS_STORAGE_KEY, JSON.stringify(active));
    }
    return active;
  } catch (e) {
    return {};
  }
}

export function markSessionAsDeleted(date, previousContent = null) {
  if (!date) return;
  const cleanDate = date.trim();
  const now = Date.now();
  const expiresAt = now + 14 * 24 * 60 * 60 * 1000; // 14 days retention

  const tombstones = getDeletedSessionsTombstones();
  tombstones[cleanDate] = {
    deletedAt: now,
    expiresAt,
    archivedContent: previousContent || null
  };

  try {
    localStorage.setItem(DELETED_SESSIONS_STORAGE_KEY, JSON.stringify(tombstones));
    if (previousContent) {
      localStorage.setItem(`trading_log_deleted_archived_${cleanDate}_${now}`, previousContent);
    }
  } catch (e) {
    console.warn("Error marking session as deleted tombstone:", e);
  }
}

export function unmarkSessionAsDeleted(date) {
  if (!date) return;
  const cleanDate = date.trim();
  const tombstones = getDeletedSessionsTombstones();
  if (tombstones[cleanDate]) {
    delete tombstones[cleanDate];
    localStorage.setItem(DELETED_SESSIONS_STORAGE_KEY, JSON.stringify(tombstones));
  }
}

export function getAccountLogKey(date, accountId = 'default') {
  const cleanDate = (date || '').trim();
  if (!accountId || accountId === 'default') {
    return `trading_log_${cleanDate}`;
  }
  return `trading_log_${accountId}_${cleanDate}`;
}

export function getAccountJournalKey(date, accountId = 'default') {
  const cleanDate = (date || '').trim();
  if (!accountId || accountId === 'default') {
    return `trading_journal_${cleanDate}`;
  }
  return `trading_journal_${accountId}_${cleanDate}`;
}

/**
 * Defensive Save Log - Writes to disk in Tauri and mirrors to localStorage with account namespacing
 */
export async function persistLog(date, content, accountId = 'default') {
  if (!date || typeof content !== 'string') {
    throw new Error("Invalid log data: date and content are required.");
  }

  const cleanDate = date.trim();
  const logKey = getAccountLogKey(cleanDate, accountId);
  unmarkSessionAsDeleted(cleanDate);
  
  // If an existing log exists and is being edited, save a revision backup first
  try {
    const existing = localStorage.getItem(logKey);
    if (existing && existing !== content) {
      await saveLogRevisionBackup(cleanDate, existing);
    }
  } catch (e) {}

  const tauriRes = await safeTauriInvoke("save_log", { date: cleanDate, content, accountId });
  
  try {
    localStorage.setItem(logKey, content);
  } catch (e) {
    console.warn("LocalStorage backup quota warning:", e);
  }
  return tauriRes !== null;
}

/**
 * Defensive Load All Logs for specific account
 */
export async function retrieveAllLogs(accountId = 'default') {
  let logs = {};
  if (isTauriEnvironment()) {
    try {
      const result = await safeTauriInvoke("load_all_logs", { accountId });
      if (result && typeof result === 'object' && Object.keys(result).length > 0) {
        logs = result;
      }
    } catch (e) {
      console.error("Failed to load logs from Tauri FS:", e);
    }
  }

  // Fallback / merge with LocalStorage by matching account prefix
  try {
    const isDefault = !accountId || accountId === 'default';
    const prefix = isDefault ? 'trading_log_' : `trading_log_${accountId}_`;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (isDefault) {
        // Main Account: starts with trading_log_ but NOT sub-accounts (trading_log_acc_), revisions or tombstones
        if (key.startsWith('trading_log_') && !key.startsWith('trading_log_acc_') && !key.startsWith('trading_log_rev_') && !key.startsWith('trading_log_deleted_')) {
          const date = key.slice(12);
          if (date && !logs[date]) {
            logs[date] = localStorage.getItem(key);
          }
        }
      } else {
        // Sub-Account (e.g. Premarket): starts with trading_log_acc_...
        if (key.startsWith(prefix)) {
          const date = key.slice(prefix.length);
          if (date && !logs[date]) {
            logs[date] = localStorage.getItem(key);
          }
        }
      }
    }
  } catch (e) {
    console.error("LocalStorage read error:", e);
  }

  // Enforce 14-day deleted tombstones
  const tombstones = getDeletedSessionsTombstones();
  for (const deletedDate of Object.keys(tombstones)) {
    delete logs[deletedDate];
  }

  return logs;
}

/**
 * Defensive Delete Log
 */
export async function removeLog(date, accountId = 'default') {
  if (!date) return;
  const cleanDate = date.trim();
  const logKey = getAccountLogKey(cleanDate, accountId);
  const journalKey = getAccountJournalKey(cleanDate, accountId);

  const previousContent = localStorage.getItem(logKey);
  markSessionAsDeleted(cleanDate, previousContent);

  await safeTauriInvoke("delete_log", { date: cleanDate, accountId });
  await idbDeleteSessionScreenshots(cleanDate);

  try {
    localStorage.removeItem(logKey);
    localStorage.removeItem(journalKey);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(`trading_img_${cleanDate}_`) || key.startsWith(`trading_img_${accountId}_${cleanDate}_`))) {
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
export async function loadJournalFromStorage(date, accountId = 'default') {
  if (!date) return '';
  try {
    const key = getAccountJournalKey(date, accountId);
    return localStorage.getItem(key) || '';
  } catch (e) {
    return '';
  }
}

export async function saveJournalToStorage(date, content, accountId = 'default') {
  if (!date) return;
  try {
    const key = getAccountJournalKey(date, accountId);
    localStorage.setItem(key, content || '');
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
