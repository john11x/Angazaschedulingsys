import { useEffect, useState } from 'react';
import { Authenticator, useAuthenticator, Button } from '@aws-amplify/ui-react';
import { Navigate, useLocation, Link } from 'react-router';
import { fetchAuthSession } from 'aws-amplify/auth';

const authenticatorFormFields = {
  signIn: {
    username: {
      label: 'Email',
      placeholder: 'Enter your email',
      autocomplete: 'username',
    },
  },
  forgotPassword: {
    username: {
      label: 'Email',
      placeholder: 'Enter your email',
      autocomplete: 'username',
    },
  },
} as const;

function AuthScreenFooter() {
  const { toSignIn } = useAuthenticator();
  return (
    <div className="flex flex-col items-center gap-3 pt-4 pb-2">
      <Button fontWeight="normal" onClick={toSignIn} size="small" variation="link">
        Back to sign in
      </Button>
      <Link
        to="/"
        className="text-slate-500 hover:text-[var(--color-brand)] font-medium text-sm inline-flex items-center gap-1 transition-colors"
      >
        &larr; Return to Home
      </Link>
    </div>
  );
}

function parseGroups(payload: Record<string, unknown> | undefined): string[] {
  const g = payload?.['cognito:groups'];
  if (Array.isArray(g)) return g as string[];
  if (typeof g === 'string') return [g];
  return [];
}

function PostLoginRedirect() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    void fetchAuthSession().then((session) => {
      const groups = parseGroups(session.tokens?.idToken?.payload as Record<string, unknown>);
      if (groups.includes('Coordinators')) {
        setTarget(from?.startsWith('/app') ? from : '/app');
      } else {
        setTarget(from?.startsWith('/dashboard') ? from : '/dashboard');
      }
    });
  }, [from]);

  if (!target) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-[var(--color-brand)] border-t-transparent animate-spin" />
      </div>
    );
  }

  return <Navigate to={target} replace />;
}

const components = {
  SignIn: {
    Footer() {
      const { toForgotPassword } = useAuthenticator();
      return (
        <div className="flex flex-col items-center gap-3 pt-4 pb-2">
          <Button
            fontWeight="normal"
            onClick={toForgotPassword}
            size="small"
            variation="link"
          >
            Forgot your password?
          </Button>
          <Link
            to="/"
            className="text-slate-500 hover:text-[var(--color-brand)] font-medium text-sm inline-flex items-center gap-1 transition-colors"
          >
            &larr; Return to Home
          </Link>
        </div>
      );
    },
  },
  ForgotPassword: {
    Footer: AuthScreenFooter,
  },
  ConfirmResetPassword: {
    Footer: AuthScreenFooter,
  },
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-100">
      <div className="w-full max-w-md">
        <Authenticator hideSignUp components={components} formFields={authenticatorFormFields}>
          <PostLoginRedirect />
        </Authenticator>
      </div>
    </div>
  );
}
