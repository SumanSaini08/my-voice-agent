import { describe, expect, it } from 'vitest';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';

describe('createRateLimiter', () => {
  it('allows requests up to the limit', () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 1000 });
    expect(limiter.check('1.1.1.1').ok).toBe(true);
    expect(limiter.check('1.1.1.1').ok).toBe(true);
    expect(limiter.check('1.1.1.1').ok).toBe(true);
  });

  it('denies the request past the limit', () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
    limiter.check('1.1.1.1');
    limiter.check('1.1.1.1');
    const denied = limiter.check('1.1.1.1');
    expect(denied.ok).toBe(false);
    expect(denied.remaining).toBe(0);
  });

  it('reports a positive retryAfter on denial', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    limiter.check('1.1.1.1');
    expect(limiter.check('1.1.1.1').retryAfterSec).toBeGreaterThan(0);
  });

  it('tracks each client independently', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(limiter.check('1.1.1.1').ok).toBe(true);
    expect(limiter.check('1.1.1.1').ok).toBe(false);
    expect(limiter.check('2.2.2.2').ok).toBe(true);
  });

  it('lets the window slide so a client recovers', () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => now });
    expect(limiter.check('1.1.1.1').ok).toBe(true);
    expect(limiter.check('1.1.1.1').ok).toBe(false);
    now += 1001;
    expect(limiter.check('1.1.1.1').ok).toBe(true);
  });

  it('decrements remaining as requests are allowed', () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 1000 });
    expect(limiter.check('1.1.1.1').remaining).toBe(2);
    expect(limiter.check('1.1.1.1').remaining).toBe(1);
    expect(limiter.check('1.1.1.1').remaining).toBe(0);
  });

  it('prunes idle clients so memory does not grow without bound', () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 5, windowMs: 1000, now: () => now });
    for (let i = 0; i < 50; i++) {
      limiter.check(`10.0.0.${i}`);
    }
    expect(limiter.size()).toBe(50);
    now += 5000;
    limiter.check('10.0.0.0');
    expect(limiter.size()).toBe(1);
  });
});

describe('getClientIp', () => {
  it('reads the first entry of x-forwarded-for', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.5, 70.41.3.18, 150.172.238.178' });
    expect(getClientIp(headers)).toBe('203.0.113.5');
  });

  it('trims whitespace', () => {
    expect(getClientIp(new Headers({ 'x-forwarded-for': '  203.0.113.5 ' }))).toBe('203.0.113.5');
  });

  it('falls back to x-real-ip', () => {
    expect(getClientIp(new Headers({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7');
  });

  it('falls back to a constant when no header is present', () => {
    expect(getClientIp(new Headers())).toBe('unknown');
  });
});
