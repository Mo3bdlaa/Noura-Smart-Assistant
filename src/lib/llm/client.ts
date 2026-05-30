import OpenAI from "openai";
import { getLlmConfig, type LlmConfig } from "./config";

/**
 * Single OpenAI-compatible client. Cached by (baseURL + key) so changing the
 * provider in settings transparently swaps the client. All calls funnel through
 * `withLlm` for a concurrency gate + exponential backoff on 429/5xx.
 */
const g = globalThis as unknown as { __nouraLlm?: OpenAI; __nouraLlmKey?: string };

export async function getClient(): Promise<{ client: OpenAI; config: LlmConfig }> {
  const config = await getLlmConfig();
  if (!config.apiKey) throw new Error("LLM API key is not set (configure it in setup)");
  const cacheKey = `${config.baseURL}|${config.apiKey}`;
  if (g.__nouraLlmKey !== cacheKey || !g.__nouraLlm) {
    g.__nouraLlm = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
    g.__nouraLlmKey = cacheKey;
  }
  return { client: g.__nouraLlm, config };
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
  return status === 429 || (status ?? 0) >= 500 || /429|rate|quota|unavailable|overloaded/i.test(msg);
}

/** Run an LLM call through the gate with exponential backoff retries. */
export async function withLlm<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  await acquire();
  try {
    let attempt = 0;
    for (;;) {
      try {
        return await fn();
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
