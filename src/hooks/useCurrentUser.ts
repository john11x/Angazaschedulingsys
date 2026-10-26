import { useCallback, useEffect, useState } from 'react';
import { fetchAuthSession, signOut } from 'aws-amplify/auth';
import { dataClient } from '@/lib/data-client';

function parseGroups(payload: Record<string, unknown> | undefined): string[] {
  const g = payload?.['cognito:groups'];
  if (Array.isArray(g)) return g as string[];
  if (typeof g === 'string') return [g];
  return [];
}

export type StaffRole = 'LEAD_TEACHER' | 'TRAINER';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: string;
  timezone: string;
  schoolId: string | null;
  phoneNumber: string | null;
}

export function useCurrentUser() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isCoordinator, setIsCoordinator] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await fetchAuthSession();
      const sub = session.userSub ?? null;
      const groups = parseGroups(
        session.tokens?.idToken?.payload as Record<string, unknown> | undefined,
      );
      const coordinator = groups.includes('Coordinators');
      setIsCoordinator(coordinator);

      if (!sub) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const { data: user, errors } = await dataClient.models.User.get({ id: sub });
      if (errors?.length) {
        setError(errors.map((e) => e.message).join(', '));
        setProfile(null);
        setLoading(false);
        return;
      }

      if (!user) {
        if (coordinator) {
          const idTokenPayload = session.tokens?.idToken?.payload as Record<string, unknown> | undefined;
          const email = (idTokenPayload?.email as string) ?? '';
          const fullName =
            (idTokenPayload?.name as string) ||
            (idTokenPayload?.preferred_username as string) ||
            email ||
            'Coordinator';
          setProfile({
            id: sub,
            fullName,
            email,
            role: 'COORDINATOR',
            timezone: 'UTC',
            schoolId: null,
            phoneNumber: null,
          });
        } else {
          setProfile(null);
        }
        setLoading(false);
        return;
      }

      // Lead Teacher timezone must match assigned school
      let effectiveTimezone = user.timezone;
      if (user.role === 'LEAD_TEACHER' && user.schoolId) {
        try {
          const { data: school } = await dataClient.models.School.get({ id: user.schoolId });
          if (school && school.timezone && school.timezone !== user.timezone) {
            console.log(`Syncing Lead Teacher timezone to ${school.timezone}`);
            effectiveTimezone = school.timezone;
            // Update in background
            void dataClient.models.User.update({ id: user.id, timezone: school.timezone });
          }
        } catch (e) {
          console.warn('Failed to sync school timezone:', e);
        }
      }

      setProfile({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        timezone: effectiveTimezone,
        schoolId: user.schoolId ?? null,
        phoneNumber: user.phoneNumber ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profile');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await signOut();
    setProfile(null);
    setIsCoordinator(false);
  }, []);

  const isStaff = profile?.role === 'LEAD_TEACHER' || profile?.role === 'TRAINER';

  return {
    loading,
    profile,
    error,
    isCoordinator,
    isStaff: isStaff ?? false,
    staffRole: profile?.role as StaffRole | undefined,
    refresh,
    logout,
  };
}
