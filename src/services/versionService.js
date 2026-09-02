/**
 * Dynamic Version Gate & 7-Day Hard Expiry Manager
 * Ensures out-of-date apps are blocked after a 7-day grace period
 */

import { supabase } from './supabaseClient';
import { APP_VERSION } from '../version';

export const CURRENT_APP_VERSION = APP_VERSION;
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
    const isTauriDesktop = typeof window !== 'undefined' && (window.__TAURI_INTERNALS__ !== undefined || window.__TAURI__ !== undefined);
    const hasMobileUA = typeof window !== 'undefined' && /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '');
    const isCapacitor = typeof window !== 'undefined' && (window.Capacitor !== undefined || window.isNativeMobile === true);
    
    // Explicit platform decision
    const isMobile = (hasMobileUA || isCapacitor) && !isTauriDesktop;

    const { data: row } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'updater_config')
      .maybeSingle();

    const config = row?.value || {
      latest_version_desktop: CURRENT_APP_VERSION,
      min_version_desktop: CURRENT_APP_VERSION,
      latest_version_mobile: '2.0.0',
      min_version_mobile: '2.0.0',
      grace_period_days: 7,
      download_url_desktop: 'https://github.com/Web-Traveller/hammer-pro-journal/releases/latest',
      download_url_android: 'https://github.com/Web-Traveller/hammer-pro-journal/releases/latest'
    };

    // Platform-Aware Independent Version & Download Routing
    const latestVersion = isMobile
      ? (config.latest_version_mobile || config.mobile?.latest_version || config.latest_version || '2.0.0')
      : (config.latest_version_desktop || config.desktop?.latest_version || config.latest_version || CURRENT_APP_VERSION);

    const minVersion = isMobile
      ? (config.min_version_mobile || config.mobile?.min_version || config.min_version || '2.0.0')
      : (config.min_version_desktop || config.desktop?.min_version || config.min_version || CURRENT_APP_VERSION);

    const graceDays = config.grace_period_days || 7;

    const downloadUrl = isMobile
      ? (config.download_url_android || config.mobile?.download_url || config.download_url || 'https://github.com/Web-Traveller/hammer-pro-journal/releases/latest')
      : (config.download_url_desktop || config.desktop?.download_url || config.download_url || 'https://github.com/Web-Traveller/hammer-pro-journal/releases/latest');

    // 1. If current version is below the absolute MINIMUM required version -> Instant Force Lock
    if (compareSemver(CURRENT_APP_VERSION, minVersion) < 0) {
      return {
        isOutdated: true,
        forceUpdate: true,
        isMobile,
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
          isMobile,
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
        isMobile,
        daysRemaining,
        currentVersion: CURRENT_APP_VERSION,
        latestVersion,
        downloadUrl,
        message: `A new version (v${latestVersion}) is available. ${daysRemaining} day(s) remaining before mandatory lock.`
      };
    }

    // App is up to date! Clear any outdated tracking timestamp
    localStorage.removeItem(OUTDATED_DETECTED_KEY);
    return { isOutdated: false, forceUpdate: false, isMobile, currentVersion: CURRENT_APP_VERSION };

  } catch (e) {
    console.warn('Version check note:', e);
    return { isOutdated: false, forceUpdate: false, isMobile: false, currentVersion: CURRENT_APP_VERSION };
  }
}

/**
 * Silent Background Auto-Updater Engine (Referenced from ecn-trainer)
 * Checks for updates in background via @tauri-apps/plugin-updater.
 * For mandatory/force updates: downloads and installs immediately.
 * For normal updates: downloads silently in background, then binds an onCloseRequested window hook
 * to install the update when the app closes or restarts.
 */
export async function checkAndApplySilentUpdate(forceUpdate = false, onToast = null) {
  try {
    if (typeof window === 'undefined' || (!window.__TAURI_INTERNALS__ && !window.__TAURI__)) {
      return null;
    }
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();

    if (update && update.available) {
      console.log('[UPDATER] New update version found:', update.version);
      if (forceUpdate) {
        console.log('[UPDATER] Force update required. Downloading & installing immediately...');
        if (onToast) onToast(`Mandatory update v${update.version} downloading...`, 'info');
        await update.downloadAndInstall();
      } else {
        console.log('[UPDATER] Normal background update. Downloading silently in background...');
        // 100% silent background download (no user-facing toast popup)
        await update.download();
        console.log('[UPDATER] Silent download complete. Registering exit installation hook...');

        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const appWindow = getCurrentWindow();
          await appWindow.onCloseRequested(async (event) => {
            console.log('[UPDATER] Applying update silently on app exit...');
            event.preventDefault();
            await update.install();
          });
        } catch (winErr) {
          console.warn('[UPDATER] Could not attach window exit hook:', winErr);
        }
      }
      return update;
    }
    return null;
  } catch (err) {
    console.warn('[UPDATER] Silent update check note:', err);
    return null;
  }
}

