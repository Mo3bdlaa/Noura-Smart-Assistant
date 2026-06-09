import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth/guard";
import { tenantForUser } from "@/lib/db/tenant";
import { db } from "@/lib/db/client";
import { assistants, users } from "@/lib/db/schema";
import { validateAssistantName } from "@/lib/assistant/naming";

const Body = z.object({
  displayName: z.string().trim().min(1).max(40).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  assistantName: z.string().trim().min(2).max(40).optional(),
  locale: z.enum(["ar", "en"]).optional(),
  appearance: z.string().trim().max(1500).optional(),
  voiceId: z.string().trim().max(100).optional(),
  avatarUrl: z.string().max(2_800_000).optional(), // data URL, downscaled client-side
  dials: z
    .object({
      playfulness: z.number().min(0).max(1),
      bluntness: z.number().min(0).max(1),
      warmth: z.number().min(0).max(1),
    })
    .partial()
    .optional(),
});

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function PATCH(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }
  const { displayName, timezone, assistantName, locale, appearance, voiceId, avatarUrl, dials } =
    parsed.data;

  if (timezone && !isValidTimezone(timezone)) {
    return NextResponse.json({ error: "منطقة زمنية غير معروفة" }, { status: 400 });
  }

  // Per-assistant profile fields (her look, voice, photo, personality dials).
  if (
    appearance !== undefined ||
    voiceId !== undefined ||
    avatarUrl !== undefined ||
    dials !== undefined
  ) {
    const ctx = await tenantForUser(user.id, user.role);
    const aUpdate: Partial<typeof assistants.$inferInsert> = {};
    if (appearance !== undefined) aUpdate.appearance = appearance || null;
    if (voiceId !== undefined) aUpdate.voiceId = voiceId || null;
    if (avatarUrl !== undefined) aUpdate.avatarUrl = avatarUrl || null;
    if (dials !== undefined) {
      const [a] = await db
        .select({ persona: assistants.persona })
        .from(assistants)
        .where(eq(assistants.id, ctx.assistantId))
        .limit(1);
      aUpdate.persona = { ...((a?.persona as Record<string, unknown>) ?? {}), ...dials };
    }
    await db.update(assistants).set(aUpdate).where(eq(assistants.id, ctx.assistantId));
  }

  if (assistantName) {
    const nameError = validateAssistantName(assistantName, user.role);
    if (nameError) return NextResponse.json({ error: nameError }, { status: 400 });
    const ctx = await tenantForUser(user.id, user.role);
    try {
      await db.update(assistants).set({ name: assistantName.trim() }).where(eq(assistants.id, ctx.assistantId));
    } catch (e) {
      if (/reserved_name/i.test(String((e as Error).message))) {
        return NextResponse.json({ error: 'اسم "نورا" محجوز بالفعل.' }, { status: 400 });
      }
      throw e;
    }
  }

  const userUpdate: Partial<typeof users.$inferInsert> = {};
  if (displayName !== undefined) userUpdate.displayName = displayName;
  if (timezone !== undefined) userUpdate.timezone = timezone;
  if (locale !== undefined) userUpdate.locale = locale;
  if (Object.keys(userUpdate).length) {
    await db.update(users).set(userUpdate).where(eq(users.id, user.id));
  }

  return NextResponse.json({ ok: true });
}
