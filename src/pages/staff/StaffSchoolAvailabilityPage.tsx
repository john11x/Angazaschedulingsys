import { useCallback, useEffect, useState } from 'react';
import AvailabilityManager, {
  type AvailabilityInput,
  type AvailabilitySlotRecord,
} from '@/components/staff/AvailabilityManager';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSchoolInfo } from '@/hooks/useSchoolInfo';
import { dataClient } from '@/lib/data-client';

export default function StaffSchoolAvailabilityPage() {
  const { profile } = useCurrentUser();
  const { school } = useSchoolInfo(profile?.schoolId);
  const [slots, setSlots] = useState<AvailabilitySlotRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.schoolId) {
      setSlots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, errors } = await dataClient.models.Availability.list({
        filter: {
          ownerType: { eq: 'SCHOOL' },
          ownerID: { eq: profile.schoolId },
        },
        limit: 200,
      });
      if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
      setSlots(
        (data ?? []).map((a) => ({
          id: a.id,
          dayOfWeek: a.dayOfWeek,
          startTime: a.startTime,
          endTime: a.endTime,
          timezone: a.timezone,
          isRecurring: a.isRecurring,
          startDate: a.startDate ?? null,
          endDate: a.endDate ?? null,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load availability');
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreateSlots = async (inputs: AvailabilityInput[]) => {
    if (!profile?.schoolId) return;
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      for (const input of inputs) {
        const result = await dataClient.mutations.createSchoolAvailability({
          schoolId: profile.schoolId,
          dayOfWeek: input.dayOfWeek,
          startTime: input.startTime,
          endTime: input.endTime,
          timezone: input.timezone,
          isRecurring: input.isRecurring,
          startDate: input.startDate,
          endDate: input.endDate,
        });
        const data = result.data as { success?: boolean; message?: string } | undefined;
        if (result.errors?.length) {
          throw new Error(result.errors.map((entry) => entry.message).join(', '));
        }
        if (!data?.success) {
          throw new Error(data?.message ?? 'Failed to add slot');
        }
      }

      setSuccess(
        inputs.length === 1
          ? inputs[0].isRecurring
            ? 'Recurring slot added.'
            : 'Availability added.'
          : `${inputs.length} slot(s) added.`,
      );
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add slot');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (availabilityId: string) => {
    setError(null);
    setDeletingId(availabilityId);
    try {
      const result = await dataClient.mutations.deleteSchoolAvailability({
        availabilityId,
      });
      const data = result.data as { success?: boolean; message?: string } | undefined;
      const errs = result.errors;
      if (errs?.length) throw new Error(errs.map((x) => x.message).join(', '));
      if (!data?.success) throw new Error(data?.message ?? 'Failed to delete');
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete slot');
    } finally {
      setDeletingId(null);
    }
  };

  if (!profile) return null;

  if (!profile.schoolId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">School availability</h1>
        <div className="alert-warning p-6 text-sm">
          You are not assigned to a school. Ask a coordinator to link your account to a member
          school.
        </div>
      </div>
    );
  }

  return (
    <AvailabilityManager
      title="School availability"
      description="Create school availability in the timezone your device is currently showing. If your device timezone differs from the school timezone, you will be asked to confirm the exact school-time conversion before saving."
      slots={slots}
      loading={loading}
      saving={saving}
      deletingId={deletingId}
      error={error}
      success={success}
      fallbackTimezone={school?.timezone || profile.timezone}
      comparisonTimezone={profile.timezone}
      comparisonLabel="Your account timezone"
      preferFallback={profile.role === 'LEAD_TEACHER'}
      onCreateSlots={handleCreateSlots}
      onDeleteSlot={handleDelete}
    />
  );
}
