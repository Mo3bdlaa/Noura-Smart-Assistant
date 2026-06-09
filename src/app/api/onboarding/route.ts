import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth/guard";
import { tenantForUser } from "@/lib/db/tenant";
import { db } from "@/lib/db/client";
import { assistants, users } from "@/lib/db/schema";
import { validateAssistantName } from "@/lib/assistant/naming";
import { GEMINI_VOICE_NAMES } from "@/lib/voice/gemini-voices";

const Body = z.object({
  assistantName: z.string().trim().min(2).max(40),
  appearance: z.string().trim().max(1500).optional(),
  voiceId: z.string().trim().max(60).optional(),
  language: z.enum(["en", "masri", "levantine", "khaliji", "maghrebi", "msa", "fr", "auto"]).optional(),
  dials: z
    .object({
      playfulness: z.number().min(0).max(1),
      bluntness: z.number().min(0).max(1),
      warmth: z.number().min(0).max(1),
    })
    .partial()
    .optional(),
});

/** Finish a new user's onboarding: name/look/voice/personality for their assistant. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  const { assistantName, appearance, voiceId, language, dials } = parsed.data;

  const nameError = validateAssistantName(assistantName, user.role);
  if (nameError) return NextResponse.json({ error: nameError }, { status: 400 });

  const ctx = await tenantForUser(user.id, user.role);
  const [a] = await db
    .select({ persona: assistants.persona })
    .from(assistants)
    .where(eq(assistants.id, ctx.assistantId))
    .limit(1);

  try {
    await db
      .update(assistants)
      .set({
        name: assistantName.trim(),
        appearance: appearance?.trim() || null,
        voiceId: voiceId && GEMINI_VOICE_NAMES.has(voiceId) ? voiceId : null,
        language: language ?? "en",
        persona: { ...((a?.persona as Record<string, unknown>) ?? {}), ...(dials ?? {}) },
      })
      .where(eq(assistants.id, ctx.assistantId));
  } catch (e) {
    if (/reserved_name/i.test(String((e as Error).message))) {
      return NextResponse.json({ error: 'اسم "نورا" محجوز.' }, { status: 400 });
    }
    throw e;
  }

  await db.update(users).set({ onboardedAt: new Date() }).where(eq(users.id, user.id));
  return NextResponse.json({ ok: true });
}
