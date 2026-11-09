// Shared, dependency-free brute-force protection (in-memory, per instance).
// Sliding-window rate limit + consecutive-failure lockout. Used by all login surfaces.

const buckets = new Map<string, { count: number; resetAt: number }>();
const failures = new Map<string, { count: number; lastAt: number; lockedUntil: number }>();
export const STREAK_WINDOW_MS = 10 * 60 * 1000;
export const FAIL_LIMIT = 10;
export const LOCKOUT_MS = 10 * 60 * 1000;

/** Sliding-window counter. Returns true once `max` requests per `windowMs` are exceeded. */
export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const e = buckets.get(key);
  if (!e || e.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  e.count += 1;
  return e.count > max;
}

export function lockedOut(key: string): boolean {
  const f = failures.get(key);
  return Boolean(f && f.lockedUntil > Date.now());
}

/** Record one failed credential check. Returns true if this failure trips the lockout. */
export function recordFailure(key: string): boolean {
  const now = Date.now();
  const prev = failures.get(key);
  const count = prev && now - prev.lastAt < STREAK_WINDOW_MS ? prev.count + 1 : 1;
  const lockedUntil = count >= FAIL_LIMIT ? now + LOCKOUT_MS : 0;
  failures.set(key, { count, lastAt: now, lockedUntil });
  return lockedUntil > now;
}

export function clearFailures(key: string) {
  failures.delete(key);
}
