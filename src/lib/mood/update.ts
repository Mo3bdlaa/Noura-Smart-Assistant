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
      ...next, // note: closeness is intentionally NOT in `next` — it never decays here
      reason,
      reasonSourceConversationId: keepReason
        ? (opts.reasonSourceConversationId ?? row.reasonSourceConversationId)
        : null,
      safetyOverride: d.safetyOverride ?? false,
      lastUpdatedAt: now,
    })
    .where(eq(moodState.assistantId, opts.assistantId));
}

/**
 * Nudge the long-term closeness bond. Called once per (non-incognito) exchange.
 * Grows slowly and with diminishing returns near 1, so depth is genuinely earned
 * over many warm interactions. A clearly warm turn grows it a bit more; a hurtful
 * one can chip it slightly. It is deliberately hard to move per turn.
 */
export async function bumpCloseness(opts: {
  assistantId: string;
  /** the turn's affection delta (-1..1), used to scale growth */
  affectionDelta?: number;
}) {
  const [row] = await db
    .select({ closeness: moodState.closeness })
    .from(moodState)
    .where(eq(moodState.assistantId, opts.assistantId))
    .limit(1);
  if (!row) return;

  const cur = row.closeness ?? 0.2;
  const aff = opts.affectionDelta ?? 0;
  const headroom = 1 - cur; // diminishing returns near 1
  let step = 0.006 * headroom; // slow climb over a few hundred warm turns
  if (aff > 0.05) step += 0.01 * headroom; // a warm exchange helps a little more
  if (aff < -0.15) step -= 0.015; // a genuinely hurtful turn sets it back slightly
  const nextCloseness = clamp01(cur + step);

  await db
    .update(moodState)
    .set({ closeness: nextCloseness })
    .where(eq(moodState.assistantId, opts.assistantId));
}
