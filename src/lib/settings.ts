import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { settings, users } from "@/lib/db/schema";

/**
 * Runtime app settings stored in the DB (so keys entered via the first-run setup
 * UI persist without editing env files). Cached in-process with a short TTL so a
 * change made on one serverless instance (e.g. deleting a bad key) propagates to
 * other warm instances quickly instead of being pinned to a stale value forever.
 */
const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: string | null; exp: number }>();

export async function getSetting(key: string): Promise<string | null> {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).limit(1);
  const val = row?.value ?? null;
  cache.set(key, { value: val, exp: Date.now() + CACHE_TTL_MS });
  return val;
}

export async function setSetting(key: string, value: string) {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
  cache.set(key, { value, exp: Date.now() + CACHE_TTL_MS });
}

/** Gemini key: env wins (for ops), otherwise the value entered during setup. */
export async function getGeminiKey(): Promise<string | null> {
  const fromEnv = process.env.GEMINI_API_KEY;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return getSetting("gemini_api_key");
}

/** The app is "initialized" once an admin user exists. */
export async function isInitialized(): Promise<boolean> {
  const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
  return Boolean(admin);
}
