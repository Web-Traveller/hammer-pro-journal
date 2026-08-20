/**
 * Cryptographic Cloud Licensing & Remote Device Lock Engine
 * Enforces hardware/device binding & instant remote access toggling via Supabase
 */

import { supabase } from './supabaseClient';
import { getActiveUserProfile, saveActiveUserProfile } from './authService';

const LICENSE_CACHE_KEY = 'hammer_license_status';

/**
 * Generate a unique hardware/device fingerprint
 */
export async function getDeviceFingerprint() {
  const nav = typeof window !== 'undefined' ? window.navigator : {};
  const screen = typeof window !== 'undefined' ? window.screen : {};
  
  const rawId = [
    nav.userAgent || '',
    nav.language || '',
    screen.width || 0,
    screen.height || 0,
    screen.colorDepth || 0,
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
  const deviceId = await getDeviceFingerprint();
  const storedKey = localStorage.getItem(ACTIVATED_KEY_STORAGE) || profile?.license_key;

  try {
    // 1. Check if user profile is explicitly blocked/banned in Supabase
    if (profile && profile.id) {
      const { data: dbProfile } = await supabase
        .from('user_profiles')
        .select('is_blocked, license_key')
        .eq('id', profile.id)
        .maybeSingle();

      if (dbProfile?.is_blocked) {
        return {
          allowed: false,
          status: 'blocked',
          reason: 'Access Suspended',
          message: 'Your account or device access has been locked by the administrator.'
        };
      }
    }

    // 2. Verify stored key in Supabase licenses table if available
    const activeKey = storedKey || profile?.license_key;

    if (activeKey) {
      const cleanKey = activeKey.trim().toUpperCase();
      const { data: dbLicense, error: licErr } = await supabase
        .from('licenses')
        .select('*')
        .eq('license_key', cleanKey)
        .maybeSingle();

      if (!licErr && dbLicense) {
        if (!dbLicense.is_active) {
          return {
            allowed: false,
            status: 'revoked',
            reason: 'License Deactivated',
            message: 'This license key has been deactivated by the administrator.'
          };
        }

        if (dbLicense.expires_at && new Date(dbLicense.expires_at) < new Date()) {
          return {
            allowed: false,
            status: 'expired',
            reason: 'License Expired',
            message: `This license expired on ${new Date(dbLicense.expires_at).toLocaleDateString()}.`
          };
        }

        // Check device capacity limits (e.g. max_users / max_devices)
        const maxDevs = dbLicense.max_devices || dbLicense.max_users || 1;
        let boundDevices = Array.isArray(dbLicense.bound_devices) ? dbLicense.bound_devices : [];
        if (dbLicense.device_fingerprint && !boundDevices.includes(dbLicense.device_fingerprint)) {
          boundDevices.push(dbLicense.device_fingerprint);
        }

        if (!boundDevices.includes(deviceId)) {
          if (boundDevices.length >= maxDevs) {
            return {
              allowed: false,
              status: 'device_limit_reached',
              reason: 'Device Limit Exceeded',
              message: `This activation key is limited to ${maxDevs} device(s). Maximum device limit reached.`
            };
          }
          // Bind new device
          boundDevices.push(deviceId);
          await supabase
            .from('licenses')
            .update({ bound_devices: boundDevices, device_fingerprint: deviceId })
            .eq('id', dbLicense.id);
        }

        return {
          allowed: true,
          status: 'active',
          licenseKey: cleanKey,
          features: dbLicense.features || { allow_cloud_sync: true, max_screenshots: 999 },
          license: dbLicense,
          deviceId
        };
      }
    }

    // 3. No valid license key found -> Check 24-Hour Trial Status
    const trial = getTrialStatus();
    if (trial.active) {
      return {
        allowed: true,
        status: 'trial_active',
        hoursLeft: trial.hoursLeft,
        trialUsed: true,
        features: { allow_cloud_sync: false, max_screenshots: 1 },
        message: `24-Hour Trial Active (${trial.hoursLeft}h remaining). Local offline features enabled.`
      };
    }

    // Trial expired or not used -> Require License Key Activation
    return {
      allowed: false,
      status: 'license_required',
      trialUsed: trial.used,
      trialExpired: trial.expired || false,
      reason: trial.expired ? 'Trial Expired' : 'Activation Code Required',
      message: trial.expired
        ? 'Your 24-hour trial period has expired. Please enter an Activation Code to continue using Hammer Pro Journal.'
        : 'Please enter your Activation Code / License Key to unlock Hammer Pro Journal.'
    };

  } catch (err) {
    console.warn('License verification note:', err);
    // Offline / fallback check: check trial status
    const trial = getTrialStatus();
    if (storedKey || trial.active) {
      return { allowed: true, status: 'offline_cached', features: { allow_cloud_sync: false, max_screenshots: 1 } };
    }
    return {
      allowed: false,
      status: 'license_required',
      trialUsed: trial.used,
      reason: 'Activation Code Required',
      message: 'Please enter your Activation Code / License Key to unlock.'
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
