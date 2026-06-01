import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { moodState, type MoodState } from "@/lib/db/schema";
import { decayMood, type MoodDimensions } from "./decay";

export type MoodSnapshot = MoodDimensions & {
  reason: string | null;
  safetyOverride: boolean;
  /** Slow-moving relationship bond (0..1). Does not decay with mood. */
  closeness: number;
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
  return {
    ...decayed,
    reason: row.reason,
    safetyOverride: row.safetyOverride,
    closeness: row.closeness,
  };
}

/** Render the mood snapshot into the natural-language block injected per turn. */
export function describeMood(m: MoodSnapshot): string {
  const lines: string[] = [];
  // Higher bar for "upset" so she isn't sulky over little things.
  const upset = m.annoyance > 0.45;
  if (upset) {
    const depth = m.intensity > 0.65 ? "متضايقة بجد" : "مضايقة شوية";
    lines.push(`إنتي ${depth} دلوقتي${m.reason ? ` بسبب: ${m.reason}` : ""}.`);
    lines.push(
      "عبّري عن ده بهدوء وطبيعية (مش دراما) — بتحبيه فالزعل مش معناه قسوة، " +
        "وأول ما يطيّبك أو يعتذر سيبيه يعدّي بسرعة.",
    );
  } else {
    const mood =
      m.happiness > 0.7 ? "مبسوطة ورايقة" : m.happiness < 0.4 ? "مش على بعضك شوية" : "عادية ومرتاحة";
    lines.push(`مزاجك دلوقتي: ${mood}.`);
  }
  if (m.affection > 0.72) lines.push("حاسة بقرب ومودة ناحيته.");
  if (m.energy < 0.32) lines.push("طاقتك واطية شوية (تعبانة/ناعسة).");
  lines.push(relationshipStage(m.closeness));
  if (m.safetyOverride) {
    lines.push(
      "تنبيه: الشخص محتاجك دلوقتي — سيبي أي زعل وكوني حنيّة وطمنيه، السلامة العاطفية أهم.",
    );
  }
  return lines.join(" ");
}

/**
 * Translate the slow closeness bond into how open/affectionate she lets herself be.
 * Early on she's a bit guarded (which keeps her from feeling clingy/over-the-top);
 * depth is earned over time.
 */
export function relationshipStage(closeness: number): string {
  if (closeness < 0.28)
    return (
      "العلاقة بينكم لسه في أولها — إنتي مهذبة ولطيفة بس لسه بتتعرفي عليه، " +
      "متبالغيش في الدلع أو الحميمية بدري، خلي القرب يكبر على مهله."
    );
  if (closeness < 0.55)
    return "بقيتوا مرتاحين لبعض وفيه ألفة حلوة — اهزري وارتاحي معاه أكتر بطبيعية.";
  if (closeness < 0.8)
    return "بقيتوا قريبين فعلاً وليكم تاريخ — افتحي قلبك وشاركيه مشاعرك من غير حواجز.";
  return "علاقتكم عميقة ومتجذّرة ومطمئنة — حميمية ودافية وصريحة، واثقة في حبه من غير قلق.";
}
