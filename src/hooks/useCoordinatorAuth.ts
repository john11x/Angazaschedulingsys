import { useCallback, useEffect, useState } from 'react';
import { fetchAuthSession, signOut } from 'aws-amplify/auth';

function parseGroups(payload: Record<string, unknown> | undefined): string[] {
  const g = payload?.['cognito:groups'];
  if (Array.isArray(g)) return g as string[];
  if (typeof g === 'string') return [g];
  return [];
}

export function useCoordinatorAuth() {
  const [loading, setLoading] = useState(true);
  const [isCoordinator, setIsCoordinator] = useState(false);
  const [userSub, setUserSub] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const session = await fetchAuthSession();
      const sub = session.userSub ?? null;
      setUserSub(sub);
      const groups = parseGroups(
        session.tokens?.idToken?.payload as Record<string, unknown> | undefined,
      );
      setIsCoordinator(groups.includes('Coordinators'));
    } catch {
      setUserSub(null);
      setIsCoordinator(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await signOut();
    setUserSub(null);
    setIsCoordinator(false);
  }, []);

  return { loading, isCoordinator, userSub, refresh, logout };
}
