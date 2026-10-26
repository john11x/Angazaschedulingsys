import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { detectBrowserTimezone, isValidTimezone } from '@/lib/country-timezone';

/**
 * Frontend time utilities: UTC (backend) ↔ local (browser/profile timezone).
 * All availability and booking times are stored as UTC "HH:mm"; we display in user timezone.
 */

const REF_DATE = '2026-01-05'; // Monday, for day-of-week normalization

/** Convert UTC "HH:mm" to local "HH:mm" in the given IANA timezone for a specific date (YYYY-MM-DD). */
export function formatUTCTimeToLocal(
  utcTime: string,
  date: string,
  timezone: string,
): string {
  if (!isValidTimezone(timezone)) return utcTime;
  const [h, m] = utcTime.split(':').map(Number);
  const [y, mo, d] = date.split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, mo - 1, d, h ?? 0, m ?? 0));
  return utcDate.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  });
}

/** Convert local "HH:mm" in the given timezone on date to UTC "HH:mm". */
export function parseLocalTimeToUTC(
  localTime: string,
  date: string,
  timezone: string,
): string {
  if (!isValidTimezone(timezone)) return localTime;
  const zoned = fromZonedTime(`${date}T${localTime}:00`, timezone);
  const h = String(zoned.getUTCHours()).padStart(2, '0');
  const m = String(zoned.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** 
 * Get the timezone to use for display.
 * @param fallbackTimezone The account/profile timezone.
 * @param preferFallback If true, ignores browser location and uses fallback. Set true for Lead Teachers.
 */
export function getPreferredDisplayTimezone(
  fallbackTimezone?: string | null,
  preferFallback = false
): string {
  if (preferFallback && fallbackTimezone && isValidTimezone(fallbackTimezone)) {
    return fallbackTimezone;
  }
  const browserTimezone = detectBrowserTimezone();
  if (isValidTimezone(browserTimezone)) return browserTimezone;
  if (fallbackTimezone && isValidTimezone(fallbackTimezone)) return fallbackTimezone;
  return 'UTC';
}

/** Format a date string (YYYY-MM-DD) and UTC time range for display in local timezone. */
export function formatUTCRangeToLocal(
  startTime: string,
  endTime: string,
  date: string,
  timezone: string,
): string {
  const start = formatUTCTimeToLocal(startTime, date, timezone);
  const end = formatUTCTimeToLocal(endTime, date, timezone);
  return `${start} – ${end}`;
}

/** Convert a local range in one timezone into the equivalent range in another timezone. */
export function formatLocalRangeInTimezone(
  startTime: string,
  endTime: string,
  date: string,
  sourceTimezone: string,
  targetTimezone: string,
): string {
  const startUtc = parseLocalTimeToUTC(startTime, date, sourceTimezone);
  const endUtc = parseLocalTimeToUTC(endTime, date, sourceTimezone);
  return formatUTCRangeToLocal(startUtc, endUtc, date, targetTimezone);
}

/** Build a Date from UTC date (YYYY-MM-DD) and UTC time (HH:mm) for calendar events. */
export function utcDateAndTimeToDate(dateStr: string, utcTime: string): Date {
  return new Date(`${dateStr}T${utcTime}:00Z`);
}

/** 
 * Build a Date from UTC but "shift" it so its local components match the target timezone.
 * Useful for libraries like react-big-calendar that display in browser local time.
 */
export function utcDateAndTimeToZonedDate(dateStr: string, utcTime: string, timezone: string): Date {
  const utcDate = utcDateAndTimeToDate(dateStr, utcTime);
  return toZonedTime(utcDate, timezone);
}

/**
 * Reference date (YYYY-MM-DD) for a given day of week. Used when sending local times
 * to createSchoolAvailability so the backend can normalize to UTC.
 */
export function getReferenceDateForDay(dayOfWeek: string): string {
  const base = new Date(REF_DATE + 'T12:00:00Z');
  const dayIndex = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].indexOf(dayOfWeek);
  const baseDay = base.getUTCDay();
  const diff = (dayIndex - baseDay + 7) % 7;
  base.setUTCDate(base.getUTCDate() + diff);
  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, '0');
  const d = String(base.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Get day of week (SUN..SAT) from a date string (YYYY-MM-DD). */
export function getDayOfWeekFromDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return days[d.getUTCDay()] ?? 'MON';
}

/** Today's date (YYYY-MM-DD) in the given IANA timezone. */
export function getTodayInTimezone(timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

/** Current time (HH:mm) in the given IANA timezone. */
export function getCurrentTimeInTimezone(timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(new Date());
}

/** True if date+time is in the past in the given timezone. */
export function isPastDateTime(
  dateStr: string,
  timeStr: string,
  timezone: string,
): boolean {
  if (!isValidTimezone(timezone)) return false;
  const zoned = fromZonedTime(`${dateStr}T${timeStr}:00`, timezone);
  return zoned.getTime() <= Date.now();
}

/** Convert "HH:mm" to total minutes since midnight (for overlap comparison). */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** True if two date ranges overlap. Null/undefined means unbounded. */
function dateRangesOverlap(
  aStart: string | undefined | null,
  aEnd: string | undefined | null,
  bStart: string | undefined | null,
  bEnd: string | undefined | null,
): boolean {
  const a1 = aStart ?? '0000-01-01';
  const a2 = aEnd ?? '9999-12-31';
  const b1 = bStart ?? '0000-01-01';
  const b2 = bEnd ?? '9999-12-31';
  return a1 <= b2 && b1 <= a2;
}

/** True if two time ranges overlap. End times are exclusive (09:00–10:00 and 10:00–11:00 do not overlap). */
export function timeRangesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  const start1 = timeToMinutes(s1);
  const end1 = timeToMinutes(e1);
  const start2 = timeToMinutes(s2);
  const end2 = timeToMinutes(e2);
  return start1 < end2 && start2 < end1;
}

export interface SlotForOverlap {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  startDate?: string | null;
  endDate?: string | null;
}

/** True if two availability slots overlap (same day, overlapping date range, overlapping time range). */
export function slotsOverlap(a: SlotForOverlap, b: SlotForOverlap): boolean {
  if (a.dayOfWeek !== b.dayOfWeek) return false;
  if (!dateRangesOverlap(a.startDate, a.endDate, b.startDate, b.endDate)) return false;
  return timeRangesOverlap(a.startTime, a.endTime, b.startTime, b.endTime);
}

export { REF_DATE };
