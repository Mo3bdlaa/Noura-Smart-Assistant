import { EMBEDDING_DIM } from "@/lib/db/schema";
import { getClient, withLlm } from "./client";

/**
 * Task type is kept for API compatibility with the previous Gemini-native layer.
 * The OpenAI-compatible /embeddings endpoint doesn't take task types, so it's
 * accepted but ignored (retrieval still works well in practice).
 */
export type EmbedTask = "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT" | "SEMANTIC_SIMILARITY";

/** Embed a single string → vector. */
export async function embed(text: string, _taskType: EmbedTask = "RETRIEVAL_QUERY"): Promise<number[]> {
  const [v] = await embedBatch([text], _taskType);
  return v!;
}

/** Embed many strings in one request (batching to spare the rate limit). */
export async function embedBatch(
  texts: string[],
  _taskType: EmbedTask = "RETRIEVAL_DOCUMENT",
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const { client, config } = await getClient();
  // Pin output dims to the pgvector column size (models like gemini-embedding-001
  // and OpenAI's text-embedding-3-* support Matryoshka dimension truncation).
  const res = await withLlm(() =>
    client.embeddings.create({
      model: config.embedModel,
      input: texts,
      dimensions: EMBEDDING_DIM,
    }),
  );
  return res.data.map((d) => {
    const v = d.embedding as number[];
    if (v.length !== EMBEDDING_DIM) {
      // guard against a model whose dims don't match the pgvector column
      throw new Error(`Embedding dim ${v.length} != expected ${EMBEDDING_DIM}`);
    }
    return v;
  });
}
