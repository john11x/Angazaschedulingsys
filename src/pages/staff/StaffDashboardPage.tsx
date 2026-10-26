import { useCallback, useState } from 'react';
import StaffCalendarView from '@/components/staff/StaffCalendarView';
import QuickActionBar from '@/components/staff/QuickActionBar';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSchoolInfo } from '@/hooks/useSchoolInfo';
import { dataClient } from '@/lib/data-client';

export default function StaffDashboardPage() {
  const { profile } = useCurrentUser();
  const { school } = useSchoolInfo(profile?.schoolId);
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

  const roleLabel = profile.role === 'LEAD_TEACHER' ? 'Lead teacher' : 'Trainer';

  return (
    <div className="space-y-6">
      {error && (
        <div className="alert-error px-4 py-3 text-sm">
          {error}
        </div>
      )}
      <section className="card px-6 py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              {roleLabel}
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              {profile.fullName}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {profile.email}
              {school && (
                <>
                  {' · '}
                  <span className="font-medium text-slate-800">{school.name}</span>
                </>
              )}
            </p>
          </div>
          <QuickActionBar isLeadTeacher={profile.role === 'LEAD_TEACHER'} />
        </div>
      </section>

      <StaffCalendarView
        embedded
        heading="Your schedule"
        description="Review what is booked, what was cancelled, and where you still have room."
        onCancelBooking={handleCancel}
        cancellingId={cancellingId}
      />
    </div>
  );
}
