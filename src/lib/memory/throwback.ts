import { and, eq, gte, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { memories } from "@/lib/db/schema";

const RECALL_COOLDOWN_DAYS = 7;

/**
 * Pick an older, meaningful memory she hasn't brought up recently — so she can
 * spontaneously reminisce ("افتكرت إنك..."), unprompted by the current topic.
 * Marks it recalled so the same memory doesn't resurface for a while. Returns the
 * distilled content, or null when there's nothing worth resurfacing yet.
 */
export async function pickThrowback(opts: {
  userId: string;
  assistantId: string;
  now?: Date;
}): Promise<string | null> {
  const now = opts.now ?? new Date();
  const cooldownCutoff = new Date(now.getTime() - RECALL_COOLDOWN_DAYS * 86_400_000);
  const freshCutoff = new Date(now.getTime() - 12 * 3_600_000); // at least ~12h old (not "just said")

  const [row] = await db
    .select({ id: memories.id, content: memories.content })
    .from(memories)
    .where(
      and(
        eq(memories.userId, opts.userId),
        eq(memories.assistantId, opts.assistantId),
        // meaningful, lasting kinds — skip transient "topic" chatter
        sql`${memories.type} in ('profile','preference','moment','person','emotional')`,
        gte(memories.importance, 0.55),
        lt(memories.createdAt, freshCutoff),
        or(isNull(memories.lastRecalledAt), lt(memories.lastRecalledAt, cooldownCutoff)),
      ),
    )
    // a touch of randomness, but lean on the more important/fond ones
    .orderBy(sql`${memories.importance} * 0.6 + random() * 0.4 desc`)
    .limit(1);

  if (!row) return null;

  await db.update(memories).set({ lastRecalledAt: now }).where(eq(memories.id, row.id));
  return row.content;
}
