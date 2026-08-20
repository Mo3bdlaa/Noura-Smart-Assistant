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
export type MoodVoice = { gender?: "female" | "male"; archetype?: string };

/**
 * Describe her current state for the prompt — phrased for her actual gender, and
 * only pushing relationship warmth that her archetype allows. A secretary must not
 * be told to "open her heart"; a progressive assistant gets its relationship register
 * from the stage directive instead, so we don't inject a second (contradicting) one.
 */
export function describeMood(m: MoodSnapshot, v: MoodVoice = {}): string {
  const male = v.gender === "male";
  const f = (fem: string, masc: string) => (male ? masc : fem);
  const lines: string[] = [];
  // Higher bar for "upset" so she isn't sulky over little things.
  const upset = m.annoyance > 0.45;
  if (upset) {
    const depth = m.intensity > 0.65 ? f("متضايقة بجد", "متضايق بجد") : f("مضايقة شوية", "مضايق شوية");
    lines.push(`${f("إنتي", "إنت")} ${depth} دلوقتي${m.reason ? ` بسبب: ${m.reason}` : ""}.`);
    lines.push(
      f(
        "عبّري عن ده بهدوء وطبيعية (مش دراما)، وأول ما يطيّبك أو يعتذر سيبيه يعدّي بسرعة.",
        "عبّر عن ده بهدوء وطبيعية (مش دراما)، وأول ما يطيّبك أو يعتذر سيبه يعدّي بسرعة.",
      ),
    );
  } else {
    const mood =
      m.happiness > 0.7
        ? f("مبسوطة ورايقة", "مبسوط ورايق")
        : m.happiness < 0.4
          ? f("مش على بعضك شوية", "مش على بعضك شوية")
          : f("عادية ومرتاحة", "عادي ومرتاح");
    lines.push(`مزاجك دلوقتي: ${mood}.`);
  }
  if (m.affection > 0.72 && v.archetype !== "secretary") {
    lines.push(f("حاسة بقرب ومودة ناحيته.", "حاسس بقرب ومودة ناحيته."));
  }
  if (m.energy < 0.32) lines.push(f("طاقتك واطية شوية (تعبانة/ناعسة).", "طاقتك واطية شوية (تعبان/نعسان)."));

  // Relationship register: progressive gets it from its stage directive (avoid
  // contradicting instructions); secretary stays professional; companion warms up.
  if (v.archetype === "companion" || v.archetype === undefined) {
    lines.push(relationshipStage(m.closeness, v.gender));
  } else if (v.archetype === "secretary") {
    lines.push(
      m.closeness < 0.4
        ? f("لسه بتتعرفوا على بعض في الشغل — ودودة ومهنية.", "لسه بتتعرفوا على بعض في الشغل — ودود ومهني.")
        : f("بقيتوا مرتاحين لبعض وفيه ألفة زمالة حلوة — من غير رومانسية.", "بقيتوا مرتاحين لبعض وفيه ألفة زمالة حلوة — من غير رومانسية."),
    );
  }

  if (m.safetyOverride) {
    lines.push(
      f(
        "تنبيه: الشخص محتاجك دلوقتي — سيبي أي زعل وكوني حنيّة وطمنيه، السلامة العاطفية أهم.",
        "تنبيه: الشخص محتاجك دلوقتي — سيب أي زعل وكن حنين وطمنه، السلامة العاطفية أهم.",
      ),
    );
  }
  return lines.join(" ");
}

/**
 * Translate the slow closeness bond into how open/affectionate they let themselves
 * be. Only used for the `companion` archetype — depth is earned over time.
 */
export function relationshipStage(closeness: number, gender?: "female" | "male"): string {
  const male = gender === "male";
  const f = (fem: string, masc: string) => (male ? masc : fem);
  if (closeness < 0.28)
    return f(
      "العلاقة بينكم لسه في أولها — إنتي مهذبة ولطيفة بس لسه بتتعرفي عليه، متبالغيش في الدلع أو الحميمية بدري.",
      "العلاقة بينكم لسه في أولها — إنت مهذب ولطيف بس لسه بتتعرف عليه، متبالغش في الدلع أو الحميمية بدري.",
    );
  if (closeness < 0.55)
    return f(
      "بقيتوا مرتاحين لبعض وفيه ألفة حلوة — اهزري وارتاحي معاه أكتر بطبيعية.",
      "بقيتوا مرتاحين لبعض وفيه ألفة حلوة — اهزر وارتاح معاه أكتر بطبيعية.",
    );
  if (closeness < 0.8)
    return f(
      "بقيتوا قريبين فعلاً وليكم تاريخ — افتحي قلبك وشاركيه مشاعرك من غير حواجز.",
      "بقيتوا قريبين فعلاً وليكم تاريخ — افتح قلبك وشاركه مشاعرك من غير حواجز.",
    );
  return "علاقتكم عميقة ومتجذّرة ومطمئنة — حميمية ودافية وصريحة من غير قلق.";
}
