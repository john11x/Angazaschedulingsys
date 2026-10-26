import { Link } from 'react-router';
import { useEffect, useState } from 'react';
import { dataClient } from '@/lib/data-client';
import { formatUTCRangeToLocal } from '@/lib/time-utils';
interface RecentBooking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  trainerName: string;
  memberSchoolName: string;
}

export default function CoordinatorDashboardPage() {
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);

  useEffect(() => {
    async function loadRecent() {
      try {
        const { data: bookings } = await dataClient.models.Booking.list({
          filter: { status: { eq: 'SCHEDULED' } },
          limit: 5
        });
        
        if (bookings) {
          const detailed = await Promise.all(
            bookings.map(async (b) => {
              const [t, s] = await Promise.all([
                dataClient.models.User.get({ id: b.trainerId }),
                dataClient.models.School.get({ id: b.memberSchoolId })
              ]);
              return {
                id: b.id,
                date: b.date,
                startTime: b.startTime,
                endTime: b.endTime,
                trainerName: t.data?.fullName ?? 'Trainer',
                memberSchoolName: s.data?.name ?? 'School'
              };
            })
          );
          setRecentBookings(detailed);
        }
      } catch (e) {
        console.error('Failed to load recent activity', e);
      }
    }
    void loadRecent();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Coordinator dashboard</h1>
          <p className="text-slate-600 mt-1">
            Manage schools and onboard coordinators, lead teachers, and trainers.
          </p>
        </div>
      </div>

      {recentBookings.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Recent Activity</h2>
          <div className="grid gap-4">
            {recentBookings.map((b) => (
              <div key={b.id} className="card flex items-center justify-between p-4 bg-emerald-50/50 border-emerald-100">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      <span className="font-bold">{b.trainerName}</span> scheduled a session for <span className="font-bold">{b.memberSchoolName}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {b.date} · {formatUTCRangeToLocal(b.startTime, b.endTime, b.date, 'UTC')}
                    </p>
                  </div>
                </div>
                <Link to="/app/schools" className="text-xs font-semibold text-emerald-700 hover:underline">View details →</Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          to="/app/schools"
          className="card block p-6 transition-colors hover:border-[var(--color-brand)]/50 hover:shadow-md"
        >
          <h2 className="font-semibold text-slate-900">Schools</h2>
          <p className="text-sm text-slate-600 mt-1">
            Add member schools and partner schools before assigning lead teachers and trainers.
          </p>
        </Link>
        <Link
          to="/app/schedule"
          className="card block p-6 transition-colors hover:border-[var(--color-brand)]/50 hover:shadow-md"
        >
          <h2 className="font-semibold text-slate-900">Schedule session</h2>
          <p className="text-sm text-slate-600 mt-1">
            Book a training session between a Trainer and a Member School.
          </p>
        </Link>
        <Link
          to="/app/users/create"
          className="card block p-6 transition-colors hover:border-[var(--color-brand)]/50 hover:shadow-md"
        >
          <h2 className="font-semibold text-slate-900">Create user</h2>
          <p className="text-sm text-slate-600 mt-1">
            Invite coordinators, lead teachers, or trainers. Cognito sends a temporary password
            by email.
          </p>
        </Link>
      </div>
    </div>
  );
}
