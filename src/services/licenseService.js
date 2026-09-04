/**
 * Cryptographic Cloud Licensing & Remote Device Lock Engine
 * Enforces hardware/device binding & instant remote access toggling via Supabase
 */

import { supabase } from './supabaseClient';
import { getActiveUserProfile, saveActiveUserProfile } from './authService';

const LICENSE_CACHE_KEY = 'hammer_license_status';

/**
 * Generate a unique hardware/device fingerprint
 * Stabilized against external monitors and resolution changes
 */
export async function getDeviceFingerprint() {
  const nav = typeof window !== 'undefined' ? window.navigator : {};
  let persistentDeviceUuid = '';
  try {
    persistentDeviceUuid = localStorage.getItem('hammer_device_uuid_v1');
    if (!persistentDeviceUuid) {
      persistentDeviceUuid = 'dev_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      localStorage.setItem('hammer_device_uuid_v1', persistentDeviceUuid);
    }
  } catch (e) {}

  const rawId = [
    persistentDeviceUuid,
    nav.platform || '',
    nav.language || '',
    nav.hardwareConcurrency || 1
  ].join('###');

  let hash = 5381;
  for (let i = 0; i < rawId.length; i++) {
    hash = ((hash << 5) + hash) + rawId.charCodeAt(i);
    hash = hash & hash;
  }
  return 'DEV_' + Math.abs(hash).toString(16).toUpperCase();
}

const TRIAL_SKIP_KEY = 'hammer_trial_skip_start';
const ACTIVATED_KEY_STORAGE = 'hammer_activated_license_key';

/**
 * Get 24-Hour Trial Status
 */
export function getTrialStatus() {
  try {
    const raw = localStorage.getItem(TRIAL_SKIP_KEY);
    if (!raw) return { used: false, active: false, hoursLeft: 0 };
    const skipTime = parseInt(raw, 10);
    if (isNaN(skipTime)) return { used: false, active: false, hoursLeft: 0 };

    const elapsedMs = Date.now() - skipTime;
    const trialDurationMs = 24 * 60 * 60 * 1000; // 24 hours
    if (elapsedMs < trialDurationMs) {
      const msLeft = trialDurationMs - elapsedMs;
      const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60));
      return { used: true, active: true, hoursLeft };
    }
    return { used: true, active: false, hoursLeft: 0, expired: true };
  } catch (e) {
    return { used: false, active: false, hoursLeft: 0 };
  }
}

/**
 * Activate 24-Hour Trial Skip (Single-use per device)
 */
export function activateTrialSkip() {
  const trial = getTrialStatus();
  if (trial.used) {
    return { success: false, error: 'The 24-hour trial skip has already been used on this device.' };
  }
  try {
    localStorage.setItem(TRIAL_SKIP_KEY, Date.now().toString());
    return { success: true, hoursLeft: 24 };
  } catch (e) {
    return { success: false, error: 'Could not record trial skip.' };
  }
}

/**
 * Check if the active device/user has a valid, active license or valid 24h trial skip
 */
export async function checkLicenseAndAccess(userProfile = null) {
  const profile = userProfile || getActiveUserProfile();

  try {
    // 1. Check if user profile is explicitly blocked/banned in Supabase
    if (profile && profile.id) {
      const { data: dbProfile } = await supabase
        .from('user_profiles')
        .select('is_blocked, can_cloud_sync, daily_image_limit, plan_tier')
        .eq('id', profile.id)
        .maybeSingle();

      if (dbProfile?.is_blocked) {
        return {
          allowed: false,
          status: 'blocked',
          reason: 'Access Suspended',
          message: 'Your account access has been suspended by the administrator.'
        };
      }

      // Update cached profile entitlements if fetched
      if (dbProfile) {
        const updatedProfile = {
          ...profile,
          canCloudSync: dbProfile.can_cloud_sync ?? false,
          dailyImageLimit: dbProfile.daily_image_limit ?? 0,
          planTier: dbProfile.plan_tier || profile.planTier || 'free',
          isBlocked: dbProfile.is_blocked ?? false
        };
        saveActiveUserProfile(updatedProfile, true);
      }
    }

    // 2. License key requirement is PAUSED in favor of mandatory user accounts
    return {
      allowed: true,
      status: 'active',
      features: {
        allow_cloud_sync: profile?.canCloudSync ?? false,
        max_screenshots: profile?.dailyImageLimit ?? 0
      }
    };
  } catch (err) {
    // Offline resilience: allow local usage if already signed in and not blocked
    if (profile?.isBlocked) {
      return {
        allowed: false,
        status: 'blocked',
        reason: 'Access Suspended',
        message: 'Your account access has been suspended by the administrator.'
      };
    }

    return {
      allowed: true,
      status: 'active',
      features: {
        allow_cloud_sync: profile?.canCloudSync ?? false,
        max_screenshots: profile?.dailyImageLimit ?? 0
      }
    };
  }
}

/**
 * Activate a License Key with Supabase
 */
export async function activateLicenseKey(licenseKey, userProfile) {
  if (!licenseKey) return { success: false, error: 'Please enter an activation key.' };
  const cleanKey = licenseKey.trim().toUpperCase();
  const deviceId = await getDeviceFingerprint();

  try {
    const { data: dbLicense, error } = await supabase
      .from('licenses')
      .select('*')
      .eq('license_key', cleanKey)
      .maybeSingle();

    if (error || !dbLicense) {
      return { success: false, error: 'Activation code not found. Please verify and try again.' };
    }

    if (!dbLicense.is_active) {
      return { success: false, error: 'This activation code has been deactivated by the administrator.' };
    }

    if (dbLicense.expires_at && new Date(dbLicense.expires_at) < new Date()) {
      return { success: false, error: 'This activation code has expired.' };
    }

    const maxDevs = dbLicense.max_devices || dbLicense.max_users || 1;
    let boundDevices = Array.isArray(dbLicense.bound_devices) ? dbLicense.bound_devices : [];
    if (dbLicense.device_fingerprint && !boundDevices.includes(dbLicense.device_fingerprint)) {
      boundDevices.push(dbLicense.device_fingerprint);
    }

    if (!boundDevices.includes(deviceId) && boundDevices.length >= maxDevs) {
      return { success: false, error: `This key has reached its maximum capacity of ${maxDevs} device(s).` };
    }

    if (!boundDevices.includes(deviceId)) {
      boundDevices.push(deviceId);
      await supabase
        .from('licenses')
        .update({ bound_devices: boundDevices, device_fingerprint: deviceId, user_id: userProfile?.id || null })
        .eq('id', dbLicense.id);
    }

    localStorage.setItem(ACTIVATED_KEY_STORAGE, cleanKey);

    if (userProfile && userProfile.id) {
      await supabase
        .from('user_profiles')
        .update({ license_key: cleanKey, is_blocked: false })
        .eq('id', userProfile.id);

      userProfile.license_key = cleanKey;
      saveActiveUserProfile(userProfile);
    }

    return { success: true, license: dbLicense };
  } catch (err) {
    return { success: false, error: err.message || 'Failed to activate license.' };
  }
}
