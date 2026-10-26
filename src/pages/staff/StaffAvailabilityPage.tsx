import { useCallback, useEffect, useState } from 'react';
import AvailabilityManager, {
  type AvailabilityInput,
  type AvailabilitySlotRecord,
} from '@/components/staff/AvailabilityManager';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { dataClient } from '@/lib/data-client';
import { getReferenceDateForDay, parseLocalTimeToUTC } from '@/lib/time-utils';

export default function StaffAvailabilityPage() {
  const { profile } = useCurrentUser();
  const [slots, setSlots] = useState<AvailabilitySlotRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const { data, errors } = await dataClient.models.Availability.list({
        filter: {
          ownerID: { eq: profile.id },
          ownerType: { eq: 'TRAINER' },
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
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreateSlots = async (inputs: AvailabilityInput[]) => {
    if (!profile) return;
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      for (const input of inputs) {
        const referenceDate = input.startDate ?? getReferenceDateForDay(input.dayOfWeek);
        const startUtc = parseLocalTimeToUTC(input.startTime, referenceDate, input.timezone);
        const endUtc = parseLocalTimeToUTC(input.endTime, referenceDate, input.timezone);
        const { errors } = await dataClient.models.Availability.create({
          ownerID: profile.id,
          ownerType: 'TRAINER',
          dayOfWeek: input.dayOfWeek as 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN',
          startTime: startUtc,
          endTime: endUtc,
          isRecurring: input.isRecurring,
          timezone: input.timezone,
          startDate: input.startDate,
          endDate: input.endDate,
        });
        if (errors?.length) {
          throw new Error(errors.map((entry) => entry.message).join(', '));
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
      const { errors } = await dataClient.models.Availability.delete({
        id: availabilityId,
      });
      if (errors?.length) {
        throw new Error(errors.map((e) => e.message).join(', '));
      }
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete slot');
    } finally {
      setDeletingId(null);
    }
  };

  if (!profile) return null;

  return (
    <AvailabilityManager
      title="My availability"
      description="Create availability in the timezone your device is currently showing. You can add several slots on the same day, recurring windows with an end date, or one-off dates and date ranges."
      slots={slots}
      loading={loading}
      saving={saving}
      deletingId={deletingId}
      error={error}
      success={success}
      fallbackTimezone={profile.timezone}
      preferFallback={profile.role === 'LEAD_TEACHER'}
      onCreateSlots={handleCreateSlots}
      onDeleteSlot={handleDelete}
    />
  );
}
