import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { moodState } from "@/lib/db/schema";
import { decayMood } from "./decay";
import { ensureMood } from "./state";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export type MoodDelta = {
  happiness?: number;
  affection?: number;
  annoyance?: number;
  energy?: number;
  intensity?: number;
  reason?: string | null;
  safetyOverride?: boolean;
};

/**
 * Apply a per-turn mood delta on top of the (decayed) current state and persist.
 * Used for main/side conversations. NEVER called for incognito (sandboxed).
 */
export async function applyMoodDelta(opts: {
  assistantId: string;
  delta: MoodDelta;
  reasonSourceConversationId?: string;
  now?: Date;
}) {
  const now = opts.now ?? new Date();
  const row = await ensureMood(opts.assistantId);
  const base = decayMood(row, now);
  const d = opts.delta;

  const next = {
    happiness: clamp01(base.happiness + (d.happiness ?? 0)),
    affection: clamp01(base.affection + (d.affection ?? 0)),
    annoyance: clamp01(base.annoyance + (d.annoyance ?? 0)),
    energy: clamp01(base.energy + (d.energy ?? 0)),
    intensity: clamp01(base.intensity + (d.intensity ?? 0)),
  };

  // Keep a reason while she's still annoyed; clear it once she's calmed down.
  const keepReason = next.annoyance > 0.3;
  const reason =
    d.reason !== undefined ? d.reason : keepReason ? row.reason : null;

  await db
    .update(moodState)
    .set({
      ...next,
      reason,
      reasonSourceConversationId: keepReason
        ? (opts.reasonSourceConversationId ?? row.reasonSourceConversationId)
        : null,
      safetyOverride: d.safetyOverride ?? false,
      lastUpdatedAt: now,
    })
    .where(eq(moodState.assistantId, opts.assistantId));
}
