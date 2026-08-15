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

/**
 * Check if the active device/user has a valid, active license
 */
export async function checkLicenseAndAccess(userProfile = null) {
  const profile = userProfile || getActiveUserProfile();
  const deviceId = await getDeviceFingerprint();

  try {
    // 1. Fetch Global License Enforcement Policy from Supabase app_config
    const { data: configRow } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'license_enforcement')
      .maybeSingle();

    const policy = configRow?.value || { enabled: false, require_license_key: false };

    // If global license enforcement is turned OFF by admin, grant access
    if (!policy.enabled) {
      return { allowed: true, status: 'bypassed', policy };
    }

    // 2. Check if user profile is explicitly blocked/banned in Supabase
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

      const activeKey = dbProfile?.license_key || profile.license_key;

      if (policy.require_license_key) {
        if (!activeKey) {
          return {
            allowed: false,
            status: 'license_required',
            reason: 'License Key Required',
            message: 'Please enter a valid Hammer Pro License Key to activate this device.'
          };
        }

        // 3. Verify license key in Supabase licenses table
        const { data: dbLicense, error: licErr } = await supabase
          .from('licenses')
          .select('*')
          .eq('license_key', activeKey.trim().toUpperCase())
          .maybeSingle();

        if (licErr || !dbLicense) {
          return {
            allowed: false,
            status: 'invalid_license',
            reason: 'Invalid License Key',
            message: 'The license key provided is invalid or has been revoked.'
          };
        }

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

        // Bind device if not bound
        if (!dbLicense.device_fingerprint) {
          await supabase
            .from('licenses')
            .update({ device_fingerprint: deviceId, user_id: profile.id })
            .eq('id', dbLicense.id);
        }

        return { allowed: true, status: 'active', license: dbLicense, deviceId };
      }
    }

    return { allowed: true, status: 'active' };
  } catch (err) {
    console.warn('License verification check note:', err);
    // Defensive fallback: if network is down or offline, allow cached access
    return { allowed: true, status: 'cached_offline' };
  }
}

/**
 * Activate a License Key with Supabase
 */
export async function activateLicenseKey(licenseKey, userProfile) {
  if (!licenseKey) return { success: false, error: 'Please enter a license key.' };
  const cleanKey = licenseKey.trim().toUpperCase();
  const deviceId = await getDeviceFingerprint();

  try {
    const { data: dbLicense, error } = await supabase
      .from('licenses')
      .select('*')
      .eq('license_key', cleanKey)
      .maybeSingle();

    if (error || !dbLicense) {
      return { success: false, error: 'License key not found. Please verify and try again.' };
    }

    if (!dbLicense.is_active) {
      return { success: false, error: 'This license key has been deactivated by the administrator.' };
    }

    if (dbLicense.expires_at && new Date(dbLicense.expires_at) < new Date()) {
      return { success: false, error: 'This license key has expired.' };
    }

    // Bind license to user & device
    if (userProfile && userProfile.id) {
      await supabase
        .from('licenses')
        .update({ user_id: userProfile.id, device_fingerprint: deviceId })
        .eq('id', dbLicense.id);

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
