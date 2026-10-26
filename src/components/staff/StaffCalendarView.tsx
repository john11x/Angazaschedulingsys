import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, dateFnsLocalizer, type NavigateAction, type View } from 'react-big-calendar';
import { format, getDay, parse, startOfWeek } from 'date-fns';
import CalendarToolbar from '@/components/calendar/CalendarToolbar';
import Spinner from '@/components/shared/Spinner';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { dataClient } from '@/lib/data-client';
import {
  formatUTCRangeToLocal,
  getPreferredDisplayTimezone,
  timeRangesOverlap,
  utcDateAndTimeToZonedDate,
} from '@/lib/time-utils';

import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = { 'en-GB': undefined };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const CALENDAR_VIEWS: View[] = ['day', 'week', 'month', 'agenda'];
const DAY_TO_DOW: Record<number, string> = {
  0: 'SUN',
  1: 'MON',
  2: 'TUE',
  3: 'WED',
  4: 'THU',
  5: 'FRI',
  6: 'SAT',
};

interface AvailabilitySlot {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  startDate?: string | null;
  endDate?: string | null;
}

interface BookingWithParty {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  otherPartyName?: string;
}

interface CalendarEventResource {
  otherPartyName?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'availability' | 'scheduled' | 'cancelled';
  resource?: CalendarEventResource;
}

interface StaffCalendarViewProps {
  heading?: string;
  description?: string;
  embedded?: boolean;
  /** When 'bookings-only', shows only training sessions (no availability). Enables cancel. */
  mode?: 'full' | 'bookings-only';
  onCancelBooking?: (bookingId: string) => Promise<void>;
  cancellingId?: string | null;
}

function dateToDayOfWeek(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return DAY_TO_DOW[d.getUTCDay()] ?? 'MON';
}

function isDateInSlotRange(dateStr: string, slot: AvailabilitySlot): boolean {
  if (slot.startDate && dateStr < slot.startDate) return false;
  if (slot.endDate && dateStr > slot.endDate) return false;
  return true;
}

const CANCELLED_STATUSES = ['CANCELLED_BY_TRAINER', 'CANCELLED_BY_SCHOOL'];

function formatEventDate(date: Date): string {
  return format(date, 'EEE, d MMM yyyy');
}

function formatEventTime(date: Date): string {
  return format(date, 'HH:mm');
}

