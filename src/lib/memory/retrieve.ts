import { and, cosineDistance, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { memories, type Memory } from "@/lib/db/schema";
import { embed } from "@/lib/llm/embeddings";

export type RetrievedMemory = Pick<Memory, "id" | "type" | "content" | "importance"> & {
  score: number;
};

/**
 * Semantic recall scoped to (userId, assistantId): embed the incoming message as
 * a QUERY, cosine-search via the HNSW index, then re-rank by similarity × importance.
 * Always mixes in a few high-importance profile/person facts so she reliably
 * remembers names and key relationships even on tangential queries.
 */
export async function retrieveMemories(opts: {
  userId: string;
  assistantId: string;
  query: string;
  k?: number;
}): Promise<RetrievedMemory[]> {
  const k = opts.k ?? 8;
  const scope = and(eq(memories.userId, opts.userId), eq(memories.assistantId, opts.assistantId));

  const queryVec = await embed(opts.query, "RETRIEVAL_QUERY");
  const distance = cosineDistance(memories.embedding, queryVec);

  const candidates = await db
    .select({
      id: memories.id,
      type: memories.type,
      content: memories.content,
      importance: memories.importance,
      createdAt: memories.createdAt,
      distance,
    })
    .from(memories)
    .where(scope)
    .orderBy(distance)
    .limit(Math.max(k * 3, 20));

  // Always-on anchors: top profile/person facts.
  const anchors = await db
    .select({
      id: memories.id,
      type: memories.type,
      content: memories.content,
      importance: memories.importance,
    })
    .from(memories)
    .where(and(scope, or(eq(memories.type, "profile"), eq(memories.type, "person"))))
    .orderBy(desc(memories.importance))
    .limit(4);

  // Recency: a memory from this week should edge out an equally-relevant one from
  // months ago, without ever letting age alone beat relevance (0.85…1.15 nudge).
  const now = Date.now();
  const recencyBoost = (createdAt: unknown): number => {
    const t = createdAt ? new Date(createdAt as string).getTime() : 0;
    if (!t) return 1;
    const days = Math.max(0, (now - t) / 86_400_000);
    return 0.85 + 0.3 * Math.exp(-days / 45); // ~1.15 fresh → ~0.85 old
  };

  const scored = new Map<string, RetrievedMemory>();
  for (const c of candidates) {
    const similarity = 1 - Number(c.distance);
    scored.set(c.id, {
      id: c.id,
      type: c.type,
      content: c.content,
      importance: c.importance,
      score: similarity * (0.5 + 0.5 * c.importance) * recencyBoost(c.createdAt),
    });
  }
  for (const a of anchors) {
    if (!scored.has(a.id)) {
      scored.set(a.id, { ...a, score: 0.4 * (0.5 + 0.5 * a.importance) });
    }
  }

  const top = [...scored.values()].sort((x, y) => y.score - x.score).slice(0, k);

  if (top.length) {
    await db
      .update(memories)
      .set({ lastRecalledAt: new Date() })
      .where(
        inArray(
          memories.id,
          top.map((m) => m.id),
        ),
      );
  }
  return top;
}
