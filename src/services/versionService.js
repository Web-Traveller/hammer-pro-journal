/**
 * Dynamic Version Gate & 7-Day Hard Expiry Manager
 * Supports Desktop (Windows Tauri) and Mobile (Android Tauri / Web)
 */

import { supabase } from './supabaseClient';
import { APP_VERSION } from '../version';

export const CURRENT_APP_VERSION = APP_VERSION;
const OUTDATED_DETECTED_KEY = 'hammer_outdated_first_seen';

/**
 * Compare two semver version strings (e.g. "2.3.3" vs "2.3.1")
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
 * Check version status against latest manifest and Supabase app_config
 */
export async function checkAppVersionStatus() {
  try {
    // Robust platform detection
    const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || '');
    const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent || '');
    const isMobile = isAndroid || isIOS || (typeof window !== 'undefined' && (window.Capacitor !== undefined || window.isNativeMobile === true || /mobile/i.test(navigator.userAgent || '')));

    // 1. Try to fetch live latest.json manifest first
    let manifest = null;
    const manifestUrls = [
      'https://raw.githubusercontent.com/Web-Traveller/hammer-pro-journal/main/public/latest.json',
      './latest.json'
    ];

    for (const url of manifestUrls) {
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (res.ok) {
          const json = await res.json();
          if (json && json.version) {
            manifest = json;
            break;
          }
        }
      } catch (err) {
        // Continue to fallback
      }
    }

    // 2. Fetch Supabase app_config updater_config as well
    let supabaseConfig = null;
    try {
      const { data: row } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'updater_config')
        .maybeSingle();
      if (row?.value) {
        supabaseConfig = row.value;
      }
    } catch (sbErr) {
      // Supabase offline/unreachable fallback
    }

    // 3. Consolidate Latest & Min versions
    const fallbackLatest = manifest?.version || CURRENT_APP_VERSION;

    let latestVersion = isMobile
      ? (supabaseConfig?.latest_version_mobile || supabaseConfig?.mobile?.latest_version || fallbackLatest)
      : (supabaseConfig?.latest_version_desktop || supabaseConfig?.desktop?.latest_version || fallbackLatest);

    let minVersion = isMobile
      ? (supabaseConfig?.min_version_mobile || supabaseConfig?.mobile?.min_version || fallbackLatest)
      : (supabaseConfig?.min_version_desktop || supabaseConfig?.desktop?.min_version || fallbackLatest);

    if (compareSemver(latestVersion, minVersion) < 0) {
      latestVersion = minVersion;
    }

    // 4. Resolve exact platform download URL
    let downloadUrl = '';
    if (isMobile) {
      if (manifest?.platforms?.android?.url) {
        downloadUrl = manifest.platforms.android.url;
      } else if (supabaseConfig?.download_url_android) {
        downloadUrl = supabaseConfig.download_url_android;
      } else {
        downloadUrl = `https://github.com/Web-Traveller/hammer-pro-journal/releases/download/v${latestVersion}/HammerPro-Journal-v${latestVersion}-Android.apk`;
      }
    } else {
      if (manifest?.platforms?.['windows-x86_64']?.url) {
        downloadUrl = manifest.platforms['windows-x86_64'].url;
      } else if (manifest?.platforms?.['windows-x86_64-nsis']?.url) {
        downloadUrl = manifest.platforms['windows-x86_64-nsis'].url;
      } else if (supabaseConfig?.download_url_desktop) {
        downloadUrl = supabaseConfig.download_url_desktop;
      } else {
        downloadUrl = `https://github.com/Web-Traveller/hammer-pro-journal/releases/download/v${latestVersion}/Hammer.Pro.Journal_${latestVersion}_x64-setup.exe`;
      }
    }

    const graceDays = supabaseConfig?.grace_period_days || 7;

    // 5. Version Evaluation
    // A. Hard block if below min required version
    if (compareSemver(CURRENT_APP_VERSION, minVersion) < 0) {
      return {
        isOutdated: true,
        forceUpdate: true,
        isMobile,
        isAndroid,
        reason: 'min_version_breached',
        currentVersion: CURRENT_APP_VERSION,
        latestVersion,
        downloadUrl,
        message: `Version ${CURRENT_APP_VERSION} is deprecated. Mandatory update to v${latestVersion} required.`
      };
    }

    // B. Check grace period if behind latest version
    if (compareSemver(CURRENT_APP_VERSION, latestVersion) < 0) {
      let firstSeen = localStorage.getItem(OUTDATED_DETECTED_KEY);
      if (!firstSeen) {
        firstSeen = Date.now().toString();
        localStorage.setItem(OUTDATED_DETECTED_KEY, firstSeen);
      }

      const elapsedMs = Date.now() - parseInt(firstSeen, 10);
      const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
      const daysRemaining = Math.max(0, Math.ceil(graceDays - elapsedDays));

      if (elapsedDays >= graceDays) {
        return {
          isOutdated: true,
          forceUpdate: true,
          isMobile,
          isAndroid,
          reason: 'grace_period_expired',
          currentVersion: CURRENT_APP_VERSION,
          latestVersion,
          downloadUrl,
          message: `The ${graceDays}-day grace period for updating to v${latestVersion} has expired. Please update to continue.`
        };
      }

      return {
        isOutdated: true,
        forceUpdate: false,
        isMobile,
        isAndroid,
        daysRemaining,
        currentVersion: CURRENT_APP_VERSION,
        latestVersion,
        downloadUrl,
        message: `A new version (v${latestVersion}) is available. ${daysRemaining} day(s) remaining before mandatory lock.`
      };
    }

    // App is up-to-date!
    localStorage.removeItem(OUTDATED_DETECTED_KEY);
    return { isOutdated: false, forceUpdate: false, isMobile, isAndroid, currentVersion: CURRENT_APP_VERSION };

  } catch (e) {
    console.warn('Version check notice:', e);
    return { isOutdated: false, forceUpdate: false, isMobile: false, currentVersion: CURRENT_APP_VERSION };
  }
}

/**
 * Silent Background Auto-Updater Engine for Desktop (Tauri)
 */
export async function checkAndApplySilentUpdate(forceUpdate = false, onToast = null) {
  try {
    const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || '');
    if (isAndroid) {
      // Android does not support native silent background self-replacement; updates are handled via APK download
      return null;
    }

    if (typeof window === 'undefined' || (!window.__TAURI_INTERNALS__ && !window.__TAURI__)) {
      return null;
    }
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();

    if (update && update.available) {
      console.log('[UPDATER] New desktop update found:', update.version);
      if (forceUpdate) {
        if (onToast) onToast(`Mandatory update v${update.version} downloading...`, 'info');
        await update.downloadAndInstall();
      } else {
        await update.download();
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const appWindow = getCurrentWindow();
          await appWindow.onCloseRequested(async (event) => {
            event.preventDefault();
            await update.install();
          });
        } catch (winErr) {
          console.warn('[UPDATER] Could not attach window exit hook:', winErr);
        }
      }
      return update;
    }
  } catch (err) {
    console.warn('[UPDATER] Background check error:', err);
  }
  return null;
}
