import type { View, NavigateAction } from 'react-big-calendar';
import { Navigate } from 'react-big-calendar';

export interface CalendarToolbarProps {
  label: string;
  view: View;
  views: View[];
  onNavigate: (action: NavigateAction, date?: Date) => void;
  onView: (view: View) => void;
  localizer: { messages?: unknown };
}

const VIEW_LABELS: Record<string, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  agenda: 'Agenda',
};

export default function CalendarToolbar({
  label,
  view,
  views,
  onNavigate,
  onView,
  localizer,
}: CalendarToolbarProps) {
  const messages = (localizer?.messages ?? {}) as Record<string, string>;
  const isMonthView = view === 'month';

  const btnBase = 'focus-ring rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50';
  const btnActive = 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-hover)] hover:border-[var(--color-brand)]';

  return (
    <div className="rbc-toolbar flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rbc-btn-group flex items-center gap-1">
          <button type="button" onClick={() => onNavigate(Navigate.PREVIOUS)} className={btnBase}>
            {messages.previous ?? 'Prev'}
          </button>
          <button type="button" onClick={() => onNavigate(Navigate.TODAY)} className={btnBase}>
            {messages.today ?? 'Today'}
          </button>
          <button type="button" onClick={() => onNavigate(Navigate.NEXT)} className={btnBase}>
            {messages.next ?? 'Next'}
          </button>
        </span>
        <h2
          className={`ml-2 min-w-[180px] rounded-xl px-4 py-1.5 text-center text-lg font-semibold transition-colors ${
            isMonthView
              ? 'bg-[var(--color-brand)]/10 text-[var(--color-brand)] ring-1 ring-[var(--color-brand)]/20'
              : 'text-slate-800'
          }`}
        >
          {label}
        </h2>
      </div>
      <div className="rbc-btn-group flex items-center gap-1">
        {views.map((v) => (
          <button
            type="button"
            key={v}
            onClick={() => onView(v)}
            aria-pressed={view === v}
            className={`focus-ring rounded-xl border px-3 py-1.5 text-sm font-semibold transition-colors ${
              view === v ? btnActive : btnBase
            }`}
          >
            {VIEW_LABELS[v] ?? v}
          </button>
        ))}
      </div>
    </div>
  );
}
