import {
  getAllCountries,
  getTimezonesForCountry as getTimezonesFn,
  getTimezone,
  getCountryForTimezone as getCountryFn,
  type Country,
} from 'countries-and-timezones';

export interface CountryOption {
  id: string;
  name: string;
  timezones: string[];
}

export interface TimezoneOption {
  name: string;
  utcOffsetStr: string;
  label: string; // e.g. "(UTC+03:00) Africa/Nairobi"
}

/** All countries sorted alphabetically by name. */
export function getCountries(): CountryOption[] {
  const all = getAllCountries() as Record<string, Country>;
  return Object.values(all)
    .map(({ id, name, timezones }) => ({ id, name, timezones: timezones as string[] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** All IANA timezones for a given ISO 3166-1 country code, formatted for UI selects. */
export function getTimezonesForCountry(countryCode: string): TimezoneOption[] {
  const timezones = getTimezonesFn(countryCode);
  if (!timezones) return [];

  return timezones
    .filter((tz) => !tz.aliasOf)
    .map((tz) => ({
      name: tz.name,
      utcOffsetStr: tz.utcOffsetStr,
      label: `(UTC${tz.utcOffsetStr}) ${tz.name}`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Validate that a string is a real, non-deprecated IANA timezone. */
export function isValidTimezone(name: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: name });
    return true;
  } catch {
    const tz = getTimezone(name);
    return tz != null && !tz.deprecated;
  }
}

/** Resolve the primary timezone name if an alias is given. */
export function resolvePrimaryTimezone(name: string): string {
  const tz = getTimezone(name);
  if (!tz) return name;
  return tz.aliasOf ?? tz.name;
}

/** Get the most likely country code for a given IANA timezone. */
export function getCountryForTimezone(name: string): string | null {
  const country = getCountryFn(name);
  return country?.id ?? null;
}
