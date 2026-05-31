import { getSetting } from "@/lib/settings";
import { getLlmConfig } from "./config";

/**
 * Provider-agnostic API-key pool. The app rotates across keys and "cools down" a
 * key for a minute when it returns a quota/rate-limit error, so a single key
 * hitting its limit doesn't break requests. Works for Gemini, OpenRouter, etc.
 *
 * NOTE: Gemini free-tier quota is per *project*, so multiple keys only help if
 * they come from different Google accounts/projects.
 */
export function splitKeys(s?: string | null): string[] {
  return (s ?? "")
    .split(/[\n,]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

/** All configured global keys: env LLM_API_KEYS + setting llm_api_keys + the single key. */
export async function getApiKeys(): Promise<string[]> {
  const fromEnv = splitKeys(process.env.LLM_API_KEYS);
  const fromSetting = splitKeys(await getSetting("llm_api_keys"));
  const single = (await getLlmConfig()).apiKey;
  const all = [...fromEnv, ...fromSetting, single].map((k) => k.trim()).filter(Boolean);
  return Array.from(new Set(all));
}

/** Keys for a given role — its own pool if set, otherwise the global pool. */
export async function getRoleKeys(role: "chat" | "utility" | "embed"): Promise<string[]> {
  const own = [
    ...splitKeys(process.env[`LLM_${role.toUpperCase()}_API_KEYS`]),
    ...splitKeys(await getSetting(`llm_${role}_api_keys`)),
  ];
  const uniq = Array.from(new Set(own.map((k) => k.trim()).filter(Boolean)));
  return uniq.length ? uniq : getApiKeys();
}

// --- rotation + cooldown state (per server instance) ---
const cooldowns = new Map<string, number>(); // key → epoch-ms until usable again
let rr = 0;

export function markCooling(key: string, ms = 60_000): void {
  cooldowns.set(key, Date.now() + ms);
}

/** Pick the next usable key (round-robin); if all are cooling, the soonest-free. */
export function pickKey(keys: string[]): string {
  if (keys.length === 0) throw new Error("No API keys configured");
  const now = Date.now();
  const available = keys.filter((k) => (cooldowns.get(k) ?? 0) <= now);
  if (available.length > 0) {
    const k = available[rr % available.length]!;
    rr = (rr + 1) % 1_000_000;
    return k;
  }
  return keys.reduce((best, k) => ((cooldowns.get(k) ?? 0) < (cooldowns.get(best) ?? 0) ? k : best), keys[0]!);
}
