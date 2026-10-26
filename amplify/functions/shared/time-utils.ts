import { fromZonedTime } from 'date-fns-tz';
import { isValidTimezone, resolvePrimaryTimezone } from './country-timezone';

/**
 * Central UTC conversion module.
 *
 * All availability stored in DynamoDB uses UTC "HH:mm". The source IANA
 * timezone is stored alongside for UI rendering. This class handles every
 * conversion between local browser time and UTC.
 */
export class TimeUtils {
  /**
   * Validate and resolve an IANA timezone string.
   * Throws if the timezone is invalid or deprecated.
   * Resolves aliases to their primary name (e.g. "Asia/Tel_Aviv" → "Asia/Jerusalem").
   */
  static validateTimezone(timezone: string): string {
    if (!isValidTimezone(timezone)) {
      throw new Error(`Invalid or deprecated IANA timezone: "${timezone}"`);
    }
    return resolvePrimaryTimezone(timezone);
  }

  /** Convert a local "HH:mm" in the given IANA timezone on a specific date to UTC "HH:mm". */
  static toUTC(localTime: string, date: string, timezone: string): string {
    const utcDate = fromZonedTime(`${date}T${localTime}:00`, timezone);
    const h = String(utcDate.getUTCHours()).padStart(2, '0');
    const m = String(utcDate.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  /** Convert a UTC "HH:mm" to local "HH:mm" in the given IANA timezone for a specific date. */
  static fromUTC(utcTime: string, date: string, timezone: string): string {
    const [hours, minutes] = utcTime.split(':').map(Number);
    const [y, mo, d] = date.split('-').map(Number);
    const utcDate = new Date(Date.UTC(y, mo - 1, d, hours, minutes));
    return utcDate.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    });
  }

  /**
   * Normalize a start/end time pair from local timezone to UTC.
   * Use as middleware before writing availability to DynamoDB.
   */
  static normalizeToUTC(input: {
    startTime: string;
    endTime: string;
    date: string;
    timezone: string;
  }): { startTime: string; endTime: string } {
    return {
      startTime: TimeUtils.toUTC(input.startTime, input.date, input.timezone),
      endTime: TimeUtils.toUTC(input.endTime, input.date, input.timezone),
    };
  }

  /** Convert "HH:mm" to total minutes since midnight (for overlap comparison). */
  static timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  /** Convert total minutes back to "HH:mm". */
  static minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /** Current timestamp in ISO 8601 UTC. */
  static nowUTC(): string {
    return new Date().toISOString();
  }

  /** Today's date (YYYY-MM-DD) in the given IANA timezone. */
  static getTodayInTimezone(timezone: string): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  }

  /** True if date+time is in the past in the given timezone. */
  static isPastDateTime(dateStr: string, timeStr: string, timezone: string): boolean {
    const zoned = fromZonedTime(`${dateStr}T${timeStr}:00`, timezone);
    return zoned.getTime() <= Date.now();
  }

  /** True if two date ranges overlap. Null/undefined means unbounded. */
  static dateRangesOverlap(
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

  /** True if two time ranges overlap (end times exclusive). */
  static timeRangesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
    const start1 = TimeUtils.timeToMinutes(s1);
    const end1 = TimeUtils.timeToMinutes(e1);
    const start2 = TimeUtils.timeToMinutes(s2);
    const end2 = TimeUtils.timeToMinutes(e2);
    return start1 < end2 && start2 < end1;
  }

  /** True if two availability slots overlap. */
  static slotsOverlap(
    a: { dayOfWeek: string; startTime: string; endTime: string; startDate?: string | null; endDate?: string | null },
    b: { dayOfWeek: string; startTime: string; endTime: string; startDate?: string | null; endDate?: string | null },
  ): boolean {
    if (a.dayOfWeek !== b.dayOfWeek) return false;
    if (!TimeUtils.dateRangesOverlap(a.startDate, a.endDate, b.startDate, b.endDate)) return false;
    return TimeUtils.timeRangesOverlap(a.startTime, a.endTime, b.startTime, b.endTime);
  }
}
