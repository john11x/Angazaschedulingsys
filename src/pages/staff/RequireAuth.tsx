import { Navigate, Outlet, useLocation } from 'react-router';
import { getCurrentUser } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { useEffect, useState } from 'react';
import Spinner from '@/components/shared/Spinner';

export default function RequireAuth() {
  const location = useLocation();
  const [checked, setChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getCurrentUser()
      .then(() => {
        if (!cancelled) {
          setSignedIn(true);
          setChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSignedIn(false);
          setChecked(true);
        }
      });

    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedOut') {
        setSignedIn(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [location.pathname]);

  if (!checked) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!signedIn) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
}
