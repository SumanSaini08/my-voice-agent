import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  authCookieOptions,
  evaluateAccessCode,
  evaluateSession,
  isAuthConfigured,
  signSession,
} from '@/lib/auth';
import { getClientIp, getRateLimiter } from '@/lib/rate-limit';

export const revalidate = 0;

const isDev = process.env.NODE_ENV !== 'production';
const tokenApiKey = process.env.TOKEN_API_KEY ?? '';
const sessionSecret = process.env.SESSION_SECRET ?? '';

const LOGIN_LIMIT = { limit: 10, windowMs: 60_000 };

/**
 * Exchange the access code for an httpOnly session cookie.
 *
 * The access code is never handed to client-side code: the browser only ever
 * holds the signed cookie, which it cannot read because it is httpOnly.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req.headers);
  const limited = getRateLimiter('auth-login', LOGIN_LIMIT.limit, LOGIN_LIMIT.windowMs).check(ip);
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait and try again.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } }
    );
  }

  let submitted: string | undefined;
  try {
    const body = await req.json();
    submitted = typeof body?.code === 'string' ? body.code : undefined;
  } catch {
    submitted = undefined;
  }

  const decision = evaluateAccessCode({ submitted, expected: tokenApiKey, isDev });

  if (decision === 'unconfigured') {
    return NextResponse.json(
      { error: 'Server auth is not configured. Set TOKEN_API_KEY and SESSION_SECRET.' },
      { status: 503 }
    );
  }

  if (decision === 'deny') {
    return NextResponse.json({ error: 'Invalid access code.' }, { status: 401 });
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(sessionSecret), authCookieOptions());

  return NextResponse.json({ ok: true });
}

/** Report whether auth is configured and whether the caller holds a valid session. */
export async function GET() {
  const store = await cookies();
  const decision = await evaluateSession({
    cookie: store.get(SESSION_COOKIE)?.value,
    sessionSecret,
    isDev,
    authEnabled: isAuthConfigured({ tokenApiKey, sessionSecret }),
  });

  return NextResponse.json(
    {
      authEnabled: isAuthConfigured({ tokenApiKey, sessionSecret }),
      authenticated: decision === 'allow',
      configured: decision !== 'unconfigured',
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function DELETE() {
  const store = await cookies();
  store.set(SESSION_COOKIE, '', { ...authCookieOptions(), maxAge: 0 });
  return NextResponse.json({ ok: true });
}
