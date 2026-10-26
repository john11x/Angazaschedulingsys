import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { dataClient } from '@/lib/data-client';

interface UserRow {
  id: string;
  fullName: string;
  email: string;
  role: string;
  timezone: string;
  schoolId?: string | null;
}

interface SchoolInfo {
  name: string;
  timezone: string;
}

export default function CoordinatorUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [schoolMap, setSchoolMap] = useState<Record<string, SchoolInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, schoolsRes] = await Promise.all([
        dataClient.models.User.list({ limit: 500 }),
        dataClient.models.School.list({ limit: 500 }),
      ]);
      if (usersRes.errors?.length) throw new Error(usersRes.errors.map((e) => e.message).join(', '));
      if (schoolsRes.errors?.length) throw new Error(schoolsRes.errors.map((e) => e.message).join(', '));

      const map: Record<string, SchoolInfo> = {};
      (schoolsRes.data ?? []).forEach((s) => {
        map[s.id] = { name: s.name, timezone: s.timezone };
      });
      setSchoolMap(map);

      setUsers(
        (usersRes.data ?? []).map((u) => ({
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          role: u.role,
          timezone: u.timezone,
          schoolId: u.schoolId,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byRole = (r: string) => users.filter((u) => u.role === r);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="text-slate-600 mt-1">Profiles created through the system ({users.length} total).</p>
        </div>
        <Link
          to="/app/users/create"
          className="inline-flex justify-center px-4 py-2 rounded-lg bg-[var(--color-brand)] text-white font-semibold text-sm"
        >
          Create user
        </Link>
      </div>

      {error && (
        <div className="alert-error px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <div className="space-y-6">
          {(['COORDINATOR', 'LEAD_TEACHER', 'TRAINER'] as const).map((role) => {
            const list = byRole(role);
            const label =
              role === 'COORDINATOR'
                ? 'Coordinators'
                : role === 'LEAD_TEACHER'
                  ? 'Lead teachers'
                  : 'Trainers';
            return (
              <section key={role}>
                <h2 className="text-sm font-semibold text-slate-500 mb-2">
                  {label} ({list.length})
                </h2>
                <div className="card overflow-hidden text-sm">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2 font-medium text-slate-600">Name</th>
                        <th className="px-4 py-2 font-medium text-slate-600">Email</th>
                        <th className="px-4 py-2 font-medium text-slate-600 hidden sm:table-cell">School</th>
                        <th className="px-4 py-2 font-medium text-slate-600 hidden md:table-cell">Timezone</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {list.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-4 text-slate-500">
                            None
                          </td>
                        </tr>
                      ) : (
                        list.map((u) => {
                          const school = u.schoolId ? schoolMap[u.schoolId] : null;
                          return (
                            <tr key={u.id}>
                              <td className="px-4 py-3 font-medium text-slate-900">{u.fullName}</td>
                              <td className="px-4 py-3 text-slate-600">{u.email}</td>
                              <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                                {school?.name ?? '—'}
                              </td>
                              <td className="px-4 py-3 text-slate-500 font-mono text-xs hidden md:table-cell">
                                {u.timezone}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
