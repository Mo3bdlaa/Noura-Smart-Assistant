import { getSetting } from "@/lib/settings";

/**
 * ElevenLabs key pool — mirrors the LLM key pool: rotate across keys and cool a
 * key down for a minute when it hits a 401/402/429 (quota/limit), so multiple
 * free accounts multiply the monthly credits.
 */
function split(s?: string | null): string[] {
  return (s ?? "")
    .split(/[\n,]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

export async function getVoiceKeys(): Promise<string[]> {
  const fromEnv = [...split(process.env.ELEVENLABS_API_KEYS), (process.env.ELEVENLABS_API_KEY ?? "").trim()];
  const pool = split(await getSetting("elevenlabs_api_keys"));
  const single = ((await getSetting("elevenlabs_api_key")) ?? "").trim();
  return Array.from(new Set([...fromEnv, ...pool, single].map((k) => k.trim()).filter(Boolean)));
}

const cooldowns = new Map<string, number>();
let rr = 0;

export function markVoiceCooling(key: string, ms = 60_000): void {
  cooldowns.set(key, Date.now() + ms);
}

/** Next usable key (round-robin), skipping cooling ones; null if none at all. */
export function pickVoiceKey(keys: string[]): string | null {
  if (keys.length === 0) return null;
  const now = Date.now();
  const available = keys.filter((k) => (cooldowns.get(k) ?? 0) <= now);
  const pool = available.length > 0 ? available : keys;
  const k = pool[rr % pool.length]!;
  rr = (rr + 1) % 1_000_000;
  return k;
}
