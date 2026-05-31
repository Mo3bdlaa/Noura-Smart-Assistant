import OpenAI from "openai";
import { markCooling, pickKey } from "./keys";
import { isQuotaError } from "./errors";

/**
 * OpenAI-compatible clients, cached per (baseURL + key) so a key pool can swap
 * keys transparently. All calls funnel through `withLlmKeyed` for a concurrency
 * gate + key rotation on quota errors + exponential backoff on 5xx.
 */
const g = globalThis as unknown as { __nouraLlmClients?: Map<string, OpenAI> };
const clients = (g.__nouraLlmClients ??= new Map<string, OpenAI>());

export function getClient(key: string, baseURL: string): OpenAI {
  if (!key) throw new Error("LLM API key is not set (configure it in setup)");
  const cacheKey = `${baseURL}|${key}`;
  let client = clients.get(cacheKey);
  if (!client) {
    client = new OpenAI({ apiKey: key, baseURL });
    clients.set(cacheKey, client);
  }
  return client;
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run an LLM call with a key from the given pool. On a quota error the key is
 * cooled down and the next key is tried immediately; other transient errors
 * back off.
 */
export async function withLlmKeyed<T>(keys: string[], fn: (key: string) => Promise<T>): Promise<T> {
  if (keys.length === 0) throw new Error("LLM API key is not set (configure it in setup)");
  await acquire();
  try {
    const maxAttempts = keys.length + 3;
    let backoff = 0;
    let lastErr: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const key = pickKey(keys);
      try {
        return await fn(key);
      } catch (err) {
        lastErr = err;
        if (isQuotaError(err)) {
          markCooling(key); // rotate to a different key right away
          continue;
        }
        if (isRetryable(err)) {
          await sleep(2 ** backoff * 1000 + Math.random() * 400);
          backoff++;
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  } finally {
    release();
  }
}
