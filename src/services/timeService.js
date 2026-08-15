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
 * Formats full date & time with timezone abbreviation tag (e.g. "09:34:12 AM EDT" or "07:04:12 PM IST")
 */
export function formatTimeWithZoneBadge(date, timezone = 'US_EASTERN') {
  try {
    if (!date) return { time: '--:--:--', badge: timezone === 'INDIA_IST' ? 'IST' : 'EDT' };
    const timeStr = formatInTimezone(date, timezone, { hour12: true });
    let badge = 'EDT';
    if (timezone === 'INDIA_IST') {
      badge = 'IST';
    } else {
      badge = isDaylightSavingTime(date) ? 'EDT' : 'EST';
    }
    return { time: timeStr, badge };
  } catch (e) {
    return { time: '--:--:--', badge: 'US' };
  }
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
    const cleanDate = dateStr.trim();
    const cleanTime = (timeStr || '09:30:00').trim();

    const isoDate = cleanDate.includes('T') ? cleanDate.split('T')[0] : cleanDate;
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
    // Determine accurate NY offset for this specific date
    const testUtc = new Date(`${isoDate}T12:00:00Z`);
    const isDst = isDaylightSavingTime(testUtc);
    const tzOffset = isDst ? '-04:00' : '-05:00';

    const fullIso = `${isoDate}T${pad(hour)}:${pad(min)}:${pad(sec)}${tzOffset}`;
    const parsed = new Date(fullIso);
    if (!isNaN(parsed.getTime())) return parsed;

    return new Date(`${isoDate} ${pad(hour)}:${pad(min)}:${pad(sec)}`);
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
