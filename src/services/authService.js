/**
 * AuthService & Live Supabase + Cloudflare R2 Multi-Account Sync Manager
 * Supports:
 * 1. Live Supabase Authentication & User Profiles Table Sync
 * 2. Multi-Account Database Sync (syncUserAccounts) with Supabase user_accounts table
 * 3. Master Journal Snapshot (1-file instant boot for cross-device sync per account)
 * 4. Two-Way Cross-Device Sync (Strictly scoped under users/{userId}/{accountId}/...)
 * 5. Isolated Account-Scoped Checksum Hashes (user_accounts.snapshot_hash)
 * 6. Non-Destructive Soft-Deletion & Account-Isolated Tombstones
 */

import { supabase } from './supabaseClient.js';
import {
  retrieveAllLogs,
  persistLog,
  loadJournalFromStorage,
  saveJournalToStorage,
  loadScreenshotsFromStorage,
  saveScreenshotsToStorage,
  loadSettingsFromStorage,
  getDeletedSessionsTombstones,
  markSessionAsDeleted,
  retrieveAccountsConfig,
  persistAccountsConfig
} from './storageService.js';
import {
  uploadMasterSnapshot,
  downloadMasterSnapshot,
  uploadRawLogToCloud,
  downloadRawLogFromCloud,
  uploadScreenshotToCloud,
  downloadScreenshotFromCloud,
  listSessionScreenshotsFromCloud
} from './r2StorageService.js';
import { parseLogFile } from '../parser.js';
import { computeContentHash } from '../utils/checksum.js';
import { APP_VERSION } from '../version.js';

const AUTH_STORAGE_KEY = 'hammer_user_profile';

const DEFAULT_ACCOUNTS = [
  { id: 'default', name: 'Main Account', color: '#10b981', broker: 'Alaric', notes: 'Market Hours' }
];

// Pub/Sub listeners for header/sidebar sync indicators
const syncListeners = new Set();

export function subscribeSyncStatus(listener) {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

function notifySyncStatus(status, message = '', extra = {}) {
  const payload = { status, message, timestamp: Date.now(), ...extra };
  syncListeners.forEach(fn => {
    try { fn(payload); } catch (e) {}
  });
}

/**
 * Get active user profile
 */
export function getActiveUserProfile() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/**
 * Persist user profile locally
 */
export function saveActiveUserProfile(profile, broadcast = true) {
  try {
    if (!profile) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } else {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile));
    }
    if (broadcast) {
      notifySyncStatus(profile ? 'synced' : 'local_only', 'Profile updated', { profile });
    }
  } catch (e) {
    console.error('Error saving user profile:', e);
  }
}

/**
 * Step 2: Database Schema & Account Sync
 * Syncs user accounts between Supabase user_accounts table and local storage (accounts.json / localStorage).
 * Merges remote and local accounts, favoring the newest data, upserts missing accounts to Supabase,
 * and saves the merged list locally.
 */
