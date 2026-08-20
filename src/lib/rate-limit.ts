/**
 * In-memory sliding-window rate limiter for expensive authenticated endpoints
 * (chat, TTS, STT, image generation).
 *
 * Scope: per serverless instance, so it is a cost/abuse guard rather than a hard
 * global quota — enough to stop one account burning the shared LLM/TTS key pools
 * in a loop. A durable limiter would need Redis/Postgres; this deliberately keeps
 * zero infrastructure.
 */
type Hit = { count: number; resetAt: number };

const buckets = new Map<string, Hit>();
let lastSweep = 0;

/** Drop expired buckets occasionally so the map can't grow unbounded. */
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}

export type RateVerdict = { ok: true } | { ok: false; retryAfter: number };

/**
 * Count one hit for `key`. Returns ok:false (with seconds to wait) once `limit`
 * hits happen inside `windowMs`.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateVerdict {
  const now = Date.now();
  sweep(now);
  const hit = buckets.get(key);
  if (!hit || hit.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  hit.count += 1;
  if (hit.count > limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((hit.resetAt - now) / 1000)) };
  }
  return { ok: true };
}

/** Per-endpoint budgets — generous for a human, tight for a loop. */
export const LIMITS = {
  chat: { limit: 30, windowMs: 60_000 }, // 30 messages/min
  tts: { limit: 40, windowMs: 60_000 },
  stt: { limit: 20, windowMs: 60_000 },
  image: { limit: 20, windowMs: 60_000 },
} as const;