function EventInfoModal({
  event,
  timezone,
  onClose,
  onRequestCancel,
  cancellingId,
}: {
  event: CalendarEvent;
  timezone: string;
  onClose: () => void;
  onRequestCancel?: () => void;
  cancellingId?: string | null;
}) {
  const isSession = event.type === 'scheduled' || event.type === 'cancelled';
  const canCancel = event.type === 'scheduled' && onRequestCancel;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">
          {event.type === 'availability' ? 'Availability' : 'Training session'}
        </h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="text-slate-500">Date</dt>
            <dd className="font-medium text-slate-900">{formatEventDate(event.start)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Time</dt>
            <dd className="font-medium text-slate-900">
              {event.resource?.date && event.resource?.startTime && event.resource?.endTime
                ? formatUTCRangeToLocal(
                    event.resource.startTime,
                    event.resource.endTime,
                    event.resource.date,
                    timezone,
                  )
                : `${formatEventTime(event.start)} – ${formatEventTime(event.end)}`}
            </dd>
          </div>
          {isSession && event.resource?.otherPartyName && (
            <div>
              <dt className="text-slate-500">With</dt>
              <dd className="font-medium text-slate-900">{event.resource.otherPartyName}</dd>
            </div>
          )}
          {isSession && event.resource?.status && (
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium text-slate-900">{event.resource.status.replace(/_/g, ' ')}</dd>
            </div>
          )}
        </dl>
        <div className="mt-6 flex justify-end gap-3">
          {canCancel && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onRequestCancel?.();
              }}
              disabled={cancellingId === event.id}
              className="focus-ring rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
            >
              {cancellingId === event.id ? 'Cancelling…' : 'Cancel session'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-hover)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StaffCalendarView({
  heading = 'Calendar',
  description = 'Your availability and scheduled training sessions. Times are shown in your local timezone.',
  embedded = false,
  mode = 'full',
  onCancelBooking,
  cancellingId = null,
}: StaffCalendarViewProps) {
  const { profile } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date());
  const [view, setView] = useState<View>('month');
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [bookings, setBookings] = useState<BookingWithParty[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const displayTimezone = useMemo(
    () => getPreferredDisplayTimezone(profile?.timezone, profile?.role === 'LEAD_TEACHER'),
    [profile?.timezone, profile?.role],
  );

  const load = useCallback(
    async (rangeStart: Date, rangeEnd: Date) => {
      if (!profile) return;
      setLoading(true);
      setError(null);

      try {
        const startStr = rangeStart.toISOString().slice(0, 10);
        const endStr = rangeEnd.toISOString().slice(0, 10);
        const isTrainer = profile.role === 'TRAINER';
        const ownerId = isTrainer ? profile.id : profile.schoolId;
        if (mode === 'full' && !ownerId) {
          setAvailabilitySlots([]);
          setBookings([]);
          return;
        }

        const bookingPromise = dataClient.models.Booking.list({
          filter: {
            ...(isTrainer ? { trainerId: { eq: profile.id } } : { leadTeacherId: { eq: profile.id } }),
            date: { ge: startStr, le: endStr },
          },
          limit: 300,
        });

        const availabilityPromise =
          mode === 'bookings-only'
            ? Promise.resolve({ data: [], errors: [] })
            : dataClient.models.Availability.list({
                filter: {
                  ownerType: { eq: isTrainer ? 'TRAINER' : 'SCHOOL' },
                  ownerID: { eq: ownerId! },
                },
                limit: 200,
              });

        const [availabilityResult, bookingResult] = await Promise.all([
          availabilityPromise,
          bookingPromise,
        ]);

        if (availabilityResult.errors?.length) {
          throw new Error(availabilityResult.errors.map((entry) => entry.message).join(', '));
        }
        if (bookingResult.errors?.length) {
          throw new Error(bookingResult.errors.map((entry) => entry.message).join(', '));
        }

        setAvailabilitySlots(
          (availabilityResult.data ?? []).map((slot) => ({
            id: slot.id,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            startDate: slot.startDate ?? null,
            endDate: slot.endDate ?? null,
          })),
        );

        const rawBookings = bookingResult.data ?? [];
        const userIds = new Set<string>();
        const schoolIds = new Set<string>();
        rawBookings.forEach((b) => {
          userIds.add(b.leadTeacherId);
          userIds.add(b.trainerId);
          schoolIds.add(b.memberSchoolId);
          schoolIds.add(b.partnerSchoolId);
        });
        const [userResults, schoolResults] = await Promise.all([
          Promise.all([...userIds].map((id) => dataClient.models.User.get({ id }))),
          Promise.all([...schoolIds].map((id) => dataClient.models.School.get({ id }))),
        ]);
        const userMap: Record<string, string> = {};
        userResults.forEach((r) => {
          if (r.data?.fullName) userMap[r.data.id] = r.data.fullName;
        });
        const schoolMap: Record<string, string> = {};
        schoolResults.forEach((r) => {
          if (r.data?.name) schoolMap[r.data.id] = r.data.name;
        });

        setBookings(
          rawBookings.map((b) => {
            const otherPartyName = isTrainer
              ? `${schoolMap[b.memberSchoolId] ?? 'School'} · ${userMap[b.leadTeacherId] ?? 'Lead teacher'}`
              : `${userMap[b.trainerId] ?? 'Trainer'} · ${schoolMap[b.partnerSchoolId] ?? 'School'}`;
            return {
              id: b.id,
              date: b.date,
              startTime: b.startTime,
              endTime: b.endTime,
              status: b.status,
              otherPartyName,
            };
          }),
        );
      } catch (err) {
        setAvailabilitySlots([]);
        setBookings([]);
        setError(err instanceof Error ? err.message : 'Failed to load calendar');
      } finally {
        setLoading(false);
      }
    },
    [profile, mode],
  );

  useEffect(() => {
    if (!profile) return;

    const start = new Date(date);
    const end = new Date(date);

    if (view === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
    } else if (view === 'week' || view === 'agenda') {
      const day = start.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      start.setDate(start.getDate() + diff);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    setRange({ start, end });
    void load(start, end);
  }, [date, load, profile, view]);

  const scheduledBookings = useMemo(
    () => bookings.filter((b) => !CANCELLED_STATUSES.includes(b.status)),
    [bookings],
  );

  const events = useMemo<CalendarEvent[]>(() => {
    if (!range) return [];

    const dates: string[] = [];
    const padStart = new Date(range.start);
    padStart.setDate(padStart.getDate() - 1);
    const padEnd = new Date(range.end);
    padEnd.setDate(padEnd.getDate() + 1);
    const current = new Date(padStart);

    while (current <= padEnd) {
      dates.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }

    const availabilityEvents =
      mode === 'bookings-only'
        ? []
        : availabilitySlots.flatMap((slot) =>
            dates
              .filter(
                (dateStr) =>
                  dateToDayOfWeek(dateStr) === slot.dayOfWeek && isDateInSlotRange(dateStr, slot),
              )
              .filter(
                (dateStr) =>
                  !scheduledBookings.some(
                    (b) =>
                      b.date === dateStr &&
                      timeRangesOverlap(slot.startTime, slot.endTime, b.startTime, b.endTime),
                  ),
              )
              .map((dateStr) => ({
                id: `availability-${slot.id}-${dateStr}`,
                title: 'Available',
                start: utcDateAndTimeToZonedDate(dateStr, slot.startTime, displayTimezone),
                end: utcDateAndTimeToZonedDate(dateStr, slot.endTime, displayTimezone),
                type: 'availability' as const,
                resource: { date: dateStr, startTime: slot.startTime, endTime: slot.endTime },
              })),
          );

    const bookingEvents = scheduledBookings.map((booking) => ({
      id: booking.id,
      title: 'Training session',
      start: utcDateAndTimeToZonedDate(booking.date, booking.startTime, displayTimezone),
      end: utcDateAndTimeToZonedDate(booking.date, booking.endTime, displayTimezone),
      type: 'scheduled' as const,
      resource: {
        otherPartyName: booking.otherPartyName,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
      },
    }));

    return [...availabilityEvents, ...bookingEvents];
  }, [availabilitySlots, bookings, range, mode, scheduledBookings]);

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const style: React.CSSProperties =
      event.type === 'availability'
        ? { backgroundColor: '#e2e8f0', color: '#334155' }
        : event.type === 'cancelled'
          ? { backgroundColor: '#fee2e2', color: '#991b1b' }
          : { backgroundColor: 'var(--color-brand)', color: '#ffffff' };

    return { style };
  }, []);

  if (!profile) return null;

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${embedded ? 'space-y-4' : 'space-y-5'}`}>
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{heading}</h1>
          <p className="mt-1 text-sm text-slate-600 leading-relaxed">{description}</p>
        </div>
      )}

      {error && (
        <div className="alert-error px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {mode === 'full' && (
        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-slate-200" /> Available
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-[var(--color-brand)]" /> Training sessions
          </span>
        </div>
      )}
      {mode === 'bookings-only' && (
        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-[var(--color-brand)]" /> Training sessions
          </span>
        </div>
      )}

      {loading && !range ? (
        <div className="flex flex-1 items-center justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div
          className={`card min-h-0 flex-1 overflow-hidden ${
            embedded ? 'h-[620px]' : 'h-[calc(100vh-15rem)] min-h-[520px]'
          }`}
        >
          <Calendar
            localizer={localizer}
            events={events}
            style={{ height: '100%', minHeight: 480 }}
            className="h-full [&_.rbc-time-view]:h-full [&_.rbc-month-view]:h-full [&_.rbc-agenda-view]:h-full [&_.rbc-row-content]:z-0"
            startAccessor="start"
            endAccessor="end"
            titleAccessor="title"
            date={date}
            view={view}
            onNavigate={(newDate: Date, _view: View, _action: NavigateAction) => setDate(new Date(newDate))}
            onView={setView}
            onRangeChange={(newRange) => {
              if (Array.isArray(newRange)) return;
              setRange(newRange);
            }}
            eventPropGetter={eventStyleGetter}
            onSelectEvent={(event: CalendarEvent) => {
              setSelectedEvent(event);
              setInfoModalOpen(true);
            }}
            views={CALENDAR_VIEWS}
            step={30}
            showMultiDayTimes
            components={{
              toolbar: (props) => (
                <CalendarToolbar {...props} views={(props.views as View[]) ?? CALENDAR_VIEWS} />
              ),
            }}
            formats={{
              dayHeaderFormat: (dateValue) => format(dateValue, 'EEE d MMM'),
              dayRangeHeaderFormat: ({ start, end }) =>
                `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`,
              monthHeaderFormat: (dateValue) => format(dateValue, 'MMMM yyyy'),
              agendaDateFormat: (dateValue) => format(dateValue, 'EEE d MMM'),
              agendaTimeFormat: (dateValue) => format(dateValue, 'HH:mm'),
              agendaTimeRangeFormat: ({ start, end }) =>
                `${format(start, 'HH:mm')} – ${format(end, 'HH:mm')}`,
            }}
          />
        </div>
      )}

      {selectedEvent && infoModalOpen && (
        <EventInfoModal
          event={selectedEvent}
          timezone={displayTimezone}
          onClose={() => {
            setInfoModalOpen(false);
            // Don't clear selectedEvent here, let it persist for cancellation if needed
          }}
          onRequestCancel={
            selectedEvent.type === 'scheduled' && onCancelBooking
              ? () => {
                  setInfoModalOpen(false);
                  setCancelConfirmOpen(true);
                }
              : undefined
          }
          cancellingId={cancellingId}
        />
      )}

      {onCancelBooking && (
        <ConfirmationDialog
          open={cancelConfirmOpen}
          title="Cancel training session?"
          message="This will cancel the scheduled session. You can create a new booking later if needed."
          confirmLabel="Cancel session"
          busyLabel="Cancelling…"
          cancelLabel="Keep"
          onConfirm={async () => {
            if (selectedEvent?.type === 'scheduled' && selectedEvent.id) {
              await onCancelBooking(selectedEvent.id);
              setCancelConfirmOpen(false);
              setSelectedEvent(null);
              if (range) void load(range.start, range.end);
            }
          }}
          onCancel={() => {
            setCancelConfirmOpen(false);
            setSelectedEvent(null);
          }}
          busy={cancellingId === selectedEvent?.id}
        />
      )}

    </div>
  );
}
