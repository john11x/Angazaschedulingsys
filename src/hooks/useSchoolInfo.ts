import { useCallback, useEffect, useState } from 'react';
import { dataClient } from '@/lib/data-client';

export interface SchoolInfo {
  id: string;
  name: string;
  type: string;
  country: string;
  city: string;
  timezone: string;
}

export function useSchoolInfo(schoolId: string | null | undefined) {
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [loading, setLoading] = useState(Boolean(schoolId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!schoolId) {
      setSchool(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, errors } = await dataClient.models.School.get({ id: schoolId });
      if (errors?.length) {
        throw new Error(errors.map((entry) => entry.message).join(', '));
      }

      if (!data) {
        setSchool(null);
        return;
      }

      setSchool({
        id: data.id,
        name: data.name,
        type: data.type,
        country: data.country,
        city: data.city,
        timezone: data.timezone,
      });
    } catch (err) {
      setSchool(null);
      setError(err instanceof Error ? err.message : 'Failed to load school');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    school,
    loading,
    error,
    refresh,
  };
}
