import { and, cosineDistance, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { assistants, memories, messages, type CanonEntry } from "@/lib/db/schema";
import { embed } from "@/lib/llm/embeddings";

/**
 * Delete a single message and (via ON DELETE CASCADE on memories.source_message_id)
 * everything Noura derived from it — true forgetting.
 */
export async function forgetMessage(userId: string, messageId: string) {
  await db.delete(messages).where(and(eq(messages.id, messageId), eq(messages.userId, userId)));
}

/** Delete a single memory directly (from the memory browser). */
export async function deleteMemory(userId: string, memoryId: string) {
  await db.delete(memories).where(and(eq(memories.id, memoryId), eq(memories.userId, userId)));
}

/**
 * Bulk forget by topic: semantic-match memories near a topic phrase, then delete
 * the memories AND their source messages so they don't get re-extracted.
 */
export async function forgetTopic(opts: {
  userId: string;
  assistantId: string;
  topic: string;
  threshold?: number; // cosine distance cutoff (lower = closer)
}) {
  const threshold = opts.threshold ?? 0.35;
  const vec = await embed(opts.topic, "RETRIEVAL_QUERY");
  const distance = cosineDistance(memories.embedding, vec);

  const matches = await db
    .select({ id: memories.id, sourceMessageId: memories.sourceMessageId, distance })
    .from(memories)
    .where(and(eq(memories.userId, opts.userId), eq(memories.assistantId, opts.assistantId)))
    .orderBy(distance)
    .limit(50);

  const hits = matches.filter((m) => Number(m.distance) <= threshold);

  // Canon (her self-facts) is separate from embedded memories — forgetting a topic
  // has to clear those too, or she keeps asserting facts about something the user
  // asked her to forget.
  const droppedCanon = await forgetCanonTopic(opts.assistantId, opts.topic);

  if (!hits.length) return { forgotten: droppedCanon };

  const sourceIds = [...new Set(hits.map((h) => h.sourceMessageId).filter(Boolean))] as string[];
  const memIds = hits.map((h) => h.id);

  // Deleting the source messages cascades to their memories; clean up any
  // memories without a source message directly.
  if (sourceIds.length) {
    await db.delete(messages).where(inArray(messages.id, sourceIds));
  }
  await db.delete(memories).where(inArray(memories.id, memIds));

  return { forgotten: hits.length + droppedCanon };
}

/** Drop self-facts whose text mentions any meaningful word of the topic. */
async function forgetCanonTopic(assistantId: string, topic: string): Promise<number> {
  const words = topic
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/^(ال|و|ب|لل)/, "").trim())
    .filter((w) => w.length >= 3);
  if (!words.length) return 0;
  try {
    const [row] = await db
      .select({ canon: assistants.canon })
      .from(assistants)
      .where(eq(assistants.id, assistantId))
      .limit(1);
    const canon = (row?.canon as CanonEntry[] | undefined) ?? [];
    if (!canon.length) return 0;
    const kept = canon.filter((c) => {
      const fact = (c.fact ?? "").toLowerCase();
      return !words.some((w) => fact.includes(w));
    });
    const dropped = canon.length - kept.length;
    if (dropped > 0) {
      await db.update(assistants).set({ canon: kept }).where(eq(assistants.id, assistantId));
    }
    return dropped;
  } catch {
    return 0;
  }
}
