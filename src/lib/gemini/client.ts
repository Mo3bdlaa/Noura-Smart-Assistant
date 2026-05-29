import { GoogleGenAI } from "@google/genai";

/**
 * Single Gemini client wrapper. All calls funnel through here so we can apply a
 * lightweight concurrency gate + exponential backoff on 429/5xx, protecting the
 * free-tier rate limits.
 */
const globalForGenai = globalThis as unknown as { __nouraGenai?: GoogleGenAI };

export function genai(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  globalForGenai.__nouraGenai ??= new GoogleGenAI({ apiKey });
  return globalForGenai.__nouraGenai;
}

export const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash";
export const EMBED_MODEL = "text-embedding-004";

// --- minimal concurrency gate ---
let active = 0;
const MAX_CONCURRENT = 4;
const waiters: Array<() => void> = [];

async function acquire() {
  if (active < MAX_CONCURRENT) {
    active++;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  active++;
}
function release() {
  active--;
  waiters.shift()?.();
}

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  const msg = String((err as Error)?.message ?? "");
  return status === 429 || (status ?? 0) >= 500 || /429|rate|quota|unavailable/i.test(msg);
}

/** Run a Gemini call through the gate with exponential backoff retries. */
export async function withGemini<T>(fn: (ai: GoogleGenAI) => Promise<T>, retries = 3): Promise<T> {
  await acquire();
  try {
    let attempt = 0;
    for (;;) {
      try {
        return await fn(genai());
      } catch (err) {
        if (attempt >= retries || !isRetryable(err)) throw err;
        const delay = 2 ** attempt * 1000 + Math.random() * 400;
        await new Promise((r) => setTimeout(r, delay));
        attempt++;
      }
    }
  } finally {
    release();
  }
}
