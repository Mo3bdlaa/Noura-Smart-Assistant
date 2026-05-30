import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/login";
import {
  deviceFingerprint,
  isTrustedDevice,
  logLoginAttempt,
  recentFailedAttempts,
} from "@/lib/auth/devices";

const MAX_FAILED = 8; // failed attempts per email/IP within the window before throttling

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();

  // Brute-force guard: throttle once too many recent failures pile up.
  if ((await recentFailedAttempts(email, req.headers)) >= MAX_FAILED) {
    return NextResponse.json(
      { error: "محاولات كتير أوي. استنى شوية وجرّب تاني." },
      { status: 429 },
    );
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Uniform handling so we don't reveal whether the email exists.
  const ok = user ? await verifyPassword(user.passwordHash, parsed.data.password) : false;

  await logLoginAttempt({
    userId: user?.id,
    emailTried: email,
    success: ok,
    headers: req.headers,
  });

  if (!user || !ok) {
    return NextResponse.json({ error: "الإيميل أو الباسورد غلط." }, { status: 401 });
  }
  if (user.isLocked) {
    return NextResponse.json({ error: "الحساب مقفول." }, { status: 423 });
  }

  const trusted = await isTrustedDevice(user.id, deviceFingerprint(req.headers));
  await startSession({ userId: user.id, role: user.role });

  return NextResponse.json({ ok: true, newDevice: !trusted });
}
