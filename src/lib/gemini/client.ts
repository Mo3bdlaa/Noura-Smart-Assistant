import { GoogleGenAI } from "@google/genai";
import { getGeminiKey } from "@/lib/settings";

/**
 * Single Gemini client wrapper. The API key is resolved from env first, otherwise
 * from the value entered via the first-run setup UI (DB settings). All calls funnel
 * through here so we can apply a concurrency gate + exponential backoff on 429/5xx.
 */
const globalForGenai = globalThis as unknown as { __nouraGenai?: GoogleGenAI; __nouraKey?: string };

export const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash";
export const EMBED_MODEL = "text-embedding-004";

async function resolveClient(): Promise<GoogleGenAI> {
  const key = await getGeminiKey();
  if (!key) throw new Error("GEMINI_API_KEY is not set (configure it in setup)");
  if (globalForGenai.__nouraKey !== key || !globalForGenai.__nouraGenai) {
    globalForGenai.__nouraGenai = new GoogleGenAI({ apiKey: key });
    globalForGenai.__nouraKey = key;
  }
  return globalForGenai.__nouraGenai;
}

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
    const ai = await resolveClient();
    let attempt = 0;
    for (;;) {
      try {
        return await fn(ai);
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
