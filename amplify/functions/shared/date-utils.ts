export const DAYS: readonly string[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** Returns day of week (SUN..SAT) for an ISO date string (YYYY-MM-DD). */
export function dateToDayOfWeek(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return DAYS[day] ?? 'MON';
}
