import { Navigate, Outlet, useLocation } from 'react-router';
import { getCurrentUser } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { useEffect, useState } from 'react';
import { useCoordinatorAuth } from '@/hooks/useCoordinatorAuth';
import Spinner from '@/components/shared/Spinner';

export default function RequireCoordinator() {
  const { loading, isCoordinator, logout } = useCoordinatorAuth();
  const location = useLocation();
  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getCurrentUser()
      .then(() => {
        if (!cancelled) {
          setSignedIn(true);
          setAuthChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSignedIn(false);
          setAuthChecked(true);
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

  if (!authChecked || loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!signedIn) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!isCoordinator) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="card max-w-md p-8 text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Coordinator access required</h1>
          <p className="text-slate-600 text-sm mb-6">
            Your account is not in the <strong>Coordinators</strong> Cognito group. Ask an
            administrator to add you, or sign in with a coordinator account.
          </p>
          <div className="flex flex-col gap-2">
            <a
              href="/"
              className="inline-flex justify-center px-4 py-2 rounded-lg bg-[var(--color-brand)] text-white font-semibold text-sm"
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

  return <Outlet />;
}
