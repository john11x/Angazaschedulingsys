import { NavLink, Outlet } from 'react-router';
import { useCoordinatorAuth } from '@/hooks/useCoordinatorAuth';

const nav: { to: string; label: string; end?: boolean }[] = [
  { to: '/app', label: 'Dashboard', end: true },
  { to: '/app/schools', label: 'Schools' },
  { to: '/app/users', label: 'Users', end: true },
  { to: '/app/users/create', label: 'Create user' },
  { to: '/app/schedule', label: 'Schedule session' },
];

export default function CoordinatorLayout() {
  const { logout } = useCoordinatorAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <aside className="bg-[var(--color-landing-dark)] text-white md:w-56 shrink-0">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <img 
            src="/logos/angaza-center-horizontal-logo-full-color.png" 
            alt="Angaza Center" 
            className="h-8 w-auto object-contain"
          />
        </div>
        <nav className="p-2 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible">
          {nav.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end ?? false}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive ? 'bg-white/15 text-white' : 'text-white/90 hover:bg-white/10 hover:text-white'
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
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/80 hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
          <span className="font-semibold text-slate-800">Coordinator</span>
          <button
            type="button"
            onClick={() => void logout()}
            className="text-sm text-[var(--color-brand)] font-medium"
          >
            Sign out
          </button>
        </header>
        <main className="flex-1 p-4 md:p-8 max-w-5xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
