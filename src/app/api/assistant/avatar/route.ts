import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { assistants } from "@/lib/db/schema";
import { AuthError, requireTenant } from "@/lib/auth/guard";
import { setAssistantAvatar, setAssistantAppearance } from "@/lib/assistant/store";
import { describeAppearance } from "@/lib/assistant/appearance";

// Multimodal describe can take a moment.
export const maxDuration = 60;

// ~5MB data URL ceiling (client downscales avatars well below this).
const PostBody = z.object({
  avatar: z.string().startsWith("data:image/").max(5_000_000),
});
const PatchBody = z.object({ appearance: z.string().max(4000) });

/** Set a new profile photo and auto-derive how she looks (self-awareness). */
export async function POST(req: Request) {
  let user, ctx;
  try {
    ({ user, ctx } = await requireTenant());
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }

  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "صورة غير صالحة" }, { status: 400 });

  const [a] = await db
    .select({ name: assistants.name })
    .from(assistants)
    .where(eq(assistants.id, ctx.assistantId))
    .limit(1);

  // Try to describe her new look; never fail the upload if vision is busy.
  let appearance: string | undefined;
  try {
    const desc = await describeAppearance(parsed.data.avatar, a?.name ?? "نورا", user.locale);
    if (desc) appearance = desc;
  } catch (e) {
    console.error("appearance describe failed", e);
  }

  await setAssistantAvatar(ctx, parsed.data.avatar, appearance);
  return NextResponse.json({ ok: true, appearance: appearance ?? null });
}

/** Manually edit the description of how she looks. */
export async function PATCH(req: Request) {
  try {
    const { ctx } = await requireTenant();
    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    await setAssistantAppearance(ctx, parsed.data.appearance.trim() || null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}

/** Remove her photo (keeps any appearance note). */
export async function DELETE() {
  try {
    const { ctx } = await requireTenant();
    await setAssistantAvatar(ctx, null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}
