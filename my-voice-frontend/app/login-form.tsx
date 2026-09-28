'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      if (res.ok) {
        router.refresh();
        return;
      }

      if (res.status === 429) {
        setError('Too many attempts. Please wait a minute and try again.');
      } else if (res.status === 503) {
        setError('This deployment is not configured for sign-in yet.');
      } else {
        setError('That access code is not valid.');
      }
      setPending(false);
    } catch {
      setError('Could not reach the server. Check your connection.');
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
      >
        <h1 className="text-lg font-semibold">Enter access code</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          This voice agent requires an access code to start a call.
        </p>

        <label htmlFor="access-code" className="mt-6 block text-sm font-medium">
          Access code
        </label>
        <input
          id="access-code"
          name="code"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)] dark:border-neutral-700 dark:bg-neutral-900"
        />

        {error ? (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Checking…' : 'Continue'}
        </button>
      </form>
    </main>
  );
}
