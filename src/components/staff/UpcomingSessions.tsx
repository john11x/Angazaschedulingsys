import { useEffect, useState } from 'react';
import { dataClient } from '@/lib/data-client';
import { formatUTCRangeToLocal } from '@/lib/time-utils';
import Spinner from '@/components/shared/Spinner';

interface Session {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  otherPartyName: string;
}

export default function UpcomingSessions({ 
  userId, 
  role, 
  timezone 
}: { 
  userId: string; 
  role: string; 
  timezone: string; 
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const isTrainer = role === 'TRAINER';
        const today = new Date().toISOString().split('T')[0];
        
        const { data: bookings } = await dataClient.models.Booking.list({
          filter: {
            ...(isTrainer ? { trainerId: { eq: userId } } : { leadTeacherId: { eq: userId } }),
            status: { eq: 'SCHEDULED' },
            date: { ge: today }
          },
          limit: 5
        });

        if (bookings) {
          const detailed = await Promise.all(
            bookings
              .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
              .map(async (b) => {
                let otherName = 'Partner';
                if (isTrainer) {
                  const { data: s } = await dataClient.models.School.get({ id: b.memberSchoolId });
                  otherName = s?.name ?? 'School';
                } else {
                  const { data: u } = await dataClient.models.User.get({ id: b.trainerId });
                  otherName = u?.fullName ?? 'Trainer';
                }
                
                return {
                  id: b.id,
                  date: b.date,
                  startTime: b.startTime,
                  endTime: b.endTime,
                  otherPartyName: otherName,
                };
              })
          );
          setSessions(detailed);
        }
      } catch (e) {
        console.error('Failed to load upcoming sessions', e);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [userId, role]);

  if (loading) return <Spinner />;
  if (sessions.length === 0) return null;

  return (
    <div className="card-glass p-6 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Upcoming Sessions</h2>
      <div className="space-y-3">
        {sessions.map((s) => (
          <div key={s.id} className="flex items-center gap-4 p-3 rounded-xl bg-white/50 border border-slate-100 shadow-sm">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-[var(--color-brand)]/10 flex items-center justify-center text-[var(--color-brand)]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 truncate">{s.otherPartyName}</p>
              <p className="text-xs text-slate-500 font-mono">
                {s.date} · {formatUTCRangeToLocal(s.startTime, s.endTime, s.date, timezone)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