export async function syncUserAccounts(userId) {
  if (!userId) {
    const local = await retrieveAccountsConfig();
    return (Array.isArray(local) && local.length > 0) ? local : DEFAULT_ACCOUNTS;
  }

  try {
    // 1. Load local accounts
    const localRaw = await retrieveAccountsConfig();
    const localAccounts = (Array.isArray(localRaw) && localRaw.length > 0) ? localRaw : [...DEFAULT_ACCOUNTS];

    // 2. Fetch remote accounts from Supabase user_accounts
    const { data: remoteAccounts, error: fetchErr } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('user_id', userId);

    if (fetchErr) {
      console.warn('[Account Sync] Note querying user_accounts:', fetchErr.message);
      return localAccounts;
    }

    const mergedMap = new Map();
    const accountsToPush = [];

    // Index local accounts
    for (const loc of localAccounts) {
      const accId = loc.id || 'default';
      mergedMap.set(accId, {
        id: accId,
        name: loc.name || 'Main Account',
        color: loc.color || '#10b981',
        broker: loc.broker || '',
        notes: loc.notes || '',
        createdAt: loc.createdAt || new Date().toISOString(),
        updatedAt: loc.updatedAt || new Date().toISOString(),
        snapshot_hash: loc.snapshot_hash || null,
        _isLocalOnly: true
      });
    }

    // Merge remote accounts
    if (Array.isArray(remoteAccounts)) {
      for (const rem of remoteAccounts) {
        const accId = rem.account_id || rem.id || 'default';
        const existingLocal = mergedMap.get(accId);

        if (!existingLocal) {
          // New remote account not in local
          mergedMap.set(accId, {
            id: accId,
            name: rem.name || 'Account',
            color: rem.color || '#3b82f6',
            broker: rem.broker || '',
            notes: rem.notes || '',
            snapshot_hash: rem.snapshot_hash || null,
            createdAt: rem.created_at || new Date().toISOString(),
            updatedAt: rem.updated_at || rem.last_synced_at || new Date().toISOString()
          });
        } else {
          // Account exists on both sides: compare timestamps
          const localTime = new Date(existingLocal.updatedAt || existingLocal.createdAt || 0).getTime();
          const remoteTime = new Date(rem.updated_at || rem.last_synced_at || 0).getTime();

          if (remoteTime > localTime) {
            // Remote is newer: adopt remote
            mergedMap.set(accId, {
              id: accId,
              name: rem.name || existingLocal.name,
              color: rem.color || existingLocal.color,
              broker: rem.broker ?? existingLocal.broker,
              notes: rem.notes ?? existingLocal.notes,
              snapshot_hash: rem.snapshot_hash || existingLocal.snapshot_hash,
              createdAt: rem.created_at || existingLocal.createdAt,
              updatedAt: rem.updated_at || existingLocal.updatedAt
            });
          } else if (localTime > remoteTime) {
            // Local is newer: keep local and push update to remote
            existingLocal._needsPush = true;
          }
          existingLocal._isLocalOnly = false;
        }
      }
    }

    // Determine which accounts must be pushed to Supabase
    const mergedList = Array.from(mergedMap.values()).map(acc => {
      if (acc._isLocalOnly || acc._needsPush) {
        accountsToPush.push(acc);
      }
      const { _isLocalOnly, _needsPush, ...cleanAcc } = acc;
      return cleanAcc;
    });

    // Ensure 'default' account always exists
    if (!mergedList.some(a => a.id === 'default')) {
      mergedList.unshift(DEFAULT_ACCOUNTS[0]);
      accountsToPush.push(DEFAULT_ACCOUNTS[0]);
    }

    // 3. Upsert local-only or newer local accounts to Supabase
    if (accountsToPush.length > 0) {
      const rowsToUpsert = accountsToPush.map(acc => ({
        user_id: userId,
        account_id: acc.id,
        name: acc.name,
        color: acc.color,
        broker: acc.broker || '',
        notes: acc.notes || '',
        snapshot_hash: acc.snapshot_hash || null,
        last_synced_at: new Date().toISOString(),
        updated_at: acc.updatedAt || new Date().toISOString()
      }));

      try {
        await supabase
          .from('user_accounts')
          .upsert(rowsToUpsert, { onConflict: 'user_id,account_id' });
      } catch (pushErr) {
        console.warn('[Account Sync] Note upserting accounts:', pushErr);
      }
    }

    // 4. Save merged list locally to disk and localStorage
    await persistAccountsConfig(mergedList);
    return mergedList;
  } catch (err) {
    console.error('[Account Sync] Unexpected error:', err);
    const fallback = await retrieveAccountsConfig();
    return (Array.isArray(fallback) && fallback.length > 0) ? fallback : DEFAULT_ACCOUNTS;
  }
}

/**
 * Sign Up with Live Supabase Auth & Create Profile in user_profiles Table
 */
