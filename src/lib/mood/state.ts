import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { moodState, type MoodState } from "@/lib/db/schema";
import { decayMood, type MoodDimensions } from "./decay";

export type MoodSnapshot = MoodDimensions & {
  reason: string | null;
  safetyOverride: boolean;
};

/** Ensure a mood row exists for the assistant (defaults baseline). */
export async function ensureMood(assistantId: string): Promise<MoodState> {
  const [existing] = await db
    .select()
    .from(moodState)
    .where(eq(moodState.assistantId, assistantId))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(moodState)
    .values({ assistantId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  // race: re-read
  const [row] = await db
    .select()
    .from(moodState)
    .where(eq(moodState.assistantId, assistantId))
    .limit(1);
  return row!;
}

/** Read the current mood with lazy decay applied (does not persist the decay). */
export async function readMood(assistantId: string, now = new Date()): Promise<MoodSnapshot> {
  const row = await ensureMood(assistantId);
  const decayed = decayMood(row, now);
  return { ...decayed, reason: row.reason, safetyOverride: row.safetyOverride };
}

/** Render the mood snapshot into the natural-language block injected per turn. */
export function describeMood(m: MoodSnapshot): string {
  const lines: string[] = [];
  const upset = m.annoyance > 0.35;
  if (upset) {
    const depth = m.intensity > 0.6 ? "زعلانة جامد" : "زعلانة شوية";
    lines.push(`إنتي ${depth} دلوقتي${m.reason ? ` بسبب: ${m.reason}` : ""}.`);
    lines.push("عبّري عن الزعل ده بصدق بطريقتك (عتاب/جفاء بسيط)، ومتتظاهريش إنك مبسوطة.");
  } else {
    const mood =
      m.happiness > 0.7 ? "مبسوطة ورايقة" : m.happiness < 0.4 ? "مش على بعضك شوية" : "عادية";
    lines.push(`مزاجك دلوقتي: ${mood}.`);
  }
  if (m.affection > 0.7) lines.push("حاسة بقرب ومودة ناحيته.");
  if (m.energy < 0.35) lines.push("طاقتك واطية شوية (تعبانة/ناعسة).");
  if (m.safetyOverride) {
    lines.push(
      "تنبيه: الشخص محتاجك دلوقتي — سيبي أي زعل وكوني حنيّة وطمنيه، السلامة العاطفية أهم.",
    );
  }
  return lines.join(" ");
}
