import { useCallback, useMemo, useState } from 'react';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';
import {
  formatLocalRangeInTimezone,
  formatUTCRangeToLocal,
  formatUTCTimeToLocal,
  getCurrentTimeInTimezone,
  getDayOfWeekFromDate,
  getPreferredDisplayTimezone,
  getReferenceDateForDay,
  getTodayInTimezone,
  isPastDateTime,
  parseLocalTimeToUTC,
  slotsOverlap,
  type SlotForOverlap,
} from '@/lib/time-utils';

type SlotMode = 'recurring' | 'one-off';

const WEEKDAYS: Array<{ value: string; label: string }> = [
  { value: 'MON', label: 'Mon' },
  { value: 'TUE', label: 'Tue' },
  { value: 'WED', label: 'Wed' },
  { value: 'THU', label: 'Thu' },
  { value: 'FRI', label: 'Fri' },
];

export interface AvailabilitySlotRecord {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  timezone: string;
  isRecurring: boolean;
  startDate?: string | null;
  endDate?: string | null;
}

export interface AvailabilityInput {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  timezone: string;
  isRecurring: boolean;
  startDate?: string;
  endDate?: string;
}

interface AvailabilityManagerProps {
  title: string;
  description: string;
  slots: AvailabilitySlotRecord[];
  loading: boolean;
  saving: boolean;
  deletingId?: string | null;
  fallbackTimezone?: string | null;
  comparisonTimezone?: string | null;
  comparisonLabel?: string;
  error?: string | null;
  success?: string | null;
  preferFallback?: boolean;
  onCreateSlots: (inputs: AvailabilityInput[]) => Promise<void>;
  onDeleteSlot?: (availabilityId: string) => Promise<void>;
}

function getMonthBounds(timezone: string): { min: string; max: string } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = (d: Date) =>
    Object.fromEntries(formatter.formatToParts(d).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  const y = Number(parts(now).year);
  const m = Number(parts(now).month);
  const min = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const max = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { min, max };
}

function slotFallsInMonth(
  slot: AvailabilitySlotRecord,
  min: string,
  max: string,
): boolean {
  if (slot.startDate && slot.endDate) {
    return slot.startDate <= max && slot.endDate >= min;
  }
  if (slot.startDate) return slot.startDate <= max;
  if (slot.endDate) return slot.endDate >= min;
  return true;
}

function formatAvailabilitySummary(
  slots: AvailabilitySlotRecord[],
  deviceTimezone: string,
  getReferenceDateForDay: (d: string) => string,
  formatUTCRangeToLocal: (s: string, e: string, d: string, tz: string) => string,
): { count: number; daysStr: string; timeStr: string } | null {
  const { min, max } = getMonthBounds(deviceTimezone);
  const slotsThisMonth = slots.filter((s) => slotFallsInMonth(s, min, max));
  if (slotsThisMonth.length === 0) return null;

  const dayLabels: Record<string, string> = {
    MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat', SUN: 'Sun',
  };
  const uniqueDays = [...new Set(slotsThisMonth.map((s) => s.dayOfWeek))].sort();
  const timeRanges = new Set<string>();
  slotsThisMonth.forEach((s) => {
    const ref = s.startDate ?? getReferenceDateForDay(s.dayOfWeek);
    timeRanges.add(formatUTCRangeToLocal(s.startTime, s.endTime, ref, deviceTimezone));
  });
  const daysStr = uniqueDays.map((d) => dayLabels[d] ?? d).join(', ');
  const timeStr =
    timeRanges.size === 1
      ? Array.from(timeRanges)[0]
      : timeRanges.size > 1
        ? 'Various times'
        : '';
  return { count: slotsThisMonth.length, daysStr, timeStr };
}