export async function signUpUser(arg1, arg2, arg3, options = {}) {
  let cleanName = '';
  let cleanEmail = '';
  let password = '';

  if (typeof arg1 === 'string' && arg1.includes('@')) {
    cleanEmail = arg1.trim().toLowerCase();
    password = arg2 ? String(arg2) : '';
    cleanName = (arg3 ? String(arg3) : cleanEmail.split('@')[0]).trim();
  } else {
    cleanName = arg1 ? String(arg1).trim() : '';
    cleanEmail = arg2 ? String(arg2).trim().toLowerCase() : '';
    password = arg3 ? String(arg3) : '';
  }

  if (!cleanName && cleanEmail.includes('@')) {
    cleanName = cleanEmail.split('@')[0];
  }

  if (!cleanEmail || !password) {
    throw new Error('Email and password are required.');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    throw new Error('Please enter a valid email address.');
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password: password,
    options: {
      data: {
        name: cleanName
      }
    }
  });

  if (error) {
    throw new Error(error.message);
  }

  const user = data.user;
  if (!user) {
    throw new Error('Registration failed. Please verify your email.');
  }

  const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`;

  try {
    await supabase.from('user_profiles').upsert({
      id: user.id,
      name: cleanName,
      email: cleanEmail,
      plan_tier: 'free',
      can_cloud_sync: false,
      daily_image_limit: 0,
      is_blocked: false,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString()
    });
  } catch (profileErr) {
    console.warn('user_profiles insert note:', profileErr);
  }

  const newProfile = {
    id: user.id,
    name: cleanName,
    email: cleanEmail,
    planTier: 'free',
    canCloudSync: false,
    dailyImageLimit: 0,
    isBlocked: false,
    avatarUrl,
    createdAt: user.created_at || new Date().toISOString(),
    lastSyncTimestamp: Date.now(),
    cloudProvider: options.cloudProvider || 'supabase_cloud'
  };

  saveActiveUserProfile(newProfile);
  try { await syncUserAccounts(user.id); } catch (e) {}
  return newProfile;
}

/**
 * Sign In with Live Supabase Auth & Fetch Profile
 */
export async function signInUser(email, password) {
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }

  const cleanEmail = email.trim().toLowerCase();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: password
  });

  if (error) {
    throw new Error(error.message);
  }

  const user = data.user;
  if (!user) {
    throw new Error('Invalid email or password.');
  }

  let profileName = user.user_metadata?.name || cleanEmail.split('@')[0];
  let planTier = user.user_metadata?.planTier || 'free';
  let canCloudSync = false;
  let dailyImageLimit = 0;
  let isBlocked = false;
  let avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`;

  try {
    const { data: dbProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (dbProfile) {
      if (dbProfile.name) profileName = dbProfile.name;
      if (dbProfile.plan_tier) planTier = dbProfile.plan_tier;
      if (dbProfile.avatar_url) avatarUrl = dbProfile.avatar_url;
      canCloudSync = dbProfile.can_cloud_sync ?? false;
      dailyImageLimit = dbProfile.daily_image_limit ?? 0;
      isBlocked = dbProfile.is_blocked ?? false;
    } else {
      await supabase.from('user_profiles').upsert({
        id: user.id,
        name: profileName,
        email: cleanEmail,
        plan_tier: planTier,
        can_cloud_sync: false,
        daily_image_limit: 0,
        is_blocked: false,
        avatar_url: avatarUrl
      });
    }
  } catch (e) {
    console.warn('Profile fetch note:', e);
  }

  const profile = {
    id: user.id,
    name: profileName,
    email: cleanEmail,
    planTier,
    canCloudSync,
    dailyImageLimit,
    isBlocked,
    avatarUrl,
    createdAt: user.created_at || new Date().toISOString(),
    lastSyncTimestamp: Date.now(),
    cloudProvider: 'supabase_cloud'
  };

  saveActiveUserProfile(profile);
  try { await syncUserAccounts(user.id); } catch (e) {}
  return profile;
}

/**
 * Sign Out
 */
export async function signOutUser() {
  try {
    await supabase.auth.signOut();
  } catch (e) {}
  saveActiveUserProfile(null);
  notifySyncStatus('local_only', 'Signed out. Working in local offline mode.');
}

/**
 * Update Profile
 */
export function updateUserProfile(updates) {
  const current = getActiveUserProfile();
  if (!current) return null;
  const updated = { ...current, ...updates, lastModified: Date.now() };
  saveActiveUserProfile(updated);
  return updated;
}

