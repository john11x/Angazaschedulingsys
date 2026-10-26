import { useCallback, useEffect, useState } from 'react';
import { dataClient } from '@/lib/data-client';
import {
  getCountries,
  getTimezonesForCountry,
  type CountryOption,
  type TimezoneOption,
} from '@/lib/country-timezone';

type SchoolType = 'MEMBER' | 'PARTNER';

interface SchoolRow {
  id: string;
  name: string;
  type: SchoolType;
  country: string;
  city: string;
  timezone: string;
}

export default function CoordinatorSchoolsPage() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<SchoolType>('MEMBER');
  const [countryCode, setCountryCode] = useState('');
  const [city, setCity] = useState('');
  const [timezone, setTimezone] = useState('');
  const [countries] = useState<CountryOption[]>(() => getCountries());
  const [tzOptions, setTzOptions] = useState<TimezoneOption[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, errors } = await dataClient.models.School.list({ limit: 500 });
      if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
      setSchools(
        (data ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          type: s.type as SchoolType,
          country: s.country,
          city: s.city,
          timezone: s.timezone,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load schools');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (countryCode) {
      setTzOptions(getTimezonesForCountry(countryCode));
      setTimezone('');
    } else {
      setTzOptions([]);
    }
  }, [countryCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!name.trim() || !countryCode || !city.trim() || !timezone) {
      setError('Fill in name, country, city, and timezone.');
      return;
    }
    const countryName = countries.find((c) => c.id === countryCode)?.name ?? countryCode;
    setSaving(true);
    try {
      const { errors } = await dataClient.models.School.create({
        name: name.trim(),
        type,
        country: countryName,
        city: city.trim(),
        timezone,
      });
      if (errors?.length) throw new Error(errors.map((x) => x.message).join(', '));
      setSuccess(`School "${name.trim()}" created.`);
      setName('');
      setCity('');
      setCountryCode('');
      setTimezone('');
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  const memberSchools = schools.filter((s) => s.type === 'MEMBER');
  const partnerSchools = schools.filter((s) => s.type === 'PARTNER');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Schools</h1>
        <p className="text-slate-600 mt-1">
          Member schools need training; partner schools supply trainers.
        </p>
      </div>

      {error && (
        <div className="alert-error px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3">
          {success}
        </div>
      )}

      <section className="card p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Add school</h2>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 max-w-3xl">
          <label className="sm:col-span-2 block">
            <span className="text-sm font-medium text-slate-700">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
              placeholder="School name"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as SchoolType)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
            >
              <option value="MEMBER">Member school (demand)</option>
              <option value="PARTNER">Partner school (trainers)</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Country</span>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
            >
              <option value="">Select country</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">City</span>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
              placeholder="City"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Timezone</span>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              disabled={!countryCode}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 disabled:opacity-50"
            >
              <option value="">{countryCode ? 'Select timezone' : 'Pick country first'}</option>
              {tzOptions.map((tz) => (
                <option key={tz.name} value={tz.name}>
                  {tz.label}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-[var(--color-brand)] text-white font-semibold text-sm disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Create school'}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-slate-900">Existing schools</h2>
        {loading ? (
          <p className="text-slate-500 text-sm">Loading…</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-slate-500 mb-2">Member ({memberSchools.length})</h3>
              <ul className="rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white text-sm">
                {memberSchools.length === 0 ? (
                  <li className="px-4 py-3 text-slate-500">None yet</li>
                ) : (
                  memberSchools.map((s) => (
                    <li key={s.id} className="px-4 py-3">
                      <p className="font-medium text-slate-900">{s.name}</p>
                      <p className="text-slate-500">
                        {s.city}, {s.country} · {s.timezone}
                      </p>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-500 mb-2">Partner ({partnerSchools.length})</h3>
              <ul className="rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white text-sm">
                {partnerSchools.length === 0 ? (
                  <li className="px-4 py-3 text-slate-500">None yet</li>
                ) : (
                  partnerSchools.map((s) => (
                    <li key={s.id} className="px-4 py-3">
                      <p className="font-medium text-slate-900">{s.name}</p>
                      <p className="text-slate-500">
                        {s.city}, {s.country} · {s.timezone}
                      </p>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
