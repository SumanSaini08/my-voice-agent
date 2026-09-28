export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }
  return headers.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * Fixed-memory sliding-window limiter, keyed per client IP.
 *
 * This is per-instance state. On serverless platforms each cold instance keeps
 * its own counters, so it blunts casual abuse rather than enforcing a strict
 * global quota. Use a shared store (Upstash, KV) if you need a hard limit.
 */
export function createRateLimiter(args: { limit: number; windowMs: number; now?: () => number }) {
  const { limit, windowMs } = args;
  const now = args.now ?? (() => Date.now());
  const hits = new Map<string, number[]>();

  function prune(windowStart: number) {
    for (const [key, stamps] of hits) {
      const kept = stamps.filter((t) => t > windowStart);
      if (kept.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, kept);
      }
    }
  }

  return {
    check(key: string): RateLimitResult {
      const current = now();
      const windowStart = current - windowMs;
      prune(windowStart);

      const stamps = (hits.get(key) ?? []).filter((t) => t > windowStart);
      if (stamps.length >= limit) {
        const oldest = stamps[0];
        const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - current) / 1000));
        hits.set(key, stamps);
        return { ok: false, remaining: 0, retryAfterSec };
      }

      stamps.push(current);
      hits.set(key, stamps);
      return { ok: true, remaining: limit - stamps.length, retryAfterSec: 0 };
    },

    size(): number {
      return hits.size;
    },

    reset(): void {
      hits.clear();
    },
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;

/**
 * Limiters are created lazily and cached on globalThis so they survive the
 * module reloading that happens on every serverless invocation.
 */
const globalStore = globalThis as typeof globalThis & {
  __lkRateLimiters?: Map<string, RateLimiter>;
};

export function getRateLimiter(name: string, limit: number, windowMs: number): RateLimiter {
  globalStore.__lkRateLimiters ??= new Map<string, RateLimiter>();
  const cache = globalStore.__lkRateLimiters;
  const existing = cache.get(name);
  if (existing) {
    return existing;
  }
  const created = createRateLimiter({ limit, windowMs });
  cache.set(name, created);
  return created;
}
