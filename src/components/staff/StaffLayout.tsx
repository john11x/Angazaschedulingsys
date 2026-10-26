import { NavLink, Outlet } from 'react-router';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSchoolInfo } from '@/hooks/useSchoolInfo';
import Spinner from '@/components/shared/Spinner';

function staffNav(role: string, isCoordinator: boolean) {
  const base = [
    { to: '/dashboard', label: 'Dashboard', end: true },
    { to: '/dashboard/bookings', label: 'Bookings', end: true },
    {
      to: role === 'TRAINER' ? '/dashboard/availability' : '/dashboard/school-availability',
      label: role === 'TRAINER' ? 'Trainer availability' : 'School availability',
      end: true,
    },
  ];
  if (role === 'TRAINER') {
    base.push({ to: '/dashboard/schedule', label: 'Schedule session', end: true });
  }
  if (role === 'LEAD_TEACHER' || isCoordinator) {
    if (isCoordinator && role !== 'TRAINER') {
      base.push({ to: '/dashboard/schedule', label: 'Schedule session', end: true });
    }
    base.push({ to: '/dashboard/school', label: 'My school', end: true });
  }
  return base;
}

export default function StaffLayout() {
  const { loading, profile, error, isCoordinator, logout } = useCurrentUser();
  const { school } = useSchoolInfo(profile?.schoolId);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spinner />
      </div>
    );
  }

  if (isCoordinator && location.pathname.startsWith('/app')) {
    // Coordinators can stay in /app or go to /dashboard manually
  } else if (isCoordinator && !location.pathname.startsWith('/dashboard')) {
     // Default for coordinators is /app unless they explicitly go to dashboard
     // Actually, we skip the restriction in StaffLayout to let them test everything.
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="card max-w-md p-8 text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Profile not found</h1>
          <p className="text-slate-600 text-sm mb-6">
            {error ?? 'Your account is not set up in the system. Ask a coordinator to create your user profile.'}
          </p>
          <div className="flex flex-col gap-2">
            <a
              href="/"
              className="focus-ring inline-flex justify-center px-4 py-2 rounded-lg bg-[var(--color-brand)] text-white font-semibold text-sm transition-colors hover:bg-[var(--color-brand-hover)]"
            >
              Back to home
            </a>
            <button
              type="button"
              onClick={() => void logout()}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const nav = staffNav(profile.role, isCoordinator);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <aside className="shrink-0 bg-[var(--color-landing-dark)] text-white md:w-72">
        <div className="border-b border-white/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Angaza</p>
          <p className="mt-3 text-lg font-semibold">
            {profile.role === 'LEAD_TEACHER' ? school?.name ?? 'My school' : profile.fullName}
          </p>
          <p className="mt-1 text-sm text-white/70">
            {profile.role === 'LEAD_TEACHER' ? 'Lead teacher workspace' : 'Trainer workspace'}
          </p>
          {school && profile.role === 'LEAD_TEACHER' && (
            <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-xs text-white/80">
              {school.city}, {school.country} · {school.timezone}
            </p>
          )}
        </div>
        <nav className="flex flex-row gap-1 overflow-x-auto p-3 md:flex-col md:overflow-visible">
          {nav.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end ?? false}
              className={({ isActive }) =>
                `rounded-xl px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive ? 'bg-white text-slate-900' : 'text-white/90 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 mt-auto hidden md:block">
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-white/80 hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
          <span className="font-semibold text-slate-800">
            {profile.role === 'LEAD_TEACHER' ? school?.name ?? 'My school' : profile.fullName}
          </span>
          <button
            type="button"
            onClick={() => void logout()}
            className="text-sm text-[var(--color-brand)] font-medium"
          >
            Sign out
          </button>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