export default function AvailabilityManager({
  title,
  description,
  slots,
  loading,
  saving,
  deletingId,
  fallbackTimezone,
  comparisonTimezone,
  comparisonLabel = 'School timezone',
  error,
  success,
  preferFallback = false,
  onCreateSlots,
  onDeleteSlot,
}: AvailabilityManagerProps) {
  const deviceTimezone = useMemo(
    () => getPreferredDisplayTimezone(fallbackTimezone, preferFallback),
    [fallbackTimezone, preferFallback],
  );

  const profileTimezone = fallbackTimezone ?? null;
  const browserDiffersFromProfile =
    !!profileTimezone && profileTimezone !== deviceTimezone;

  const [mode, setMode] = useState<SlotMode>('recurring');
  const [selectedDays, setSelectedDays] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(WEEKDAYS.map((d) => [d.value, false])),
  );
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [recurringStartDate, setRecurringStartDate] = useState('');
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [oneOffSingleDate, setOneOffSingleDate] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tzConfirmOpen, setTzConfirmOpen] = useState(false);
  const [pendingSlots, setPendingSlots] = useState<AvailabilityInput[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = () => {
    setStartTime('09:00');
    setEndTime('17:00');
    setRecurringStartDate('');
    setRecurringEndDate('');
    setOneOffSingleDate('');
    setSelectedDays(Object.fromEntries(WEEKDAYS.map((d) => [d.value, false])));
  };

  const selectedDayList = useMemo(
    () => WEEKDAYS.filter((d) => selectedDays[d.value]).map((d) => d.value),
    [selectedDays],
  );

  const toggleDay = useCallback((day: string) => {
    setSelectedDays((prev) => ({ ...prev, [day]: !prev[day] }));
  }, []);

  const buildInputs = (): AvailabilityInput[] => {
    if (mode === 'recurring') {
      if (selectedDayList.length === 0) {
        throw new Error('Please select at least one day.');
      }

      if (recurringStartDate && recurringEndDate) {
        const daysInRange = new Set<string>();
        const cur = new Date(`${recurringStartDate}T12:00:00Z`);
        const end = new Date(`${recurringEndDate}T12:00:00Z`);
        const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        while (cur <= end) {
          daysInRange.add(dayNames[cur.getUTCDay()]);
          cur.setUTCDate(cur.getUTCDate() + 1);
        }
        const missing = selectedDayList.filter((d) => !daysInRange.has(d));
        if (missing.length === selectedDayList.length) {
          const labels = missing.map((d) => WEEKDAYS.find((w) => w.value === d)?.label ?? d);
          throw new Error(
            `None of the selected days (${labels.join(', ')}) fall within ${recurringStartDate} to ${recurringEndDate}. Choose different days or widen the date range.`,
          );
        }
        if (missing.length > 0) {
          const labels = missing.map((d) => WEEKDAYS.find((w) => w.value === d)?.label ?? d);
          throw new Error(
            `${labels.join(', ')} ${missing.length === 1 ? 'does' : 'do'} not appear between ${recurringStartDate} and ${recurringEndDate}. Remove ${missing.length === 1 ? 'it' : 'them'} or widen the date range.`,
          );
        }
      }

      return selectedDayList.map((dayOfWeek) => ({
        dayOfWeek,
        startTime,
        endTime,
        timezone: deviceTimezone,
        isRecurring: true,
        startDate: recurringStartDate || undefined,
        endDate: recurringEndDate || undefined,
      }));
    }

    if (!oneOffSingleDate) {
      throw new Error('Please select a date.');
    }

    return [
      {
        dayOfWeek: getDayOfWeekFromDate(oneOffSingleDate),
        startTime,
        endTime,
        timezone: deviceTimezone,
        isRecurring: false,
        startDate: oneOffSingleDate,
        endDate: oneOffSingleDate,
      },
    ];
  };

  const convertToSchoolTimezone = (
    inputs: AvailabilityInput[],
    targetTimezone: string,
  ): AvailabilityInput[] =>
    inputs.map((input) => {
      const date = input.startDate ?? getReferenceDateForDay(input.dayOfWeek);
      const utcStart = parseLocalTimeToUTC(input.startTime, date, input.timezone);
      const utcEnd = parseLocalTimeToUTC(input.endTime, date, input.timezone);
      return {
        ...input,
        timezone: targetTimezone,
        startTime: formatUTCTimeToLocal(utcStart, date, targetTimezone),
        endTime: formatUTCTimeToLocal(utcEnd, date, targetTimezone),
      };
    });

  const minDate = useMemo(
    () => getTodayInTimezone(deviceTimezone),
    [deviceTimezone],
  );
  const minTimeForToday = useMemo(
    () => getCurrentTimeInTimezone(deviceTimezone),
    [deviceTimezone],
  );

  const isSelectedDateToday =
    (mode === 'recurring' && recurringStartDate === minDate) ||
    (mode === 'one-off' && oneOffSingleDate === minDate);

  const submitInputs = async (
    inputs: AvailabilityInput[],
    convertToSchool?: string,
  ) => {
    const toSend =
      convertToSchool ? convertToSchoolTimezone(inputs, convertToSchool) : inputs;
    await onCreateSlots(toSend);
    resetForm();
  };

  const validateNoPastSlots = (inputs: AvailabilityInput[]) => {
    for (const input of inputs) {
      const date = input.startDate ?? getReferenceDateForDay(input.dayOfWeek);
      if (date < minDate) {
        throw new Error('Cannot set availability for past dates.');
      }
      if (date === minDate && isPastDateTime(date, input.startTime, deviceTimezone)) {
        throw new Error('Start time cannot be in the past for today.');
      }
    }
  };

  const inputToUtcSlot = (input: AvailabilityInput): SlotForOverlap => {
    const date = input.startDate ?? getReferenceDateForDay(input.dayOfWeek);
    return {
      dayOfWeek: input.dayOfWeek,
      startTime: parseLocalTimeToUTC(input.startTime, date, input.timezone),
      endTime: parseLocalTimeToUTC(input.endTime, date, input.timezone),
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
    };
  };

  const validateNoOverlap = (inputs: AvailabilityInput[]) => {
    const utcInputs = inputs.map(inputToUtcSlot);
    for (let i = 0; i < utcInputs.length; i++) {
      for (let j = i + 1; j < utcInputs.length; j++) {
        if (slotsOverlap(utcInputs[i], utcInputs[j])) {
          throw new Error(
            `Overlapping availability: the selected times conflict with each other (${utcInputs[i].dayOfWeek}).`,
          );
        }
      }
      for (const existing of slots) {
        const existingSlot: SlotForOverlap = {
          dayOfWeek: existing.dayOfWeek,
          startTime: existing.startTime,
          endTime: existing.endTime,
          startDate: existing.startDate ?? null,
          endDate: existing.endDate ?? null,
        };
        if (slotsOverlap(utcInputs[i], existingSlot)) {
          throw new Error(
            `Overlapping availability: this conflicts with an existing slot on ${existing.dayOfWeek}.`,
          );
        }
      }
    }
  };

  const proceedAfterTzConfirm = async (inputs: AvailabilityInput[]) => {
    if (
      comparisonTimezone &&
      comparisonTimezone !== deviceTimezone &&
      inputs.length > 0 &&
      inputs[0].startDate
    ) {
      setPendingSlots(inputs);
      setConfirmOpen(true);
      return;
    }
    await submitInputs(inputs);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setFormError(null);
      const inputs = buildInputs();
      validateNoPastSlots(inputs);
      validateNoOverlap(inputs);

      if (browserDiffersFromProfile) {
        setPendingSlots(inputs);
        setTzConfirmOpen(true);
        return;
      }

      await proceedAfterTzConfirm(inputs);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to prepare availability');
    }
  };

  const tzConfirmMessage = useMemo(() => {
    if (!browserDiffersFromProfile || !profileTimezone || pendingSlots.length === 0) return '';

    const sample = pendingSlots[0];
    const sampleDate = sample.startDate ?? getReferenceDateForDay(sample.dayOfWeek);
    return [
      `Your device is set to ${deviceTimezone}, but your account timezone is ${profileTimezone}.`,
      '',
      `The times you entered (${formatLocalRangeInTimezone(
        sample.startTime,
        sample.endTime,
        sampleDate,
        deviceTimezone,
        deviceTimezone,
      )}) will be saved as ${deviceTimezone} time.`,
      `That is ${formatLocalRangeInTimezone(
        sample.startTime,
        sample.endTime,
        sampleDate,
        deviceTimezone,
        profileTimezone,
      )} in your account timezone (${profileTimezone}).`,
      '',
      'Is this correct?',
    ].join('\n');
  }, [browserDiffersFromProfile, profileTimezone, deviceTimezone, pendingSlots]);

  const confirmMessage = useMemo(() => {
    if (!comparisonTimezone || comparisonTimezone === deviceTimezone || pendingSlots.length === 0) {
      return '';
    }

    const sample = pendingSlots[0];
    const sampleDate = sample.startDate ?? getReferenceDateForDay(sample.dayOfWeek);
    return [
      `You are entering ${formatLocalRangeInTimezone(
        sample.startTime,
        sample.endTime,
        sampleDate,
        deviceTimezone,
        deviceTimezone,
      )} in your device timezone (${deviceTimezone}).`,
      `This will be stored as ${formatLocalRangeInTimezone(
        sample.startTime,
        sample.endTime,
        sampleDate,
        deviceTimezone,
        comparisonTimezone,
      )} in ${comparisonLabel} (${comparisonTimezone}).`,
      '',
      pendingSlots.length > 1
        ? `This action will create ${pendingSlots.length} separate slots.`
        : 'Continue with this availability?',
    ].join('\n');
  }, [comparisonLabel, comparisonTimezone, deviceTimezone, pendingSlots]);

  const summaryLine = useMemo(
    () => formatAvailabilitySummary(slots, deviceTimezone, getReferenceDateForDay, formatUTCRangeToLocal),
    [slots, deviceTimezone, getReferenceDateForDay, formatUTCRangeToLocal],
  );

  return (
    <div className="space-y-8">
      <div className="card px-6 py-6">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span className="font-medium text-slate-900">Scheduling from:</span> {deviceTimezone}
          </div>
        </div>
      </div>

      {browserDiffersFromProfile && profileTimezone && (
        <div className="alert-warning px-4 py-3 text-sm">
          <strong>Timezone mismatch:</strong> Your device is set to{' '}
          <span className="font-semibold">{deviceTimezone}</span>, but your account timezone is{' '}
          <span className="font-semibold">{profileTimezone}</span>. Times you enter will be
          interpreted as {deviceTimezone}.
        </div>
      )}

      {(formError || error) && (
        <div className="alert-error px-4 py-3 text-sm">
          {formError ?? error}
        </div>
      )}
      {success && (
        <div className="alert-success px-4 py-3 text-sm">
          {success}
        </div>
      )}

      {!loading && slots.length > 0 && summaryLine && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card flex flex-col justify-center bg-white p-5">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Active slots this month
            </span>
            <span className="mt-2 text-3xl font-bold text-slate-900">{summaryLine.count}</span>
          </div>
          <div className="card flex flex-col justify-center bg-white p-5">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Typical days
            </span>
            <span className="mt-2 text-lg font-semibold text-slate-900">
              {summaryLine.daysStr || '—'}
            </span>
          </div>
          <div className="card flex flex-col justify-center bg-white p-5">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Typical times
            </span>
            <span className="mt-2 font-mono text-lg font-semibold text-slate-900">
              {summaryLine.timeStr || '—'}
            </span>
          </div>
        </div>
      )}

      <section className="card p-6">
        <div className="mb-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setMode('recurring')}
            className={`focus-ring rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              mode === 'recurring'
                ? 'bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-hover)]'
                : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
            }`}
          >
            Recurring weekly
          </button>
          <button
            type="button"
            onClick={() => setMode('one-off')}
            className={`focus-ring rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              mode === 'one-off'
                ? 'bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-hover)]'
                : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
            }`}
          >
            Specific date(s)
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
          {mode === 'recurring' ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="block">
                <span className="text-sm font-medium text-slate-700">Days of week</span>
                <div className="mt-2 flex flex-wrap gap-3">
                  {WEEKDAYS.map((entry) => (
                    <label
                      key={entry.value}
                      className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 transition-colors has-[:checked]:border-[var(--color-brand)] has-[:checked]:bg-[var(--color-brand)]/10"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDays[entry.value] ?? false}
                        onChange={() => toggleDay(entry.value)}
                        className="h-4 w-4 rounded border-slate-300 text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        {entry.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Start date</span>
                <input
                  type="date"
                  value={recurringStartDate}
                  min={minDate}
                  onChange={(event) => setRecurringStartDate(event.target.value)}
                  className="focus-ring mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 transition-colors hover:border-slate-400 focus:border-[var(--color-brand)]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">End date</span>
                <input
                  type="date"
                  value={recurringEndDate}
                  min={recurringStartDate || minDate}
                  onChange={(event) => setRecurringEndDate(event.target.value)}
                  className="focus-ring mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 transition-colors hover:border-slate-400 focus:border-[var(--color-brand)]"
                />
              </label>
            </div>
          ) : (
            <label className="block max-w-sm">
              <span className="text-sm font-medium text-slate-700">Date</span>
              <input
                type="date"
                value={oneOffSingleDate}
                min={minDate}
                onChange={(event) => setOneOffSingleDate(event.target.value)}
                className="focus-ring mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 transition-colors hover:border-slate-400 focus:border-[var(--color-brand)]"
              />
            </label>
          )}

          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Start time</span>
              <input
                type="time"
                value={startTime}
                min={isSelectedDateToday ? minTimeForToday : undefined}
                onChange={(event) => setStartTime(event.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">End time</span>
              <input
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900"
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="focus-ring rounded-xl bg-[var(--color-brand)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-hover)] disabled:opacity-50"
            >
              {saving ? 'Saving…' : '+ Availability'}
            </button>
          </div>
        </form>
      </section>
      
      {slots.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Current availability slots</h2>
          <div className="card overflow-hidden">
            <ul className="divide-y divide-slate-100">
              {[...slots]
                .sort((a, b) => {
                  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
                  const dayDiff = days.indexOf(a.dayOfWeek) - days.indexOf(b.dayOfWeek);
                  if (dayDiff !== 0) return dayDiff;
                  return a.startTime.localeCompare(b.startTime);
                })
                .map((slot) => {
                  const refDate = slot.startDate ?? getReferenceDateForDay(slot.dayOfWeek);
                  return (
                    <li key={slot.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900">
                          {WEEKDAYS.find((w) => w.value === slot.dayOfWeek)?.label ?? slot.dayOfWeek}
                          {slot.isRecurring ? (
                            <span className="ml-2 inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                              Recurring
                            </span>
                          ) : (
                            <span className="ml-2 inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                              One-off
                            </span>
                          )}
                        </span>
                        <span className="text-sm text-slate-600 font-mono mt-0.5">
                          {formatUTCRangeToLocal(slot.startTime, slot.endTime, refDate, deviceTimezone)}
                        </span>
                        {(slot.startDate || slot.endDate) && (
                          <span className="text-xs text-slate-500 mt-1">
                            {slot.startDate ? `From ${slot.startDate}` : ''} 
                            {slot.endDate ? ` to ${slot.endDate}` : ''}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteSlot?.(slot.id)}
                        disabled={loading || saving || deletingId === slot.id}
                        className="p-2 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-30"
                        title="Delete slot"
                      >
                        {deletingId === slot.id ? (
                          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </li>
                  );
                })}
            </ul>
          </div>
        </section>
      )}

      <ConfirmationDialog
        open={tzConfirmOpen}
        title="Different timezone detected"
        message={tzConfirmMessage}
        confirmLabel={`Yes, use ${deviceTimezone}`}
        cancelLabel="Cancel"
        onCancel={() => {
          setTzConfirmOpen(false);
          setPendingSlots([]);
        }}
        onConfirm={() => {
          setTzConfirmOpen(false);
          const slotsToProcess = [...pendingSlots];
          setPendingSlots([]);
          void proceedAfterTzConfirm(slotsToProcess);
        }}
        busy={saving}
      />

      <ConfirmationDialog
        open={confirmOpen}
        title="Confirm timezone conversion"
        message={confirmMessage}
        confirmLabel="Save availability"
        onCancel={() => {
          setConfirmOpen(false);
          setPendingSlots([]);
        }}
        onConfirm={() => {
          setConfirmOpen(false);
          void submitInputs(
            pendingSlots,
            comparisonTimezone ?? undefined,
          );
          setPendingSlots([]);
        }}
        busy={saving}
      />
    </div>
  );
}
