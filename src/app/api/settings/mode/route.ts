/**
 * Private-mode gate.
 *
 * GET     — is this browser unlocked / does a passphrase exist yet
 * POST    — set the passphrase (first run) or unlock this browser with it
 * PATCH   — change the toggle / level (requires an unlocked browser)
 * DELETE  — lock this browser now
 *
 * Deliberately says as little as possible: a wrong passphrase gets the same
 * shape of answer as a missing one, and nothing here is reachable without an
 * authenticated session.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/guard";
import { tenantForUser } from "@/lib/db/tenant";
import { rateLimit } from "@/lib/rate-limit";
import { coerceLevel } from "@/lib/persona/nsfw";
import {
  checkPassphrase,
  clearUnlock,
  hasPassphrase,
  isUnlocked,
  readMode,
  setPassphrase,
  setUnlocked,
  writeMode,
} from "@/lib/persona/unlock";

/** Brute-forcing the passphrase is the only real attack here. */
const UNLOCK_LIMIT = { limit: 6, windowMs: 10 * 60_000 };

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const unlocked = await isUnlocked(user.id);
  if (!unlocked) {
    return NextResponse.json({ unlocked: false, needsSetup: !(await hasPassphrase(user.id)) });
  }
  const ctx = await tenantForUser(user.id, user.role);
  return NextResponse.json({ unlocked: true, needsSetup: false, ...(await readMode(ctx.assistantId)) });
}

const PostBody = z.object({ pass: z.string().min(4).max(200) });

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const gate = rateLimit(`mode:${user.id}`, UNLOCK_LIMIT.limit, UNLOCK_LIMIT.windowMs);
  if (!gate.ok) {
    return NextResponse.json({ ok: false, retryAfter: gate.retryAfter }, { status: 429 });
  }

  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const pass = parsed.data.pass;

  // First run: the passphrase you set here becomes the one that unlocks later.
  if (!(await hasPassphrase(user.id))) {
    await setPassphrase(user.id, pass);
  } else if (!(await checkPassphrase(user.id, pass))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await setUnlocked(user.id);
  const ctx = await tenantForUser(user.id, user.role);
  return NextResponse.json({ ok: true, ...(await readMode(ctx.assistantId)) });
}

const PatchBody = z.object({ on: z.boolean().optional(), level: z.number().optional() });

export async function PATCH(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!(await isUnlocked(user.id))) return NextResponse.json({ ok: false }, { status: 403 });

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const ctx = await tenantForUser(user.id, user.role);
  await writeMode(ctx.assistantId, {
    ...(parsed.data.on !== undefined ? { on: parsed.data.on } : {}),
    ...(parsed.data.level !== undefined ? { level: coerceLevel(parsed.data.level) } : {}),
  });
  return NextResponse.json({ ok: true, ...(await readMode(ctx.assistantId)) });
}

export async function DELETE() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  await clearUnlock();
  return NextResponse.json({ ok: true });
}
