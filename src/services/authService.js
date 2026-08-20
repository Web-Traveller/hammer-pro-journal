/**
 * AuthService & Live Supabase + Cloudflare R2 Sync Manager
 * Supports:
 * 1. Live Supabase Authentication & User Profiles Table Sync
 * 2. Master Journal Snapshot (1-file instant boot for cross-device sync)
 * 3. Complete Two-Way Cross-Device Sync (Pushes all local logs to R2 & Pulls all cloud logs to new devices)
 * 4. 100% Offline Local Mode
 */

import { supabase } from './supabaseClient';
import {
  retrieveAllLogs,
  persistLog,
  loadJournalFromStorage,
  saveJournalToStorage,
  loadScreenshotsFromStorage,
  saveScreenshotsToStorage,
  loadSettingsFromStorage
} from './storageService';
import {
  uploadMasterSnapshot,
  downloadMasterSnapshot,
  uploadRawLogToCloud,
  downloadRawLogFromCloud,
  deleteRawLogFromCloud,
  uploadScreenshotToCloud,
  downloadScreenshotFromCloud
} from './r2StorageService';
import { parseLogFile } from '../parser';
import { computeContentHash } from '../utils/checksum';
import { APP_VERSION } from '../version';

const AUTH_STORAGE_KEY = 'hammer_user_profile';

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
export function saveActiveUserProfile(profile) {
  try {
    if (!profile) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } else {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile));
    }
    notifySyncStatus(profile ? 'synced' : 'local_only', 'Profile updated', { profile });
  } catch (e) {
    console.error('Error saving user profile:', e);
  }
}

/**
 * Sign Up with Live Supabase Auth & Create Profile in user_profiles Table
 */
