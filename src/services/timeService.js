/**
 * TimeService - Defensive Timezone & Date Normalization Engine
 * Ground Truth: US Market Time (America/New_York)
 * Supports instant display conversion to Indian Standard Time (Asia/Kolkata) or Local
 */

export const TIMEZONES = {
  US_EASTERN: 'America/New_York',
  INDIA_IST: 'Asia/Kolkata',
  LOCAL: typeof Intl !== 'undefined' ? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York') : 'America/New_York'
};

/**
 * Formats ISO date '2026-07-31' or any date to readable '31-Jul-2026'
 */
export function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  if (typeof dateStr !== 'string') {
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${d.getDate()}-${monthNames[d.getMonth()]}-${d.getFullYear()}`;
      }
    } catch (e) {}
    return String(dateStr);
  }

  try {
    const clean = dateStr.trim();
    // YYYY-MM-DD
    const isoMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (isoMatch) {
      const year = isoMatch[1];
      const monthIndex = parseInt(isoMatch[2], 10) - 1;
      const day = parseInt(isoMatch[3], 10);
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      if (monthIndex >= 0 && monthIndex < 12 && !isNaN(day)) {
        return `${day}-${monthNames[monthIndex]}-${year}`;
      }
    }

    // DD-MM-YYYY or MM-DD-YYYY
    const dmyMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (dmyMatch) {
      let p1 = parseInt(dmyMatch[1], 10);
      let p2 = parseInt(dmyMatch[2], 10);
      let y = parseInt(dmyMatch[3], 10);
      if (y < 100) y = 2000 + y;
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      
      let day = p1;
      let mIdx = p2 - 1;
      if (p1 <= 12 && p2 > 12) {
        day = p2;
        mIdx = p1 - 1;
      }
      if (mIdx >= 0 && mIdx < 12 && !isNaN(day)) {
        return `${day}-${monthNames[mIdx]}-${y}`;
      }
    }

    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${d.getUTCDate()}-${monthNames[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
    }
  } catch (e) {}
  return dateStr;
}

/**
 * Formats a Date object or timestamp string into the selected timezone
 */
export function formatInTimezone(date, timezone = 'US_EASTERN', options = {}) {
  try {
    if (!date) return '--:--:--';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '--:--:--';

    const tz = TIMEZONES[timezone] || timezone || 'America/New_York';
    const defaultOptions = {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      ...options
    };

    return new Intl.DateTimeFormat('en-US', defaultOptions).format(d);
  } catch (e) {
    console.error('TimeService format error:', e);
    return '--:--:--';
  }
}

/**
 * Checks if a given date in New York is in Daylight Saving Time (EDT: UTC-4) or Standard Time (EST: UTC-5)
 */
export function isDaylightSavingTime(date) {
  try {
    const d = date instanceof Date ? date : new Date(date || Date.now());
    if (isNaN(d.getTime())) return true;
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'short'
    }).formatToParts(d);
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    return tzPart ? tzPart.value === 'EDT' : true;
  } catch (e) {
    return true;
  }
}

/**
 * Gets dynamic short timezone badge ('EDT', 'EST', 'IST', etc.)
 */
export function getTimezoneBadge(date, timezone = 'US_EASTERN') {
  if (timezone === 'INDIA_IST') return 'IST';
  if (timezone === 'US_EASTERN' || !timezone) {
    return isDaylightSavingTime(date) ? 'EDT' : 'EST';
  }
  try {
    const d = date instanceof Date ? date : new Date(date || Date.now());
    const tz = TIMEZONES[timezone] || timezone;
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short'
    }).formatToParts(d);
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    return tzPart ? tzPart.value : 'LOCAL';
  } catch (e) {
    return 'LOCAL';
  }
}

/**
 * Gets dynamic localized full display title for chart/session headers
 */
export function getTimezoneDisplayTitle(date, timezone = 'US_EASTERN') {
  const badge = getTimezoneBadge(date, timezone);
  if (timezone === 'INDIA_IST') {
    return '🇮🇳 Indian Standard Time (IST)';
  }
  if (timezone === 'US_EASTERN' || !timezone) {
    return `🇺🇸 US Eastern Market Time (${badge})`;
  }
  return `🌐 Local Time (${badge})`;
}

/**
 * Formats full date & time with timezone abbreviation tag (e.g. "09:34:12 AM EDT" or "07:04:12 PM IST")
 */
export function formatTimeWithZoneBadge(date, timezone = 'US_EASTERN') {
  try {
    if (!date) return { time: '--:--:--', badge: getTimezoneBadge(null, timezone) };
    const timeStr = formatInTimezone(date, timezone, { hour12: true });
    const badge = getTimezoneBadge(date, timezone);
    return { time: timeStr, badge };
  } catch (e) {
    return { time: '--:--:--', badge: 'US' };
  }
}

/**
 * Generates dynamic session phase time ranges in the target timezone
 * Premarket (04:00-09:30 US), Regular (09:30-16:00 US), After-Hours (16:00-20:00 US)
 */
export function getSessionPhaseRanges(dateStr = null, timezone = 'US_EASTERN') {
  const baseDate = dateStr || new Date().toISOString().split('T')[0];
  const dPreStart = createUSMarketDate(baseDate, '04:00:00');
  const dPreEnd = createUSMarketDate(baseDate, '09:30:00');
  const dRegStart = createUSMarketDate(baseDate, '09:30:00');
  const dRegEnd = createUSMarketDate(baseDate, '16:00:00');
  const dPostStart = createUSMarketDate(baseDate, '16:00:00');
  const dPostEnd = createUSMarketDate(baseDate, '20:00:00');

  const fmt = (d) => formatInTimezone(d, timezone, { hour: '2-digit', minute: '2-digit', hour12: true });
  const badge = getTimezoneBadge(dPreStart, timezone);

  const preLabel = `${fmt(dPreStart)} - ${fmt(dPreEnd)}`;
  const regLabel = `${fmt(dRegStart)} - ${fmt(dRegEnd)}`;
  const postLabel = `${fmt(dPostStart)} - ${fmt(dPostEnd)}`;

  return {
    badge,
    premarket: { start: fmt(dPreStart), end: fmt(dPreEnd), label: `${preLabel} ${badge} (PRE)` },
    regular: { start: fmt(dRegStart), end: fmt(dRegEnd), label: `${regLabel} ${badge} (RTH)` },
    postmarket: { start: fmt(dPostStart), end: fmt(dPostEnd), label: `${postLabel} ${badge} (POST)` },
    summaryLabel: `Premarket (${preLabel} ${badge}) • Regular Hours (${regLabel} ${badge}) • After-Hours (${postLabel} ${badge})`
  };
}

/**
 * Formats a specific time window into a localized label (e.g. "09:30 - 10:00 AM (EDT)")
 */
export function formatSlotLabel(startH, startM, endH, endM, dateStr = null, timezone = 'US_EASTERN', phase = 'REG') {
  const baseDate = dateStr || new Date().toISOString().split('T')[0];
  const pad = (n) => String(n).padStart(2, '0');
  const dStart = createUSMarketDate(baseDate, `${pad(startH)}:${pad(startM)}:00`);
  const dEnd = createUSMarketDate(baseDate, `${pad(endH)}:${pad(endM)}:00`);

  const fmt = (d) => formatInTimezone(d, timezone, { hour: '2-digit', minute: '2-digit', hour12: true });
  const badge = getTimezoneBadge(dStart, timezone);

  const phaseTag = phase === 'PRE' ? ' [PRE]' : phase === 'POST' ? ' [POST]' : '';
  return `${fmt(dStart)} - ${fmt(dEnd)} (${badge})${phaseTag}`;
}

/**
 * Calculates Intraday Time Buckets (e.g. 09:30-10:00, 10:00-10:30, etc.) in US Market Time
 */
export function getTimeBucket(date, timezone = 'US_EASTERN') {
  try {
    if (!date) return '09:30-10:00';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '09:30-10:00';

    const tz = TIMEZONES[timezone] || 'America/New_York';
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });

    const parts = formatter.formatToParts(d);
    let hour = 9;
    let minute = 30;
    for (const p of parts) {
      if (p.type === 'hour') hour = parseInt(p.value, 10);
      if (p.type === 'minute') minute = parseInt(p.value, 10);
    }

    const minBucket = minute < 30 ? '00' : '30';
    const nextMinBucket = minute < 30 ? '30' : '00';
    const nextHour = minute < 30 ? hour : (hour + 1) % 24;

    const pad = (n) => n.toString().padStart(2, '0');
    return `${pad(hour)}:${minBucket}-${pad(nextHour)}:${nextMinBucket}`;
  } catch (e) {
    return '09:30-10:00';
  }
}

/**
 * Converts a US Market time string ("09:34:12") on a specific date to a JavaScript Date object in true UTC
 */
export function createUSMarketDate(dateStr, timeStr) {
  try {
    if (!dateStr) return new Date();
    const cleanDate = typeof dateStr === 'string' ? dateStr.trim() : String(dateStr);
    const cleanTime = (timeStr || '09:30:00').trim();

    const isoDate = cleanDate.includes('T') ? cleanDate.split('T')[0] : cleanDate;
    let year = 2026, month = 1, day = 1;
    const mIso = isoDate.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (mIso) {
      year = parseInt(mIso[1], 10);
      month = parseInt(mIso[2], 10);
      day = parseInt(mIso[3], 10);
    } else {
      const mDmy = isoDate.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
      if (mDmy) {
        let p1 = parseInt(mDmy[1], 10);
        let p2 = parseInt(mDmy[2], 10);
        let p3 = parseInt(mDmy[3], 10);
        if (p3 < 100) p3 = 2000 + p3;
        year = p3;
        if (p1 > 12 && p2 <= 12) { day = p1; month = p2; }
        else if (p2 > 12 && p1 <= 12) { day = p2; month = p1; }
        else { day = p1; month = p2; }
      }
    }

    const timeMatch = cleanTime.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
    let hour = 9, min = 30, sec = 0;
    if (timeMatch) {
      hour = parseInt(timeMatch[1], 10);
      min = parseInt(timeMatch[2], 10);
      sec = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
      const ampm = timeMatch[4] ? timeMatch[4].toUpperCase() : null;
      if (ampm === 'PM' && hour < 12) hour += 12;
      if (ampm === 'AM' && hour === 12) hour = 0;
    }

    const pad = (n) => n.toString().padStart(2, '0');
    const formattedDate = `${year}-${pad(month)}-${pad(day)}`;
    // Determine accurate NY offset for this specific date in UTC
    const testUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const isDst = isDaylightSavingTime(testUtc);
    const tzOffset = isDst ? '-04:00' : '-05:00';

    const fullIso = `${formattedDate}T${pad(hour)}:${pad(min)}:${pad(sec)}${tzOffset}`;
    const parsed = new Date(fullIso);
    if (!isNaN(parsed.getTime())) return parsed;

    return new Date(year, month - 1, day, hour, min, sec);
  } catch (e) {
    return new Date();
  }
}

/**
 * Gets user's stored preferred timezone or defaults to US_EASTERN
 */
export function getTimezone() {
  try {
    return localStorage.getItem('hammer_timezone_pref') || 'US_EASTERN';
  } catch (e) {
    return 'US_EASTERN';
  }
}

/**
 * Persists user's preferred timezone
 */
export function setTimezoneSetting(tz) {
  try {
    localStorage.setItem('hammer_timezone_pref', tz);
  } catch (e) {}
}
