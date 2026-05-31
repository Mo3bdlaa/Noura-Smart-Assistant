import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { moodSnapshots } from "@/lib/db/schema";
import type { MoodSnapshot } from "@/lib/mood/state";

// Don't record more than one snapshot per this window — keeps the table light and
// the chart readable (the mood story is "across the days", not "per message").
const MIN_GAP_MS = 60 * 60 * 1000; // 1 hour

/**
 * Capture the assistant's current mood into the timeline history, throttled so we
 * keep at most one point per hour. Safe to call on every (non-incognito) turn.
 */
export async function captureMood(assistantId: string, mood: MoodSnapshot, now = new Date()) {
  const [last] = await db
    .select({ capturedAt: moodSnapshots.capturedAt })
    .from(moodSnapshots)
    .where(eq(moodSnapshots.assistantId, assistantId))
    .orderBy(desc(moodSnapshots.capturedAt))
    .limit(1);
  if (last && now.getTime() - new Date(last.capturedAt).getTime() < MIN_GAP_MS) return;

  await db.insert(moodSnapshots).values({
    assistantId,
    happiness: mood.happiness,
    affection: mood.affection,
    annoyance: mood.annoyance,
    energy: mood.energy,
    capturedAt: now,
  });
}

export type MoodPoint = {
  at: string; // ISO
  happiness: number;
  affection: number;
  annoyance: number;
  energy: number;
};

/** The full mood history (oldest → newest) for charting. */
export async function moodHistory(assistantId: string): Promise<MoodPoint[]> {
  const rows = await db
    .select()
    .from(moodSnapshots)
    .where(eq(moodSnapshots.assistantId, assistantId))
    .orderBy(moodSnapshots.capturedAt);
  return rows.map((r) => ({
    at: new Date(r.capturedAt).toISOString(),
    happiness: r.happiness,
    affection: r.affection,
    annoyance: r.annoyance,
    energy: r.energy,
  }));
}