export async function signUpUser(name, email, password, options = {}) {
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    throw new Error('Please enter a valid email address.');
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const cleanName = (name || cleanEmail.split('@')[0]).trim();

  // 1. Live Supabase Auth SignUp
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

  // 2. Insert into public.user_profiles table
  try {
    await supabase.from('user_profiles').upsert({
      id: user.id,
      name: cleanName,
      email: cleanEmail,
      plan_tier: 'free',
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
    avatarUrl,
    createdAt: user.created_at || new Date().toISOString(),
    lastSyncTimestamp: Date.now(),
    cloudProvider: options.cloudProvider || 'supabase_cloud'
  };

  saveActiveUserProfile(newProfile);
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

  // 1. Live Supabase Auth SignIn
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

  // 2. Query user_profiles table
  let profileName = user.user_metadata?.name || cleanEmail.split('@')[0];
  let planTier = user.user_metadata?.planTier || 'free';
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
    } else {
      // Upsert profile if missing
      await supabase.from('user_profiles').upsert({
        id: user.id,
        name: profileName,
        email: cleanEmail,
        plan_tier: planTier,
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
    avatarUrl,
    createdAt: user.created_at || new Date().toISOString(),
    lastSyncTimestamp: Date.now(),
    cloudProvider: 'supabase_cloud'
  };

  saveActiveUserProfile(profile);
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
 * Fetch a single session's raw log on-demand (Lazy Loading)
 */
export async function fetchOnDemandSessionLog(sessionDate) {
  if (!sessionDate) return null;
  const profile = getActiveUserProfile();
  if (!profile) return null;

  try {
    const rawLog = await downloadRawLogFromCloud(profile.id, sessionDate);
    if (rawLog) {
      await persistLog(sessionDate, rawLog);
      return rawLog;
    }
  } catch (err) {
    console.warn('Lazy fetch log warning:', err);
  }
  return null;
}

/**
 * Two-Way Full Sync (Cloudflare R2 + Supabase)
 * 1. PUSH: Iterates over ALL local logs, uploads heavy .txt files & screenshots to R2,
 *          assembles Master Snapshot with full metrics, and updates Supabase daily_session_stats.
 * 2. PULL: Reads Master Snapshot from R2 & Supabase, downloads missing session logs to local disk,
 *          and returns all merged sessions so Device 2 immediately shows all past trade history!
 */
export async function executeTwoTierSync(dailyStatsMap = {}, options = {}) {
  const profile = getActiveUserProfile();
  if (!profile) {
    notifySyncStatus('local_only', 'Local offline mode active.');
    return { success: false, error: 'Please sign in to enable Hammer Pro Cloud Sync.' };
  }

  // Developer License Gate: Cloud Sync strictly requires an active License Key
  const activeLicenseKey = profile.license_key || (typeof localStorage !== 'undefined' ? localStorage.getItem('hammer_activated_license_key') : null);
  if (!activeLicenseKey) {
    notifySyncStatus('local_only', 'Local offline mode (Cloud sync requires an active License Key).');
    return { success: false, error: 'Cloud Sync is a Pro feature and requires an active License Key.' };
  }

  try {
    const settings = (await loadSettingsFromStorage()) || {};
    const provider = profile.cloudProvider || settings.cloudProvider || 'supabase_cloud';

    if (provider === 'supabase_cloud') {
      const diskLogs = await retrieveAllLogs();
      const allLocalLogs = { ...diskLogs, ...(options.explicitLogs || {}) };
      const localDates = Object.keys(allLocalLogs).sort();

      // Compute cryptographic SHA-256 hash of current local state
      const localFingerprint = await computeContentHash(JSON.stringify(allLocalLogs));

      // Fetch remote snapshot fingerprint from Supabase (lightweight metadata check)
      let remoteHash = null;
      try {
        const { data: dbProfile, error: dbErr } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', profile.id)
          .maybeSingle();
        if (!dbErr && dbProfile && dbProfile.snapshot_hash) {
          remoteHash = dbProfile.snapshot_hash;
        }
      } catch (e) {
        // Fallback gracefully without error
      }

      // FAST PATH: If remote hash matches local fingerprint and we have logs, skip all R2 requests!
      if (!options.explicitLogs && remoteHash && remoteHash === localFingerprint && localDates.length > 0) {
        profile.lastSyncTimestamp = Date.now();
        saveActiveUserProfile(profile);
        notifySyncStatus('synced', 'All sessions synced across devices!', {
          profile,
          syncedLogs: allLocalLogs,
          hasNewLogs: false
        });
        return { success: true, mode: 'cloud', syncedLogs: allLocalLogs, hasNewLogs: false, skippedR2: true };
      }

      notifySyncStatus('syncing', 'Syncing trading data with Cloudflare R2...');

      // ==========================================
      // STEP 1: PULL FIRST (Cloudflare R2 + Supabase -> Device Local Disk)
      // Merges any remote sessions uploaded from other devices (e.g. Office PC -> Laptop)
      // ==========================================
      let syncedNewLogs = false;
      const updatedLocalLogs = { ...allLocalLogs };

      // A. Pull Master Snapshot from Cloudflare R2
      try {
        const cloudSnapshot = await downloadMasterSnapshot(profile.id);
        if (cloudSnapshot && cloudSnapshot.sessions) {
          for (const sDate of Object.keys(cloudSnapshot.sessions)) {
            const item = cloudSnapshot.sessions[sDate];
            if (item && item.journalNote) {
              await saveJournalToStorage(sDate, item.journalNote);
            }

            // Download missing log file from cloud
            if (!updatedLocalLogs[sDate]) {
              const rawLogFromR2 = await downloadRawLogFromCloud(profile.id, sDate);
              if (rawLogFromR2) {
                await persistLog(sDate, rawLogFromR2);
                updatedLocalLogs[sDate] = rawLogFromR2;
                syncedNewLogs = true;
              }
            }
          }
        }
      } catch (e) {
        console.warn('[Cloud Sync] Master snapshot pull note:', e);
      }

      // B. Query Supabase daily_session_stats for any missing session metadata
      try {
        const { data: dbSessions } = await supabase
          .from('daily_session_stats')
          .select('*')
          .eq('user_id', profile.id);

        if (Array.isArray(dbSessions)) {
          for (const session of dbSessions) {
            const sDate = session.session_date;
            if (sDate && !updatedLocalLogs[sDate]) {
              const rawLog = await downloadRawLogFromCloud(profile.id, sDate);
              if (rawLog) {
                await persistLog(sDate, rawLog);
                updatedLocalLogs[sDate] = rawLog;
                syncedNewLogs = true;
              }
            }
            if (sDate && session.journal_note) {
              await saveJournalToStorage(sDate, session.journal_note);
            }
          }
        }
      } catch (e) {
        console.warn('[Cloud Sync] Supabase stats query note:', e);
      }

      // ==========================================
      // STEP 2: PUSH (Merged Local Disk -> Cloudflare R2 + Supabase)
      // Pushes complete union of all trade history back to cloud
      // ==========================================
      const combinedDates = Object.keys(updatedLocalLogs).sort();
      const masterSessionsSummary = {};
      const rowsToUpsert = [];

      for (const dateStr of combinedDates) {
        const rawContent = updatedLocalLogs[dateStr] || '';
        let stats = dailyStatsMap[dateStr];

        if (!stats && rawContent) {
          stats = parseLogFile(rawContent, settings.feePerShare, settings.enableFees, settings.dateFormat, 'US_EASTERN');
        }
        stats = stats || {};

        const journal = await loadJournalFromStorage(dateStr);
        const screenshots = await loadScreenshotsFromStorage(dateStr);

        let r2LogKey = '';
        if (rawContent) {
          r2LogKey = await uploadRawLogToCloud(profile.id, dateStr, rawContent);
        }

        const screenshotKeys = [];
        for (const img of screenshots) {
          if (img.dataUrl) {
            const key = await uploadScreenshotToCloud(profile.id, dateStr, img.filename, img.dataUrl);
            if (key) screenshotKeys.push({ filename: img.filename, key });
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

        rowsToUpsert.push({
          user_id: profile.id,
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
        });
      }

      // 1. Upload Master Snapshot JSON to Cloudflare R2
      if (combinedDates.length > 0) {
        const masterSnapshotPayload = {
          version: APP_VERSION,
          userId: profile.id,
          updatedAt: new Date().toISOString(),
          sessions: masterSessionsSummary
        };
        await uploadMasterSnapshot(profile.id, masterSnapshotPayload);
      }

      // 2. Upsert metadata rows to Supabase daily_session_stats
      if (rowsToUpsert.length > 0) {
        const { error: pushErr } = await supabase
          .from('daily_session_stats')
          .upsert(rowsToUpsert, { onConflict: 'user_id,session_date' });

        if (pushErr) {
          console.warn('Supabase metadata upsert note:', pushErr.message);
        }
      }

      // Update snapshot fingerprint in Supabase user_profiles
      const finalFingerprint = await computeContentHash(JSON.stringify(updatedLocalLogs));
      try {
        await supabase
          .from('user_profiles')
          .update({ snapshot_hash: finalFingerprint, updated_at: new Date().toISOString() })
          .eq('id', profile.id);
      } catch (e) {}

      profile.lastSyncTimestamp = Date.now();
      saveActiveUserProfile(profile);
      notifySyncStatus('synced', 'All sessions synced across devices!', {
        profile,
        syncedLogs: updatedLocalLogs,
        hasNewLogs: syncedNewLogs
      });

      return {
        success: true,
        mode: 'cloud',
        syncedLogs: updatedLocalLogs,
        hasNewLogs: syncedNewLogs
      };
    }

    return { success: true, mode: 'local' };

  } catch (err) {
    console.error('Two-tier sync error:', err);
    notifySyncStatus('error', err.message || 'Sync encountered an error.');
    return { success: false, error: err.message };
  }
}

/**
 * Permanently deletes a session date from both Cloudflare R2 and Supabase
 * Prevents deleted sessions from re-syncing from the cloud!
 */
export async function deleteSessionFromCloud(sessionDate) {
  const profile = getActiveUserProfile();
  if (!profile || !sessionDate) return;

  try {
    // 1. Delete raw log from Cloudflare R2
    await deleteRawLogFromCloud(profile.id, sessionDate);

    // 2. Delete metadata row from Supabase daily_session_stats
    await supabase
      .from('daily_session_stats')
      .delete()
      .eq('user_id', profile.id)
      .eq('session_date', sessionDate);

    // 3. Rebuild and upload updated Master Snapshot to Cloudflare R2 without deleted session
    const diskLogs = await retrieveAllLogs();
    const remainingDates = Object.keys(diskLogs).filter(d => d !== sessionDate);
    const settings = (await loadSettingsFromStorage()) || {};

    const updatedSessionsSummary = {};
    for (const d of remainingDates) {
      const content = diskLogs[d];
      if (content) {
        const stats = parseLogFile(content, settings.feePerShare, settings.enableFees, settings.dateFormat, 'US_EASTERN') || {};
        const journal = await loadJournalFromStorage(d);
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
      updatedAt: new Date().toISOString(),
      sessions: updatedSessionsSummary
    };
    await uploadMasterSnapshot(profile.id, updatedSnapshot);

    // 4. Update SHA-256 fingerprint in Supabase
    const updatedFingerprint = await computeContentHash(JSON.stringify(diskLogs));
    await supabase
      .from('user_profiles')
      .update({ snapshot_hash: updatedFingerprint, updated_at: new Date().toISOString() })
      .eq('id', profile.id);

    profile.lastSyncTimestamp = Date.now();
    saveActiveUserProfile(profile);
    notifySyncStatus('synced', `Session ${sessionDate} removed from cloud & local storage.`);
    console.log(`[Cloud Sync] Permanently deleted session ${sessionDate} from cloud.`);
  } catch (err) {
    console.error('Error deleting session from cloud:', err);
  }
}
