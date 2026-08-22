/**
 * The gate in front of private mode.
 *
 * Two independent conditions must both hold before the persona changes at all:
 *
 *   1. a persisted per-assistant toggle (survives restarts), and
 *   2. a sealed unlock cookie on THIS request (per browser, expires, revocable).
 *
 * Splitting them is the point: someone who picks up an already-signed-in phone
 * still gets the normal assistant unless that browser has been unlocked with the
 * passphrase, and "lock now" kills it instantly everywhere the cookie isn't set.
 * Server-side jobs have no cookie, so pushes and scheduled messages are never
 * affected.
 *
 * State lives in the `settings` key/value table rather than on the assistant row
 * so it can never ride along in a payload that gets serialised to the browser.
 */
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getSetting, setSetting } from "@/lib/settings";
import { coerceLevel, type NsfwLevel } from "./nsfw";

type UnlockData = { uid?: string };

const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const unlockOptions = {
  // Reuse the app secret (validated at import time by lib/auth/session).
  password: process.env.SESSION_SECRET as string,
  cookieName: "nx",
  ttl: MAX_AGE,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE,
  },
};

async function unlockSession() {
  return getIronSession<UnlockData>(await cookies(), unlockOptions);
}

/** Is THIS browser unlocked for this user? */
export async function isUnlocked(userId: string): Promise<boolean> {
  try {
    const s = await unlockSession();
    return s.uid === userId;
  } catch {
    return false;
  }
}

export async function setUnlocked(userId: string) {
  const s = await unlockSession();
  s.uid = userId;
  await s.save();
}

/** "Lock now" — drops the cookie for this browser only. */
export async function clearUnlock() {
  const s = await unlockSession();
  s.destroy();
}

const passKey = (userId: string) => `pm_pass:${userId}`;
const onKey = (assistantId: string) => `pm_on:${assistantId}`;
const levelKey = (assistantId: string) => `pm_level:${assistantId}`;

export async function hasPassphrase(userId: string): Promise<boolean> {
  return Boolean(await getSetting(passKey(userId)));
}

export async function setPassphrase(userId: string, plain: string) {
  await setSetting(passKey(userId), await hashPassword(plain));
}

export async function checkPassphrase(userId: string, plain: string): Promise<boolean> {
  const stored = await getSetting(passKey(userId));
  if (!stored) return false;
  return verifyPassword(stored, plain);
}

export type ModeState = { on: boolean; level: NsfwLevel };

export async function readMode(assistantId: string): Promise<ModeState> {
  const [on, level] = await Promise.all([getSetting(onKey(assistantId)), getSetting(levelKey(assistantId))]);
  return { on: on === "1", level: coerceLevel(level) };
}

export async function writeMode(assistantId: string, next: Partial<ModeState>) {
  if (next.on !== undefined) await setSetting(onKey(assistantId), next.on ? "1" : "0");
  if (next.level !== undefined) await setSetting(levelKey(assistantId), String(next.level));
}

/**
 * The only thing chat routes call: the active level for this request, or null.
 * Returns null unless the toggle is on AND this browser carries the unlock cookie.
 */
export async function nsfwForRequest(userId: string, assistantId: string): Promise<NsfwLevel | null> {
  if (!(await isUnlocked(userId))) return null;
  const { on, level } = await readMode(assistantId);
  return on ? level : null;
}
