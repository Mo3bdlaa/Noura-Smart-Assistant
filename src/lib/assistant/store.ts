import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { assistants } from "@/lib/db/schema";
import type { TenantContext } from "@/lib/db/tenant";

/** Name + photo + self-image of an assistant. */
export async function getAssistantProfile(assistantId: string) {
  const [a] = await db
    .select({
      name: assistants.name,
      avatarUrl: assistants.avatarUrl,
      appearance: assistants.appearance,
    })
    .from(assistants)
    .where(eq(assistants.id, assistantId))
    .limit(1);
  return a ?? null;
}

/** Set (or clear) her profile photo, optionally with a fresh appearance note. */
export async function setAssistantAvatar(
  ctx: TenantContext,
  avatarUrl: string | null,
  appearance?: string | null,
) {
  const patch: { avatarUrl: string | null; appearance?: string | null } = { avatarUrl };
  if (appearance !== undefined) patch.appearance = appearance;
  await db.update(assistants).set(patch).where(eq(assistants.id, ctx.assistantId));
}

/** Edit only the textual description of how she looks. */
export async function setAssistantAppearance(ctx: TenantContext, appearance: string | null) {
  await db
    .update(assistants)
    .set({ appearance })
    .where(eq(assistants.id, ctx.assistantId));
}
