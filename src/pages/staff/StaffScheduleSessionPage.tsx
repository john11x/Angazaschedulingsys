import { useCallback, useEffect, useMemo, useState } from 'react';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSchoolInfo } from '@/hooks/useSchoolInfo';
import { dataClient } from '@/lib/data-client';
import {
  formatUTCRangeToLocal,
  getPreferredDisplayTimezone,
} from '@/lib/time-utils';

interface TrainerSlot {
  trainerId: string;
  trainerName: string;
  schoolId: string;
  schoolName: string;
  leadTeacherName: string;
  overlapStart: string;
  overlapEnd: string;
  schoolSlotId: string;
  trainerSlotId: string;
  leadTeacherId: string;
}

export default function StaffScheduleSessionPage() {
  const { profile } = useCurrentUser();
  const { school } = useSchoolInfo(profile?.schoolId);
  const [date, setDate] = useState('');
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [slots, setSlots] = useState<TrainerSlot[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [slotToConfirm, setSlotToConfirm] = useState<TrainerSlot | null>(null);

  const loadSchools = useCallback(async () => {
    try {
      const { data } = await dataClient.models.School.list({
        filter: { type: { eq: 'MEMBER' } },
        limit: 1000,
      });
      setSchools(data?.map(s => ({ id: s.id, name: s.name })) || []);
    } catch (err) {
      console.error('Failed to load schools:', err);
    }
  }, []);

  useEffect(() => {
    if (profile?.role === 'COORDINATOR' || profile?.role === 'TRAINER') {
      void loadSchools();
    }
  }, [profile?.role, loadSchools]);

  const handleSearch = useCallback(async () => {
    if (!date) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    setSlots([]);
    try {
      const targetSchoolId = profile?.role === 'LEAD_TEACHER' ? profile.schoolId : (selectedSchoolId || '');
      const result = await dataClient.queries.findAvailableTrainers({
        schoolId: targetSchoolId ?? '',
        date,
      });
      const data = result.data as { success?: boolean; message?: string; slots?: TrainerSlot[] } | undefined;
      const errs = result.errors;
      if (errs?.length) throw new Error(errs.map((e) => e.message).join(', '));
      if (!data?.success) throw new Error(data?.message ?? 'No results');
      setSlots(data.slots ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load available trainers');
      setSlots([]);
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  }, [selectedSchoolId, date]);

  const handleSelectSlot = useCallback(
    async (slot: TrainerSlot) => {
      if (!profile?.schoolId && profile?.role !== 'COORDINATOR') return;
      setError(null);
      setSuccess(null);
      setSubmitting(true);
      try {
        const { data: trainer, errors: userErr } = await dataClient.models.User.get({
          id: slot.trainerId,
        });
        if (userErr?.length || !trainer?.schoolId)
          throw new Error('Trainer or partner school not found');

        const { data: partnerSchool } = await dataClient.models.School.get({ id: trainer.schoolId });
        const { data: memberSchool } = await dataClient.models.School.get({ id: slot.schoolId });
        if (!partnerSchool?.name || !memberSchool?.name) throw new Error('School details not found');

        const { errors } = await dataClient.models.Booking.create({
          date,
          startTime: slot.overlapStart,
          endTime: slot.overlapEnd,
          status: 'SCHEDULED',
          memberSchoolId: slot.schoolId,
          leadTeacherId: slot.leadTeacherId || profile.id, 
          trainerId: profile.role === 'TRAINER' ? profile.id : slot.trainerId,
          partnerSchoolId: profile.role === 'TRAINER' ? (profile.schoolId || '') : trainer.schoolId,
        });
        if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));

        if (memberSchool?.name && partnerSchool?.name) {
          void dataClient.mutations.sendSessionNotification({
            action: 'SCHEDULED',
            sessionDate: date,
            startTime: slot.overlapStart,
            endTime: slot.overlapEnd,
            trainerName: slot.trainerName,
            trainerEmail: trainer.email,
            trainerPhone: trainer.phoneNumber ?? '',
            trainerTimezone: trainer.timezone,
            leadTeacherName: profile.fullName ?? 'Lead Teacher',
            leadTeacherEmail: profile.email,
            leadTeacherTimezone: profile.timezone,
            memberSchoolName: memberSchool.name,
            partnerSchoolName: partnerSchool.name,
          }).catch((err) => console.warn('Session notification failed:', err));
        }

        setSuccess(`Session scheduled with ${slot.trainerName} on ${date}.`);
        setSlots((prev) => prev.filter((s) => s.trainerId !== slot.trainerId || s.overlapStart !== slot.overlapStart));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create booking');
      } finally {
        setSubmitting(false);
      }
    },
    [profile?.schoolId, profile?.id, profile?.fullName, profile?.email, profile?.timezone, school?.name, date, selectedSchoolId, profile?.role],
  );

  const filteredSlots = useMemo(() => {
    if (profile?.role === 'TRAINER') {
      return slots.filter((s) => s.trainerId === profile.id);
    }
    return slots;
  }, [slots, profile?.role, profile?.id]);

  if (!profile) return null;

  if (profile.role !== 'TRAINER' && profile.role !== 'COORDINATOR') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Schedule session</h1>
        <p className="text-slate-600">
          Only trainers and coordinators can schedule sessions. Use your dashboard to manage your school availability.
        </p>
      </div>
    );
  }

  if (!profile.schoolId && profile.role !== 'COORDINATOR') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Schedule session</h1>
        <div className="alert-warning p-6 text-sm">
          You are not assigned to a school. Ask a coordinator to link your account.
        </div>
      </div>
    );
  }

  const timezone = getPreferredDisplayTimezone(profile.timezone, false);
  const refDate = date || '2026-01-06';


  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Schedule session</h1>
        <p className="mt-1 text-sm text-slate-600 leading-relaxed">
          Find trainers whose availability matches your school&apos;s and book a session. Only
          matching slots are shown.
        </p>
      </div>

      {error && (
        <div className="alert-error px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="alert-success px-4 py-3 text-sm">
          {success}
        </div>
      )}

      <section className="card p-6">
        <h2 className="font-semibold text-slate-900 mb-4">
          {profile.role === 'TRAINER' ? 'Find matching slots with school' : 'Find available trainers'}
        </h2>
        <div className="flex flex-wrap gap-4 items-end">
          {(profile.role === 'COORDINATOR' || profile.role === 'TRAINER') && (
            <label className="block min-w-[240px]">
              <span className="text-sm font-medium text-slate-700">Member School</span>
              <select
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                className="focus-ring mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 transition-colors hover:border-slate-400 focus:border-[var(--color-brand)]"
              >
                <option value="">All member schools</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="focus-ring mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 transition-colors hover:border-slate-400 focus:border-[var(--color-brand)]"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleSearch()}
            disabled={!date || loading}
            className="focus-ring px-5 py-2.5 rounded-lg bg-[var(--color-brand)] text-white font-semibold text-sm hover:bg-[var(--color-brand-hover)] transition-colors disabled:opacity-50"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </section>

      {filteredSlots.length > 0 && (
        <section>
          <h2 className="font-semibold text-slate-900 mb-2">
            {profile?.role === 'TRAINER' ? 'My available slots' : 'Available slots'} (your time: {timezone})
          </h2>
          <div className="card overflow-hidden">
            <ul className="divide-y divide-slate-100">
              {filteredSlots.map((slot) => (
                <li
                  key={`${slot.trainerId}-${slot.overlapStart}-${slot.overlapEnd}`}
                  className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {profile?.role === 'TRAINER' 
                        ? `${slot.schoolName || 'Linking school...'} — ${slot.leadTeacherName || 'Syncing LT...'}`
                        : `${slot.trainerName || 'Trainer'} @ ${slot.schoolName || 'Linking school...'}`}
                    </p>
                    <p className="text-sm text-slate-600 font-mono">
                      {formatUTCRangeToLocal(
                        slot.overlapStart,
                        slot.overlapEnd,
                        refDate,
                        timezone,
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSlotToConfirm(slot)}
                    disabled={submitting}
                    className="focus-ring px-4 py-2 rounded-lg bg-[var(--color-brand)] text-white font-medium text-sm hover:bg-[var(--color-brand-hover)] transition-colors disabled:opacity-50"
                  >
                    Book this slot
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {hasSearched && !loading && filteredSlots.length === 0 && (
        <p className="text-slate-500 text-sm">
          No matching availability for this date. Try another date or ensure school
          availability and trainer availability overlap.
        </p>
      )}

      <ConfirmationDialog
        open={slotToConfirm != null}
        title="Confirm session time"
        message={
          slotToConfirm
            ? [
                `You are booking ${formatUTCRangeToLocal(
                  slotToConfirm.overlapStart,
                  slotToConfirm.overlapEnd,
                  refDate,
                  timezone,
                )} in your current timezone (${timezone}).`,
                school?.timezone && school.timezone !== timezone
                  ? `That is ${formatUTCRangeToLocal(
                      slotToConfirm.overlapStart,
                      slotToConfirm.overlapEnd,
                      refDate,
                      'UTC', 
                    )} UTC.`
                  : 'Continue with this session?',
                `Member School: ${slotToConfirm.schoolName}`,
                `Lead Teacher: ${slotToConfirm.leadTeacherName}`,
              ].join('\n\n')
            : ''
        }
        confirmLabel="Book session"
        busy={submitting}
        onCancel={() => setSlotToConfirm(null)}
        onConfirm={() => {
          if (!slotToConfirm) return;
          const selected = slotToConfirm;
          setSlotToConfirm(null);
          void handleSelectSlot(selected);
        }}
      />
    </div>
  );
}

