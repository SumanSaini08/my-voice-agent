import { SignJWT, jwtVerify } from 'jose';
import { timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'lk_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 8;

export type AccessDecision = 'allow' | 'deny' | 'unconfigured';

/**
 * Constant-time string comparison, so a caller cannot brute-force the access
 * code by measuring how long a rejection takes.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // timingSafeEqual throws on a length mismatch. Compare the buffer against
    // itself so the call still takes roughly the same time as a real compare.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function isAuthConfigured(env: { tokenApiKey?: string; sessionSecret?: string }): boolean {
  return Boolean(env.tokenApiKey && env.sessionSecret);
}

/**
 * Both the access code and the session secret must be present. A half-configured
 * deployment must not silently fall back to an open door.
 */
export function evaluateAccessCode(args: {
  submitted: string | undefined;
  expected: string;
  isDev: boolean;
}): AccessDecision {
  const { submitted, expected, isDev } = args;
  if (!expected) {
    return isDev ? 'allow' : 'unconfigured';
  }
  if (!submitted) {
    return 'deny';
  }
  return safeEqual(submitted, expected) ? 'allow' : 'deny';
}

function signingKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSession(secret: string, ttlSeconds: number = SESSION_TTL_SECONDS) {
  return await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(signingKey(secret));
}

export async function verifySession(token: string, secret: string): Promise<boolean> {
  try {
    await jwtVerify(token, signingKey(secret), { algorithms: ['HS256'] });
    return true;
  } catch {
    return false;
  }
}

export async function evaluateSession(args: {
  cookie: string | undefined;
  sessionSecret: string;
  isDev: boolean;
  authEnabled: boolean;
}): Promise<AccessDecision> {
  const { cookie, sessionSecret, isDev, authEnabled } = args;
  if (!authEnabled) {
    return isDev ? 'allow' : 'unconfigured';
  }
  if (!cookie) {
    return 'deny';
  }
  return (await verifySession(cookie, sessionSecret)) ? 'allow' : 'deny';
}

export function authCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}
