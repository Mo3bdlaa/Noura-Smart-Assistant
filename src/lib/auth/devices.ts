import { createHash, randomBytes } from "node:crypto";
import { and, count, eq, gt, or } from "drizzle-orm";
import { UAParser } from "ua-parser-js";
import { db } from "@/lib/db/client";
import { loginAttempts, trustedDevices } from "@/lib/db/schema";

/**
 * Device identity + login-attempt logging. These feed the *personified* security
 * flow: failed attempts and new-device sign-ins become pending initiatives that
 * Noura raises in her own voice (see src/lib/initiatives).
 */

/** Derive a stable-ish fingerprint from request headers (best-effort, not a security boundary). */
export function deviceFingerprint(headers: Headers): string {
  const ua = headers.get("user-agent") ?? "";
  const lang = headers.get("accept-language") ?? "";
  const ip = clientIp(headers);
  return createHash("sha256").update(`${ua}|${lang}|${ip}`).digest("hex").slice(0, 32);
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}

export function deviceLabel(headers: Headers): string {
  const parser = new UAParser(headers.get("user-agent") ?? "");
  const { browser, os } = parser.getResult();
  return [os.name, browser.name].filter(Boolean).join(" ") || "Unknown device";
}

export async function logLoginAttempt(opts: {
  userId?: string;
  emailTried: string;
  success: boolean;
  headers: Headers;
}) {
  await db.insert(loginAttempts).values({
    userId: opts.userId,
    emailTried: opts.emailTried,
    success: opts.success,
    ip: clientIp(opts.headers),
    deviceFingerprint: deviceFingerprint(opts.headers),
    userAgent: opts.headers.get("user-agent") ?? null,
  });
}

/**
 * Brute-force guard: number of failed login attempts from this IP or for this
 * email within the window. The login route blocks (429) past a threshold.
 */
export async function recentFailedAttempts(
  email: string,
  headers: Headers,
  windowMs = 10 * 60 * 1000,
): Promise<number> {
  const since = new Date(Date.now() - windowMs);
  const ip = clientIp(headers);
  const [row] = await db
    .select({ n: count() })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.success, false),
        gt(loginAttempts.createdAt, since),
        or(eq(loginAttempts.emailTried, email), eq(loginAttempts.ip, ip)),
      ),
    );
  return row?.n ?? 0;
}

/** Is this device already trusted for the user? */
export async function isTrustedDevice(userId: string, fingerprint: string): Promise<boolean> {
  const [row] = await db
    .select({ id: trustedDevices.id, trustedAt: trustedDevices.trustedAt })
    .from(trustedDevices)
    .where(and(eq(trustedDevices.userId, userId), eq(trustedDevices.fingerprint, fingerprint)))
    .limit(1);
  return Boolean(row?.trustedAt);
}

/** Mark a device trusted; returns the raw device token (store hashed). */
export async function trustDevice(userId: string, headers: Headers): Promise<string> {
  const fingerprint = deviceFingerprint(headers);
  const token = randomBytes(24).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();

  await db
    .insert(trustedDevices)
    .values({
      userId,
      fingerprint,
      label: deviceLabel(headers),
      tokenHash,
      trustedAt: now,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: [trustedDevices.userId, trustedDevices.fingerprint],
      set: { trustedAt: now, lastSeenAt: now, tokenHash, label: deviceLabel(headers) },
    });

  return token;
}

export async function touchDevice(userId: string, fingerprint: string) {
  await db
    .update(trustedDevices)
    .set({ lastSeenAt: new Date() })
    .where(and(eq(trustedDevices.userId, userId), eq(trustedDevices.fingerprint, fingerprint)));
}
