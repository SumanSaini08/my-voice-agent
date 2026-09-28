import { describe, expect, it } from 'vitest';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  evaluateAccessCode,
  evaluateSession,
  isAuthConfigured,
  safeEqual,
  signSession,
  verifySession,
} from '@/lib/auth';

const SECRET = 'a-test-signing-secret-value';

describe('safeEqual', () => {
  it('returns true for identical strings', () => {
    expect(safeEqual('letmein', 'letmein')).toBe(true);
  });

  it('returns false for different strings of equal length', () => {
    expect(safeEqual('letmein', 'letmeou')).toBe(false);
  });

  it('returns false for different lengths without throwing', () => {
    expect(safeEqual('short', 'much-longer-value')).toBe(false);
  });

  it('handles empty strings', () => {
    expect(safeEqual('', '')).toBe(true);
    expect(safeEqual('', 'x')).toBe(false);
  });
});

describe('isAuthConfigured', () => {
  it('requires both the access code and the session secret', () => {
    expect(isAuthConfigured({ tokenApiKey: 'k', sessionSecret: 's' })).toBe(true);
    expect(isAuthConfigured({ tokenApiKey: 'k', sessionSecret: '' })).toBe(false);
    expect(isAuthConfigured({ tokenApiKey: '', sessionSecret: 's' })).toBe(false);
    expect(isAuthConfigured({ tokenApiKey: '', sessionSecret: '' })).toBe(false);
  });
});

describe('evaluateAccessCode', () => {
  it('allows a correct code', () => {
    expect(evaluateAccessCode({ submitted: 'letmein', expected: 'letmein', isDev: false })).toBe(
      'allow'
    );
  });

  it('denies an incorrect code', () => {
    expect(evaluateAccessCode({ submitted: 'nope', expected: 'letmein', isDev: false })).toBe(
      'deny'
    );
  });

  it('denies an empty submission', () => {
    expect(evaluateAccessCode({ submitted: '', expected: 'letmein', isDev: false })).toBe('deny');
    expect(evaluateAccessCode({ submitted: undefined, expected: 'letmein', isDev: false })).toBe(
      'deny'
    );
  });

  it('fails closed in production when no code is configured', () => {
    expect(evaluateAccessCode({ submitted: 'anything', expected: '', isDev: false })).toBe(
      'unconfigured'
    );
  });

  it('stays open in development so local work needs no setup', () => {
    expect(evaluateAccessCode({ submitted: 'anything', expected: '', isDev: true })).toBe('allow');
  });
});

describe('session tokens', () => {
  it('signs a token that verifies with the same secret', async () => {
    const token = await signSession(SECRET);
    await expect(verifySession(token, SECRET)).resolves.toBe(true);
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signSession(SECRET);
    await expect(verifySession(token, 'a-completely-different-secret')).resolves.toBe(false);
  });

  it('rejects garbage and empty tokens', async () => {
    await expect(verifySession('not-a-jwt', SECRET)).resolves.toBe(false);
    await expect(verifySession('', SECRET)).resolves.toBe(false);
  });

  it('rejects a token that has expired', async () => {
    const token = await signSession(SECRET, -60);
    await expect(verifySession(token, SECRET)).resolves.toBe(false);
  });

  it('rejects an unsigned "alg=none" token', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ exp: 9999999999 })).toString('base64url');
    await expect(verifySession(`${header}.${payload}.`, SECRET)).resolves.toBe(false);
  });

  it('exposes a cookie name and a bounded TTL', () => {
    expect(SESSION_COOKIE).toBe('lk_session');
    expect(SESSION_TTL_SECONDS).toBeGreaterThan(0);
    expect(SESSION_TTL_SECONDS).toBeLessThanOrEqual(60 * 60 * 24);
  });
});

describe('evaluateSession', () => {
  it('allows a valid cookie', async () => {
    const token = await signSession(SECRET);
    await expect(
      evaluateSession({ cookie: token, sessionSecret: SECRET, isDev: false, authEnabled: true })
    ).resolves.toBe('allow');
  });

  it('denies a missing cookie', async () => {
    await expect(
      evaluateSession({ cookie: undefined, sessionSecret: SECRET, isDev: false, authEnabled: true })
    ).resolves.toBe('deny');
  });

  it('denies a tampered cookie', async () => {
    const token = await signSession(SECRET);
    const tampered = `${token.slice(0, -3)}xyz`;
    await expect(
      evaluateSession({ cookie: tampered, sessionSecret: SECRET, isDev: false, authEnabled: true })
    ).resolves.toBe('deny');
  });

  it('fails closed in production when auth is not configured', async () => {
    await expect(
      evaluateSession({ cookie: 'anything', sessionSecret: '', isDev: false, authEnabled: false })
    ).resolves.toBe('unconfigured');
  });

  it('stays open in development when auth is not configured', async () => {
    await expect(
      evaluateSession({ cookie: undefined, sessionSecret: '', isDev: true, authEnabled: false })
    ).resolves.toBe('allow');
  });
});
