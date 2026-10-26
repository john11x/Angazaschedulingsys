import type { Schema } from '../../../amplify/data/resource';
import { formatUTCRangeToLocal } from '@/lib/time-utils';

type Booking = Schema['Booking']['type'];

export interface BookingWithParty extends Booking {
  otherPartyName: string;
}

interface BookingTableProps {
  bookings: BookingWithParty[];
  otherPartyLabel: string;
  timezone: string;
  onCancel?: (bookingId: string) => void;
  cancellingId?: string | null;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T12:00:00Z');
    return d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

const statusColors: Record<string, string> = {
  SCHEDULED: 'bg-emerald-100 text-emerald-800',
  COMPLETED: 'bg-slate-100 text-slate-700',
  CANCELLED_BY_TRAINER: 'bg-red-100 text-red-800',
  CANCELLED_BY_SCHOOL: 'bg-amber-100 text-amber-800',
};

export default function BookingTable({
  bookings,
  otherPartyLabel,
  timezone,
  onCancel,
  cancellingId,
}: BookingTableProps) {
  if (bookings.length === 0) {
    return (
      <div className="card p-8 text-center text-slate-500 text-sm">
        No bookings yet.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden text-sm">
      <table className="w-full text-left">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-4 py-2 font-medium text-slate-600">Date</th>
            <th className="px-4 py-2 font-medium text-slate-600">Time</th>
            <th className="px-4 py-2 font-medium text-slate-600">{otherPartyLabel}</th>
            <th className="px-4 py-2 font-medium text-slate-600 hidden sm:table-cell">Status</th>
            {onCancel && (
              <th className="px-4 py-2 font-medium text-slate-600 w-20">Actions</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {bookings.map((b) => (
            <tr key={b.id}>
              <td className="px-4 py-3 text-slate-900">{formatDate(b.date)}</td>
              <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                {formatUTCRangeToLocal(b.startTime, b.endTime, b.date, timezone)}
              </td>
              <td className="px-4 py-3 text-slate-700">{b.otherPartyName}</td>
              <td className="px-4 py-3 hidden sm:table-cell">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    statusColors[b.status] ?? 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {b.status.replace(/_/g, ' ')}
                </span>
              </td>
              {onCancel && (
                <td className="px-4 py-3">
                  {b.status === 'SCHEDULED' ? (
                    <button
                      type="button"
                      onClick={() => onCancel(b.id)}
                      disabled={cancellingId === b.id}
                      className="text-red-600 hover:text-red-800 font-medium text-xs disabled:opacity-50"
                    >
                      {cancellingId === b.id ? 'Cancelling…' : 'Cancel'}
                    </button>
                  ) : null}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