/**
 * Refresh user profile from Supabase user_profiles table
 */
export async function refreshUserProfile() {
  const current = getActiveUserProfile();
  if (!current || !current.id) return null;
  try {
    const { data: dbProfile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', current.id)
      .maybeSingle();

    if (!error && dbProfile) {
      const hasChanges = (
        current.canCloudSync !== (dbProfile.can_cloud_sync ?? false) ||
        current.dailyImageLimit !== (dbProfile.daily_image_limit ?? 0) ||
        current.planTier !== (dbProfile.plan_tier || 'free') ||
        current.isBlocked !== (dbProfile.is_blocked ?? false) ||
        current.name !== (dbProfile.name || current.name) ||
        current.avatarUrl !== (dbProfile.avatar_url || current.avatarUrl)
      );

      if (hasChanges) {
        const updated = {
          ...current,
          name: dbProfile.name || current.name,
          planTier: dbProfile.plan_tier || current.planTier,
          canCloudSync: dbProfile.can_cloud_sync ?? false,
          dailyImageLimit: dbProfile.daily_image_limit ?? 0,
          isBlocked: dbProfile.is_blocked ?? false,
          avatarUrl: dbProfile.avatar_url || current.avatarUrl
        };
        saveActiveUserProfile(updated, true);
        return updated;
      }
    }
  } catch (e) {
    console.warn('refreshUserProfile note:', e);
  }
  return current;
}

/**
 * Fetch a single session's raw log on-demand (Lazy Loading)
 */
export async function fetchOnDemandSessionLog(sessionDate, accountId = 'default') {
  if (!sessionDate) return null;
  const profile = getActiveUserProfile();
  if (!profile) return null;
  const safeAccountId = accountId || 'default';

  try {
    const rawLog = await downloadRawLogFromCloud(profile.id, safeAccountId, sessionDate);
    if (rawLog) {
      await persistLog(sessionDate, rawLog, safeAccountId);
      return rawLog;
    }
  } catch (err) {
    console.warn('Lazy fetch log warning:', err);
  }
  return null;
}

/**
 * Fetch a single session's screenshots on-demand from Cloudflare R2 (Lazy Loading)
 */
export async function fetchOnDemandSessionScreenshots(sessionDate, accountId = 'default') {
  if (!sessionDate) return [];
  const profile = getActiveUserProfile();
  if (!profile) return [];
  const safeAccountId = accountId || 'default';

  try {
    let screenshotKeys = [];

    // 1. Try to get keys from Master Snapshot first
    try {
      const master = await downloadMasterSnapshot(profile.id, safeAccountId);
      if (master?.sessions?.[sessionDate]?.screenshotsKeys) {
        screenshotKeys = master.sessions[sessionDate].screenshotsKeys.map(k => typeof k === 'string' ? k : (k?.key || ''));
      }
    } catch (e) {}

    // 2. Query R2 screenshot directory prefix directly if keys are missing
    if (screenshotKeys.length === 0) {
      screenshotKeys = await listSessionScreenshotsFromCloud(profile.id, safeAccountId, sessionDate);
    }

    const cleanKeys = (screenshotKeys || []).filter(Boolean);
    if (cleanKeys.length === 0) return [];

    const downloadedImgs = [];
    for (const key of cleanKeys) {
      try {
        const dataUrl = await downloadScreenshotFromCloud(key);
        if (dataUrl) {
          const filename = key.split('/').pop() || `${Date.now()}.jpg`;
          downloadedImgs.push({ filename, dataUrl });
        }
      } catch (dlErr) {
        console.warn(`[Cloud Sync] Error downloading screenshot (${key}):`, dlErr);
      }
    }

    if (downloadedImgs.length > 0) {
      await saveScreenshotsToStorage(sessionDate, downloadedImgs, safeAccountId);
      console.log(`[Cloud Sync] Downloaded ${downloadedImgs.length} screenshot(s) from R2 for ${sessionDate}`);
    }
    return downloadedImgs;
  } catch (err) {
    console.warn('Lazy fetch screenshots warning:', err);
    return [];
  }
}

// Mutex lock and throttling for sync execution
let isSyncRunning = false;
let activeSyncPromise = null;
let activeSyncAccountId = null;   // ← track which account owns the current in-flight sync
let lastSyncExecutionTime = 0;

let hasAccountIdChecked = false;
let hasAccountIdInStats = false;

export async function checkHasAccountIdColumn() {
  if (hasAccountIdChecked) return hasAccountIdInStats;
  try {
    const { error } = await supabase.from('daily_session_stats').select('account_id').limit(0);
    hasAccountIdInStats = !error;
  } catch (e) {
    hasAccountIdInStats = false;
  }
  hasAccountIdChecked = true;
  return hasAccountIdInStats;
}

/**
 * Step 3: Two-Way Full Sync (Cloudflare R2 + Supabase)
 * Strictly namespaced under: users/{userId}/{accountId}/...
 * Uses per-account checksum hash in Supabase user_accounts table.
 */
export async function executeTwoTierSync(dailyStatsMap = {}, options = {}, accountId = 'default') {
  const profile = getActiveUserProfile();
  const safeAccountId = accountId || 'default';

  if (!profile) {
    notifySyncStatus('local_only', 'Local offline mode active.');
    return { success: false, error: 'Please sign in to enable Hammer Pro Cloud Sync.' };
  }

  // Cloud Sync Entitlement Gate
  if (!profile.canCloudSync) {
    notifySyncStatus('local_only', 'Cloud Sync is not enabled for your account. Working in Local Storage mode.');
    return { success: false, mode: 'local', error: 'Cloud Sync is disabled for your account. Contact the administrator to enable cloud sync.' };
  }

  // Mutex Lock: Only share the in-flight promise when it's for the SAME account.
  // If the in-flight sync belongs to a different account, let this call proceed independently.
  if (isSyncRunning && activeSyncPromise && activeSyncAccountId === safeAccountId) {
    console.log(`[Sync] Sync already in progress for ${safeAccountId}. Awaiting in-flight sync...`);
    try {
      return await activeSyncPromise;
    } catch (e) {
      return { success: false, error: e?.message || 'In-flight sync encountered an issue.' };
    }
  }

  // Rate Limiting: Minimum 3 seconds cooldown between background sync runs unless explicitly forced
  const now = Date.now();
  if (!options.force && (now - lastSyncExecutionTime < 3000)) {
    return { success: true, throttled: true, accountId: safeAccountId };
  }

  isSyncRunning = true;
  activeSyncAccountId = safeAccountId;   // ← tag the mutex with the owning account
  lastSyncExecutionTime = now;

  const runSync = async () => {
    try {
      const settings = (await loadSettingsFromStorage()) || {};
      const provider = profile.cloudProvider || settings.cloudProvider || 'supabase_cloud';

      if (provider === 'supabase_cloud') {
        // First sync accounts to ensure user_accounts rows exist
        try {
          await syncUserAccounts(profile.id);
        } catch (accSyncErr) {
          console.warn('[Cloud Sync] Account sync note:', accSyncErr);
        }

        const diskLogs = await retrieveAllLogs(safeAccountId);
        const allLocalLogs = { ...diskLogs, ...(options.explicitLogs || {}) };
        const localDates = Object.keys(allLocalLogs).sort();

        // Compute cryptographic SHA-256 hash of this account's local state
        const localFingerprint = await computeContentHash(JSON.stringify(allLocalLogs));

        // Fetch remote snapshot fingerprint from Supabase user_accounts table
        let remoteHash = null;
        try {
          const { data: accData, error: accErr } = await supabase
            .from('user_accounts')
            .select('snapshot_hash')
            .eq('user_id', profile.id)
            .eq('account_id', safeAccountId)
            .maybeSingle();

          if (!accErr && accData && accData.snapshot_hash) {
            remoteHash = accData.snapshot_hash;
          }
        } catch (e) {
          console.warn('[Cloud Sync] Account hash fetch note:', e);
        }

        // FAST PATH: If remote hash matches local fingerprint and we have logs, skip all R2 requests!
        if (!options.explicitLogs && remoteHash && remoteHash === localFingerprint && localDates.length > 0) {
          profile.lastSyncTimestamp = Date.now();
          saveActiveUserProfile(profile, false);
          notifySyncStatus('synced', 'All sessions synced across devices!', {
            profile,
            syncedLogs: allLocalLogs,
            hasNewLogs: false,
            accountId: safeAccountId
          });
          return { success: true, mode: 'cloud', syncedLogs: allLocalLogs, hasNewLogs: false, skippedR2: true, accountId: safeAccountId };
        }

        notifySyncStatus('syncing', `Syncing account [${safeAccountId}] with Cloudflare R2...`, { accountId: safeAccountId });

        // ==========================================
        // STEP 1: PULL FIRST (Cloudflare R2 + Supabase -> Device Local Disk)
        // ==========================================
        let syncedNewLogs = false;
        const tombstones = getDeletedSessionsTombstones(safeAccountId);
        const updatedLocalLogs = { ...allLocalLogs };
        
        // Clean any tombstoned session from local logs
        for (const delDate of Object.keys(tombstones)) {
          delete updatedLocalLogs[delDate];
        }

        // A. Pull Master Snapshot from Cloudflare R2 for this specific account
        try {
          const cloudSnapshot = await downloadMasterSnapshot(profile.id, safeAccountId);
          if (cloudSnapshot && cloudSnapshot.sessions) {
            for (const sDate of Object.keys(cloudSnapshot.sessions)) {
              if (tombstones[sDate]) continue; // Never re-pull deleted session

              const item = cloudSnapshot.sessions[sDate];
              if (item && item.journalNote) {
                await saveJournalToStorage(sDate, item.journalNote, safeAccountId);
              }

              // Download missing log file from cloud
              if (!updatedLocalLogs[sDate]) {
                const rawLogFromR2 = await downloadRawLogFromCloud(profile.id, safeAccountId, sDate);
                if (rawLogFromR2) {
                  await persistLog(sDate, rawLogFromR2, safeAccountId);
                  updatedLocalLogs[sDate] = rawLogFromR2;
                  syncedNewLogs = true;
                }
              }
            }
          }
        } catch (e) {
          console.warn('[Cloud Sync] Master snapshot pull note:', e);
        }

        // B. Query Supabase daily_session_stats for missing session metadata
        try {
          const hasAccountCol = await checkHasAccountIdColumn();
          let statsQuery = supabase
            .from('daily_session_stats')
            .select('*')
            .eq('user_id', profile.id);

          if (hasAccountCol) {
            statsQuery = statsQuery.eq('account_id', safeAccountId);
          }

          const { data: dbSessions, error: dbStatsErr } = await statsQuery;

          if (!dbStatsErr && Array.isArray(dbSessions)) {
            for (const session of dbSessions) {
              const sDate = session.session_date;
              if (sDate && !tombstones[sDate] && !updatedLocalLogs[sDate]) {
                const rawLog = await downloadRawLogFromCloud(profile.id, safeAccountId, sDate);
                if (rawLog) {
                  await persistLog(sDate, rawLog, safeAccountId);
                  updatedLocalLogs[sDate] = rawLog;
                  syncedNewLogs = true;
                }
              }
              if (sDate && !tombstones[sDate] && session.journal_note) {
                await saveJournalToStorage(sDate, session.journal_note, safeAccountId);
              }
            }
          }
        } catch (e) {
          console.warn('[Cloud Sync] Supabase stats query exception:', e);
        }

        // ==========================================
        // STEP 2: PUSH (Merged Local Disk -> Cloudflare R2 + Supabase)
        // ==========================================
        const combinedDates = Object.keys(updatedLocalLogs).sort();
        const masterSessionsSummary = {};
        const rowsToUpsert = [];
        const hasAccountCol = await checkHasAccountIdColumn();

        for (const dateStr of combinedDates) {
          const rawContent = updatedLocalLogs[dateStr] || '';
          let stats = dailyStatsMap[dateStr];

          if (!stats && rawContent) {
            stats = parseLogFile(rawContent, settings.feePerShare, settings.enableFees, settings.dateFormat, 'US_EASTERN');
          }
          stats = stats || {};

          const journal = await loadJournalFromStorage(dateStr, safeAccountId);
          const screenshots = await loadScreenshotsFromStorage(dateStr, safeAccountId);

          let r2LogKey = '';
          if (rawContent) {
            r2LogKey = await uploadRawLogToCloud(profile.id, safeAccountId, dateStr, rawContent);
          }

          const screenshotKeys = [];
          const maxImages = profile.dailyImageLimit ?? 0;
          if (maxImages > 0 && screenshots && screenshots.length > 0) {
            const imgsToUpload = screenshots.slice(0, maxImages);
            for (const img of imgsToUpload) {
              if (img.dataUrl) {
                const key = await uploadScreenshotToCloud(profile.id, safeAccountId, dateStr, img.filename, img.dataUrl);
                if (key) screenshotKeys.push({ filename: img.filename, key });
              }
            }
          }

          const summaryItem = {
            pnl: stats.pnl || 0,
            grossPnl: stats.grossPnl || stats.pnl || 0,
            netPnl: stats.netPnl || stats.pnl || 0,
            fees: stats.fees || 0,
            winRate: stats.winRate || 0,
            totalOrders: stats.totalOrders || 0,
            roundTripShares: stats.roundTripShares || 0,
            avgHoldTime: stats.avgHoldTime || 0,
            profitFactor: stats.profitFactor || 0,
            stockBreakdown: stats.stockBreakdown || [],
            journalNote: journal || '',
            r2LogKey: r2LogKey || '',
            screenshotsKeys: screenshotKeys
          };

          masterSessionsSummary[dateStr] = summaryItem;

          const row = {
            user_id: profile.id,
            account_id: safeAccountId,
            session_date: dateStr,
            pnl: summaryItem.pnl,
            gross_pnl: summaryItem.grossPnl,
            net_pnl: summaryItem.netPnl,
            fees: summaryItem.fees,
            win_rate: summaryItem.winRate,
            total_trades: summaryItem.totalOrders,
            round_trip_shares: summaryItem.roundTripShares,
            avg_hold_seconds: summaryItem.avgHoldTime,
            profit_factor: summaryItem.profitFactor,
            journal_note: journal || '',
            r2_log_key: r2LogKey || '',
            screenshots_keys: screenshotKeys,
            updated_at: new Date().toISOString()
          };

          rowsToUpsert.push(row);
        }

        // 1. Upload Master Snapshot JSON to Cloudflare R2 strictly for this account
        if (combinedDates.length > 0) {
          const masterSnapshotPayload = {
            version: APP_VERSION,
            userId: profile.id,
            accountId: safeAccountId,
            updatedAt: new Date().toISOString(),
            sessions: masterSessionsSummary
          };
          await uploadMasterSnapshot(profile.id, safeAccountId, masterSnapshotPayload);
        }

        // 2. Upsert metadata rows to Supabase daily_session_stats
        if (rowsToUpsert.length > 0) {
          const conflictTarget = hasAccountCol ? 'user_id,account_id,session_date' : 'user_id,session_date';
          try {
            await supabase
              .from('daily_session_stats')
              .upsert(rowsToUpsert, { onConflict: conflictTarget });
          } catch (pushErr) {
            console.warn('[Cloud Sync] Supabase metadata upsert note:', pushErr);
          }
        }

        // 3. Update isolated snapshot fingerprint in Supabase user_accounts table
        const finalFingerprint = await computeContentHash(JSON.stringify(updatedLocalLogs));
        try {
          await supabase
            .from('user_accounts')
            .upsert({
              user_id: profile.id,
              account_id: safeAccountId,
              snapshot_hash: finalFingerprint,
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,account_id' });
        } catch (e) {
          console.warn('[Cloud Sync] user_accounts snapshot_hash update note:', e);
        }

        profile.lastSyncTimestamp = Date.now();
        saveActiveUserProfile(profile, false);
        notifySyncStatus('synced', 'All sessions synced across devices!', {
          profile,
          syncedLogs: updatedLocalLogs,
          hasNewLogs: syncedNewLogs,
          accountId: safeAccountId
        });

        return {
          success: true,
          mode: 'cloud',
          syncedLogs: updatedLocalLogs,
          hasNewLogs: syncedNewLogs,
          accountId: safeAccountId
        };
      }

      return { success: true, mode: 'local', accountId: safeAccountId };

    } catch (err) {
      console.error('Two-tier sync error:', err);
      notifySyncStatus('error', err.message || 'Sync encountered an error.', { accountId: safeAccountId });
      return { success: false, error: err.message || 'Sync encountered an unexpected error.', accountId: safeAccountId };
    }
  };

  activeSyncPromise = runSync();
  try {
    return await activeSyncPromise;
  } finally {
    isSyncRunning = false;
    activeSyncPromise = null;
    activeSyncAccountId = null;
  }
}

/**
 * Non-Destructive Soft-Delete Cloud Handler
 * In accordance with Critical Safety Directives:
 * - NO hard DELETE API calls to Cloudflare R2
 * - NO hard DELETE row operations in Supabase
 * Marks session as deleted in account tombstones, updates the active Master Snapshot in R2,
 * and updates user_accounts.snapshot_hash.
 */
export async function deleteSessionFromCloud(sessionDate, accountId = 'default') {
  const profile = getActiveUserProfile();
  if (!sessionDate) return;
  const safeAccountId = accountId || 'default';

  // 1. Immediately record account-isolated tombstone locally
  markSessionAsDeleted(sessionDate, null, safeAccountId);

  if (!profile) return;

  try {
    // 2. Rebuild and upload updated Master Snapshot to Cloudflare R2 omitting the deleted session
    const diskLogs = await retrieveAllLogs(safeAccountId);
    const remainingDates = Object.keys(diskLogs).filter(d => d !== sessionDate);
    const settings = (await loadSettingsFromStorage()) || {};

    const updatedSessionsSummary = {};
    for (const d of remainingDates) {
      const content = diskLogs[d];
      if (content) {
        const stats = parseLogFile(content, settings.feePerShare, settings.enableFees, settings.dateFormat, 'US_EASTERN') || {};
        const journal = await loadJournalFromStorage(d, safeAccountId);
        updatedSessionsSummary[d] = {
          pnl: stats.pnl || 0,
          grossPnl: stats.grossPnl || stats.pnl || 0,
          netPnl: stats.netPnl || stats.pnl || 0,
          fees: stats.fees || 0,
          winRate: stats.winRate || 0,
          totalOrders: stats.totalOrders || 0,
          roundTripShares: stats.roundTripShares || 0,
          avgHoldTime: stats.avgHoldTime || 0,
          profitFactor: stats.profitFactor || 0,
          journalNote: journal || ''
        };
      }
    }

    const updatedSnapshot = {
      version: APP_VERSION,
      userId: profile.id,
      accountId: safeAccountId,
      updatedAt: new Date().toISOString(),
      sessions: updatedSessionsSummary
    };
    await uploadMasterSnapshot(profile.id, safeAccountId, updatedSnapshot);

    // 3. Update isolated SHA-256 fingerprint in user_accounts table
    const updatedFingerprint = await computeContentHash(JSON.stringify(diskLogs));
    try {
      await supabase
        .from('user_accounts')
        .upsert({
          user_id: profile.id,
          account_id: safeAccountId,
          snapshot_hash: updatedFingerprint,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,account_id' });
    } catch (e) {}

    profile.lastSyncTimestamp = Date.now();
    saveActiveUserProfile(profile, false);
    notifySyncStatus('synced', `Session ${sessionDate} removed from active journal for account [${safeAccountId}].`, { accountId: safeAccountId });
    console.log(`[Cloud Sync] Soft-deleted session ${sessionDate} for account [${safeAccountId}].`);
  } catch (err) {
    console.error('Error soft-deleting session:', err);
  }
}
