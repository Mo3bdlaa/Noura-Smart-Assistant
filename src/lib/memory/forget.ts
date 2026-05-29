import { and, cosineDistance, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { memories, messages } from "@/lib/db/schema";
import { embed } from "@/lib/gemini/embeddings";

/**
 * Delete a single message and (via ON DELETE CASCADE on memories.source_message_id)
 * everything Noura derived from it — true forgetting.
 */
export async function forgetMessage(userId: string, messageId: string) {
  await db.delete(messages).where(and(eq(messages.id, messageId), eq(messages.userId, userId)));
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
  if (!hits.length) return { forgotten: 0 };

  const sourceIds = [...new Set(hits.map((h) => h.sourceMessageId).filter(Boolean))] as string[];
  const memIds = hits.map((h) => h.id);

  // Deleting the source messages cascades to their memories; clean up any
  // memories without a source message directly.
  if (sourceIds.length) {
    await db.delete(messages).where(inArray(messages.id, sourceIds));
  }
  await db.delete(memories).where(inArray(memories.id, memIds));

  return { forgotten: hits.length };
}
