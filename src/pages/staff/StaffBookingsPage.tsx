import { useCallback, useState } from 'react';
import StaffCalendarView from '@/components/staff/StaffCalendarView';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { dataClient } from '@/lib/data-client';

export default function StaffBookingsPage() {
  const { profile } = useCurrentUser();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = useCallback(async (bookingId: string) => {
    setError(null);
    setCancellingId(bookingId);
    try {
      const result = await dataClient.mutations.cancelSession({ bookingId });
      const data = result.data as { success?: boolean; message?: string } | undefined;
      const errs = result.errors;
      if (errs?.length) throw new Error(errs.map((e) => e.message).join(', '));
      if (!data?.success) throw new Error(data?.message ?? 'Failed to cancel');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel session');
    } finally {
      setCancellingId(null);
    }
  }, []);

  if (!profile) return null;

  return (
    <div className="space-y-6">
      {error && (
        <div className="alert-error px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <StaffCalendarView
        heading="Bookings"
        description="Your scheduled training sessions. Click a session to cancel."
        mode="bookings-only"
        onCancelBooking={handleCancel}
        cancellingId={cancellingId}
      />
    </div>
  );
}
