/**
 * Dynamic Version Gate & 7-Day Hard Expiry Manager
 * Ensures out-of-date apps are blocked after a 7-day grace period
 */

import { supabase } from './supabaseClient';

export const CURRENT_APP_VERSION = '2.0.0';
const OUTDATED_DETECTED_KEY = 'hammer_outdated_first_seen';

/**
 * Compare two semver version strings (e.g. "2.0.0" vs "1.0.3")
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareSemver(v1, v2) {
  if (!v1 || !v2) return 0;
  const p1 = v1.replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n, 10) || 0);
  const p2 = v2.replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n, 10) || 0);

  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Check version status against Supabase app_config with 7-day hard expiry enforcement
 */
export async function checkAppVersionStatus() {
  try {
    const { data: row } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'updater_config')
      .maybeSingle();

    const config = row?.value || {
      latest_version: CURRENT_APP_VERSION,
      min_version: CURRENT_APP_VERSION,
      grace_period_days: 7,
      download_url: 'https://github.com/Web-Traveller/hammer-pro-journal/releases'
    };

    const latestVersion = config.latest_version || CURRENT_APP_VERSION;
    const minVersion = config.min_version || CURRENT_APP_VERSION;
    const graceDays = config.grace_period_days || 7;
    const downloadUrl = config.download_url || 'https://github.com/Web-Traveller/hammer-pro-journal/releases';

    // 1. If current version is below the absolute MINIMUM required version -> Instant Force Lock
    if (compareSemver(CURRENT_APP_VERSION, minVersion) < 0) {
      return {
        isOutdated: true,
        forceUpdate: true,
        reason: 'min_version_breached',
        currentVersion: CURRENT_APP_VERSION,
        latestVersion,
        downloadUrl,
        message: `Version ${CURRENT_APP_VERSION} is deprecated. Mandatory update to v${latestVersion} required.`
      };
    }

    // 2. If current version is behind the LATEST version -> Check 7-Day Grace Period
    if (compareSemver(CURRENT_APP_VERSION, latestVersion) < 0) {
      let firstSeen = localStorage.getItem(OUTDATED_DETECTED_KEY);
      if (!firstSeen) {
        firstSeen = Date.now().toString();
        localStorage.setItem(OUTDATED_DETECTED_KEY, firstSeen);
      }

      const elapsedMs = Date.now() - parseInt(firstSeen, 10);
      const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
      const daysRemaining = Math.max(0, Math.ceil(graceDays - elapsedDays));

      // If 7 days have elapsed without updating -> Force Lock the application
      if (elapsedDays >= graceDays) {
        return {
          isOutdated: true,
          forceUpdate: true,
          reason: 'grace_period_expired',
          currentVersion: CURRENT_APP_VERSION,
          latestVersion,
          downloadUrl,
          message: `The 7-day grace period for updating to v${latestVersion} has expired. Please update to continue.`
        };
      }

      // Within 7 days -> Soft warning
      return {
        isOutdated: true,
        forceUpdate: false,
        daysRemaining,
        currentVersion: CURRENT_APP_VERSION,
        latestVersion,
        downloadUrl,
        message: `A new version (v${latestVersion}) is available. ${daysRemaining} day(s) remaining before mandatory lock.`
      };
    }

    // App is up to date! Clear any outdated tracking timestamp
    localStorage.removeItem(OUTDATED_DETECTED_KEY);
    return { isOutdated: false, forceUpdate: false, currentVersion: CURRENT_APP_VERSION };

  } catch (e) {
    console.warn('Version check note:', e);
    return { isOutdated: false, forceUpdate: false, currentVersion: CURRENT_APP_VERSION };
  }
}
