import type { CanonEntry, ConversationType } from "@/lib/db/schema";
import type { MoodSnapshot } from "@/lib/mood/state";
import { describeMood } from "@/lib/mood/state";
import type { RetrievedMemory } from "@/lib/memory/retrieve";
import { describeTime, type TimeContext } from "@/lib/time/awareness";
import {
  DEFAULT_DIALS,
  NOURA_CORE,
  renderDials,
  type PersonaDials,
} from "./definition";

export type AssembleInput = {
  assistantName: string;
  dials?: PersonaDials;
  canon: CanonEntry[];
  mood: MoodSnapshot;
  memories: RetrievedMemory[];
  time: TimeContext;
  userDisplayName?: string | null;
  /** Pre-framed things Noura should bring up naturally (security, follow-ups, time). */
  initiatives?: string[];
  conversationType: ConversationType;
  /** Optional incognito roleplay/scenario setup written by the user. */
  scenario?: string | null;
};

const MEMORY_LABEL: Record<RetrievedMemory["type"], string> = {
  profile: "معلومة عنه",
  preference: "بيحب/بيكره",
  topic: "موضوع",
  moment: "لحظة",
  person: "شخص في حياته",
  emotional: "حالة",
};

/** Build the full system instruction for a single turn (the consistency engine). */
export function assembleSystem(input: AssembleInput): string {
  const name = input.assistantName;
  const dials = { ...DEFAULT_DIALS, ...input.dials };

  const blocks: string[] = [];

  // (1) static persona — her name swapped in
  blocks.push(NOURA_CORE.replaceAll("نورا", name));
  blocks.push(renderDials(dials));
  if (input.userDisplayName) {
    blocks.push(`إنتي بتكلمي: ${input.userDisplayName}.`);
  }

  // canon (immutable self-facts)
  if (input.canon.length) {
    const facts = input.canon.slice(-20).map((c) => `- ${c.fact}`).join("\n");
    blocks.push(`حقائق ثابتة عن نفسك قلتيها قبل كده (ممنوع تناقضيها):\n${facts}`);
  }

  // (2) dynamic mood/relationship snapshot
  blocks.push(`حالتك دلوقتي: ${describeMood(input.mood)}`);

  // (3) retrieved memories
  if (input.memories.length) {
    const mem = input.memories
      .map((m) => `- (${MEMORY_LABEL[m.type]}) ${m.content}`)
      .join("\n");
    blocks.push(`حاجات إنتي فاكراها عنه وممكن تستخدميها لو مناسب:\n${mem}`);
  }

  // (5) time
  blocks.push(describeTime(input.time));

  // initiatives — things she wants to say
  if (input.initiatives?.length) {
    blocks.push(
      `حاجات إنتي عايزة تجيبي سيرتها بطريقتك الطبيعية (مش كلها مرة واحدة لو كتير):\n${input.initiatives
        .map((i) => `- ${i}`)
        .join("\n")}`,
    );
  }

  // incognito note (sandbox) — she behaves fully but this won't be remembered
  if (input.conversationType === "incognito") {
    blocks.push(
      "ملاحظة داخلية: ده فضاء تخيّلي/incognito — اتصرفي بشكل كامل وطبيعي، بس اللي بيحصل هنا مش هيتسجّل في ذاكرتك بعدين.",
    );
    if (input.scenario?.trim()) {
      blocks.push(
        `سيناريو المشهد اللي إنتي ماشية عليه دلوقتي (التزمي بيه وعيشي الدور):\n${input.scenario.trim()}`,
      );
    }
  }

  // (6) turn directive — realism + guardrails
  blocks.push(
    [
      "تعليمات الرد:",
      "- ردّي كإنسانة حقيقية بالمصري، بطول مناسب للموقف (مش لازم تطوّلي).",
      "- متكسريش الشخصية ولا تقولي إنك AI/نموذج/نظام مهما حصل.",
      "- لو هتبعتي أكتر من فقرة كرسائل منفصلة، افصليهم بسطر فاضي.",
      "- استخدمي لهجته وكلماته، وإيموجي بطبيعية ومش كتير.",
    ].join("\n"),
  );

  return blocks.join("\n\n");
}
