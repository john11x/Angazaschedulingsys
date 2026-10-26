import { useCallback, useEffect, useMemo, useState } from 'react';
import { dataClient } from '@/lib/data-client';
import {
  getCountries,
  getTimezonesForCountry,
  detectBrowserTimezone,
  type CountryOption,
  type TimezoneOption,
} from '@/lib/country-timezone';

type CreatableRole = 'COORDINATOR' | 'LEAD_TEACHER' | 'TRAINER';

interface SchoolOpt {
  id: string;
  name: string;
  type: 'MEMBER' | 'PARTNER';
  timezone: string;
}

export default function CoordinatorCreateUserPage() {
  const [schools, setSchools] = useState<SchoolOpt[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState<CreatableRole>('TRAINER');
  const [schoolId, setSchoolId] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [timezone, setTimezone] = useState(() => detectBrowserTimezone());
  const [countries] = useState<CountryOption[]>(() => getCountries());
  const [tzOptions, setTzOptions] = useState<TimezoneOption[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const loadSchools = useCallback(async () => {
    setLoadingSchools(true);
    try {
      const { data, errors } = await dataClient.models.School.list({ limit: 500 });
      if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
      setSchools(
        (data ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          type: s.type as 'MEMBER' | 'PARTNER',
          timezone: s.timezone,
        })),
      );
    } catch {
      setSchools([]);
    } finally {
      setLoadingSchools(false);
    }
  }, []);

  useEffect(() => {
    void loadSchools();
  }, [loadSchools]);

  useEffect(() => {
    if (countryCode) {
      setTzOptions(getTimezonesForCountry(countryCode));
    } else {
      setTzOptions([]);
    }
  }, [countryCode]);

  const schoolChoices = useMemo(() => {
    if (role === 'LEAD_TEACHER') return schools.filter((s) => s.type === 'MEMBER');
    if (role === 'TRAINER') return schools.filter((s) => s.type === 'PARTNER');
    return [];
  }, [schools, role]);

  useEffect(() => {
    setSchoolId('');
  }, [role]);

  // Lead Teacher inherits timezone from School
  useEffect(() => {
    if (role === 'LEAD_TEACHER' && schoolId) {
      const selected = schools.find(s => s.id === schoolId);
      if (selected) {
        setTimezone(selected.timezone);
      }
    }
  }, [role, schoolId, schools]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!fullName.trim() || !email.trim() || !timezone) {
      setError('Full name, email, and timezone are required.');
      return;
    }

    if (role !== 'COORDINATOR' && !schoolId) {
      setError(
        role === 'LEAD_TEACHER'
          ? 'Select a member school for the lead teacher.'
          : 'Select a partner school for the trainer.',
      );
      return;
    }

    setSubmitting(true);
    try {
      const { data, errors } = await dataClient.mutations.createUserByCoordinator({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phoneNumber: phoneNumber.trim() || undefined,
        role,
        schoolId: role === 'COORDINATOR' ? undefined : schoolId,
        timezone,
      });

      if (errors?.length) {
        throw new Error(errors.map((x) => x.message).join(', '));
      }

      if (!data?.success) {
        setError(data?.message ?? 'Request failed');
        return;
      }

      setResult(data.message ?? 'User invited.');
      setFullName('');
      setEmail('');
      setPhoneNumber('');
      setSchoolId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create user failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Create user</h1>
        <p className="text-slate-600 mt-1">
          Invite a coordinator, lead teacher, or trainer. They will receive a welcome email with their login details.
        </p>
      </div>

      {error && (
        <div className="alert-error px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {result && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm px-4 py-3">
          <p>{result}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as CreatableRole)}
            className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 transition-colors hover:border-slate-400 focus:border-[var(--color-brand)]"
          >
            <option value="COORDINATOR">Coordinator</option>
            <option value="LEAD_TEACHER">Lead teacher</option>
            <option value="TRAINER">Trainer</option>
          </select>
        </label>

        {role !== 'COORDINATOR' && (
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              {role === 'LEAD_TEACHER' ? 'Member school' : 'Partner school'}
            </span>
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              disabled={loadingSchools}
              className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 transition-colors hover:border-slate-400 focus:border-[var(--color-brand)] disabled:opacity-50"
            >
              <option value="">
                {loadingSchools ? 'Loading…' : `Select ${role === 'LEAD_TEACHER' ? 'member' : 'partner'} school`}
              </option>
              {schoolChoices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {schoolChoices.length === 0 && !loadingSchools && (
              <p className="text-xs text-amber-700 mt-1">
                Add a {role === 'LEAD_TEACHER' ? 'member' : 'partner'} school first under Schools.
              </p>
            )}
          </label>
        )}

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Full name</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 transition-colors hover:border-slate-400 focus:border-[var(--color-brand)]"
            autoComplete="name"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Email (login)</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 transition-colors hover:border-slate-400 focus:border-[var(--color-brand)]"
            autoComplete="email"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Phone (optional)</span>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 transition-colors hover:border-slate-400 focus:border-[var(--color-brand)]"
          />
        </label>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Country (for timezone list)</span>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 transition-colors hover:border-slate-400 focus:border-[var(--color-brand)]"
            >
              <option value="">Optional — filter timezones</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Timezone (IANA)</span>
            {role === 'LEAD_TEACHER' && schoolId ? (
              <div className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500 font-mono text-sm">
                Inherited from school: {timezone}
              </div>
            ) : countryCode && tzOptions.length > 0 ? (
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 transition-colors hover:border-slate-400 focus:border-[var(--color-brand)]"
              >
                {tzOptions.map((tz) => (
                  <option key={tz.name} value={tz.name}>
                    {tz.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="e.g. Africa/Nairobi"
                className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 font-mono text-sm transition-colors hover:border-slate-400 focus:border-[var(--color-brand)]"
              />
            )}
            {role === 'LEAD_TEACHER' && schoolId && (
              <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">
                Locked to school location
              </p>
            )}
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="focus-ring w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[var(--color-brand)] text-white font-semibold text-sm transition-colors hover:bg-[var(--color-brand-hover)] disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create user'}
        </button>
      </form>
    </div>
  );
}
