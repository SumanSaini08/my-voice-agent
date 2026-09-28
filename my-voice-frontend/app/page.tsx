import { cookies, headers } from 'next/headers';
import { App } from '@/components/app/app';
import { SESSION_COOKIE, evaluateSession, isAuthConfigured } from '@/lib/auth';
import { getAppConfig } from '@/lib/utils';
import LoginForm from './login-form';

export default async function Page() {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);

  const isDev = process.env.NODE_ENV !== 'production';
  const sessionSecret = process.env.SESSION_SECRET ?? '';
  const tokenApiKey = process.env.TOKEN_API_KEY ?? '';

  const store = await cookies();
  const decision = await evaluateSession({
    cookie: store.get(SESSION_COOKIE)?.value,
    sessionSecret,
    isDev,
    authEnabled: isAuthConfigured({ tokenApiKey, sessionSecret }),
  });

  // Gate server-side so the call UI never renders for an unauthenticated
  // visitor. In development, or when auth is not configured, the app is
  // served as before.
  if (decision === 'deny') {
    return <LoginForm />;
  }

  if (decision === 'unconfigured') {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <div className="max-w-md rounded-xl border border-red-300 bg-red-50 p-6 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <h1 className="text-base font-semibold">Server auth is not configured</h1>
          <p className="mt-2">
            Set <code>TOKEN_API_KEY</code> and <code>SESSION_SECRET</code> in the deployment
            environment, then redeploy. Both must be non-empty for sign-in to work.
          </p>
        </div>
      </main>
    );
  }

  return <App appConfig={appConfig} />;
}
