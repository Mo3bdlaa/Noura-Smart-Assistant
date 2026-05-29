import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { jobs } from "@/lib/db/schema";
import { processExchange } from "@/lib/memory/extract";

export type ExtractMemoryPayload = {
  assistantId: string;
  userId: string;
  conversationId: string;
  userMessageId: string;
  userText: string;
  assistantText: string;
  persistMemory: boolean;
  mutateMood: boolean;
};

/** Enqueue async memory extraction for one exchange. */
export async function enqueueExtract(payload: ExtractMemoryPayload) {
  await db.insert(jobs).values({ kind: "extract_memory", payload });
}

/** Process pending jobs (called from `after()` post-response and from cron). */
export async function drainJobs(max = 10): Promise<number> {
  let processed = 0;
  for (let i = 0; i < max; i++) {
    // Claim one pending job atomically.
    const [claimed] = await db
      .update(jobs)
      .set({ status: "running", attempts: sqlInc() })
      .where(
        and(
          eq(jobs.id, sqlNextPendingId()),
        ),
      )
      .returning();
    if (!claimed) break;

    try {
      if (claimed.kind === "extract_memory") {
        await processExchange(claimed.payload as ExtractMemoryPayload);
      }
      await db.update(jobs).set({ status: "done" }).where(eq(jobs.id, claimed.id));
      processed++;
    } catch (err) {
      const failed = claimed.attempts >= 3;
      await db
        .update(jobs)
        .set({
          status: failed ? "failed" : "pending",
          lastError: String((err as Error)?.message ?? err).slice(0, 500),
        })
        .where(eq(jobs.id, claimed.id));
    }
  }
  return processed;
}

// --- helpers (kept simple; single-process worker) ---
function sqlInc() {
  return sql`${jobs.attempts} + 1`;
}
function sqlNextPendingId() {
  return sql`(select id from ${jobs} where status = 'pending' order by created_at asc limit 1)`;
}

/** Convenience for clearing old finished jobs (optional maintenance). */
export async function pruneJobs(olderThan: Date) {
  await db.delete(jobs).where(and(eq(jobs.status, "done"), lt(jobs.createdAt, olderThan)));
}
