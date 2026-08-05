/**
 * Simple in-memory sliding-window rate limiter.
 * Suitable for a single Node process (Hostinger). Resets on restart.
 */

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

const MAX_KEYS = 20_000;

function pruneIfNeeded() {
  if (buckets.size <= MAX_KEYS) return;
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < 60 * 60 * 1000);
    if (bucket.timestamps.length === 0) buckets.delete(key);
  }
  if (buckets.size > MAX_KEYS) {
    const excess = buckets.size - Math.floor(MAX_KEYS * 0.8);
    const keys = buckets.keys();
    for (let i = 0; i < excess; i++) {
      const next = keys.next();
      if (next.done) break;
      buckets.delete(next.value);
    }
  }
}

function getBucket(key: string): Bucket {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }
  return bucket;
}

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSec: number; remaining: 0 };

/** Check without recording a hit. */
export function peekRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  pruneIfNeeded();
  const now = Date.now();
  const bucket = getBucket(key);
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0]!;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return { allowed: false, retryAfterSec, remaining: 0 };
  }
  return { allowed: true, remaining: limit - bucket.timestamps.length };
}

/** Record a hit and return whether the limit is now exceeded (after this hit). */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const peek = peekRateLimit(key, limit, windowMs);
  if (!peek.allowed) return peek;

  const bucket = getBucket(key);
  bucket.timestamps.push(Date.now());
  return { allowed: true, remaining: limit - bucket.timestamps.length };
}

/** Record a failure hit only (for lockouts that shouldn't count successes). */
export function recordRateLimitHit(key: string, windowMs: number) {
  pruneIfNeeded();
  const now = Date.now();
  const bucket = getBucket(key);
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
  bucket.timestamps.push(now);
}

export function clearRateLimit(key: string) {
  buckets.delete(key);
}

export function rateLimitResponse(
  retryAfterSec: number,
  message = "Too many requests. Try again later."
) {
  return {
    body: { error: "RATE_LIMIT_EXCEEDED", message },
    status: 429 as const,
    headers: { "Retry-After": String(retryAfterSec) },
  };
}
