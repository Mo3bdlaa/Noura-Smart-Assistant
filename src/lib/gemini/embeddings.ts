import { EMBEDDING_DIM } from "@/lib/db/schema";
import { EMBED_MODEL, withGemini } from "./client";

/**
 * text-embedding-004 supports task types that materially improve retrieval:
 * store memories as DOCUMENT, embed the incoming query as QUERY.
 */
export type EmbedTask = "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT" | "SEMANTIC_SIMILARITY";

/** Embed a single string → 768-dim vector. */
export async function embed(text: string, taskType: EmbedTask = "RETRIEVAL_QUERY"): Promise<number[]> {
  const [v] = await embedBatch([text], taskType);
  return v!;
}

/** Embed many strings in one request (batching to spare the rate limit). */
export async function embedBatch(
  texts: string[],
  taskType: EmbedTask = "RETRIEVAL_DOCUMENT",
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await withGemini((ai) =>
    ai.models.embedContent({
      model: EMBED_MODEL,
      contents: texts,
      config: { taskType },
    }),
  );
  const out = (res.embeddings ?? []).map((e) => e.values ?? []);
  for (const v of out) {
    if (v.length !== EMBEDDING_DIM) {
      throw new Error(`Embedding dim mismatch: got ${v.length}, expected ${EMBEDDING_DIM}`);
    }
  }
  return out;
}
