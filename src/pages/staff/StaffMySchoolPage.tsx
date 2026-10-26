import { Link } from 'react-router';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSchoolInfo } from '@/hooks/useSchoolInfo';
import Spinner from '@/components/shared/Spinner';

export default function StaffMySchoolPage() {
  const { profile } = useCurrentUser();
  const { school, loading, error } = useSchoolInfo(profile?.schoolId);

  if (!profile) return null;

  if (!profile.schoolId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">My school</h1>
        <div className="alert-warning p-6 text-sm">
          You are not assigned to a school yet. Ask a coordinator to link your account to a member
          school.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">My school</h1>
        <p className="mt-1 text-sm text-slate-600 leading-relaxed">Your member school details.</p>
      </div>

      {error && (
        <div className="alert-error px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : school ? (
        <div className="card overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">{school.name}</h2>
            <p className="text-sm text-slate-500 mt-1">
              {school.type === 'MEMBER' ? 'Member school' : 'Partner school'}
            </p>
          </div>
          <dl className="grid sm:grid-cols-2 gap-4 p-6 text-sm">
            <div>
              <dt className="font-medium text-slate-500">City</dt>
              <dd className="text-slate-900 mt-0.5">{school.city}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Country</dt>
              <dd className="text-slate-900 mt-0.5">{school.country}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Timezone</dt>
              <dd className="text-slate-900 mt-0.5 font-mono">{school.timezone}</dd>
            </div>
          </dl>
          <div className="px-6 pb-6">
            <Link
              to="/dashboard/school-availability"
              className="text-sm font-medium text-[var(--color-brand)] hover:underline"
            >
              Manage school availability →
            </Link>
          </div>
        </div>
      ) : (
        <div className="card p-8 text-center text-slate-500 text-sm">
          School not found.
        </div>
      )}
    </div>
  );
}
