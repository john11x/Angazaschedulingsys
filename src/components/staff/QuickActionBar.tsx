import { Link } from 'react-router';

interface QuickActionBarProps {
  isLeadTeacher: boolean;
}

function actionButton(to: string, label: string, variant: 'primary' | 'secondary') {
  return (
    <Link
      to={to}
      className={`focus-ring inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
        variant === 'primary'
          ? 'bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-hover)]'
          : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
      }`}
    >
      {label}
    </Link>
  );
}

export default function QuickActionBar({ isLeadTeacher }: QuickActionBarProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {!isLeadTeacher && actionButton('/dashboard/schedule', '+ Session', 'primary')}
      {actionButton(
        isLeadTeacher ? '/dashboard/school-availability' : '/dashboard/availability',
        '+ Availability',
        'secondary',
      )}
    </div>
  );
}
