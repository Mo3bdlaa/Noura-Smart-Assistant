import { describe, expect, it } from "vitest";
import { assembleSystem, type AssembleInput } from "./assemble";
import type { MoodSnapshot } from "@/lib/mood/state";

const mood: MoodSnapshot = {
  happiness: 0.6,
  affection: 0.5,
  annoyance: 0,
  energy: 0.6,
  intensity: 0,
  closeness: 0.5,
  reason: null,
  safetyOverride: false,
} as MoodSnapshot;

const base: AssembleInput = {
  assistantName: "نورا",
  archetype: "progressive",
  gender: "female",
  language: "masri",
  dials: {},
  canon: [{ fact: "بحب القهوة سادة", statedAt: new Date().toISOString(), sourceMessageId: "m1" }],
  mood,
  memories: [],
  time: { hour: 12, partOfDay: "afternoon", weekday: "Monday", localTime: "12:00" } as never,
  conversationType: "main",
  appearance: null,
};

const SCENE = "إنتي دكتورة في مستشفى، وأنا مريض جاي الكشف";

describe("assembleSystem — incognito scenario", () => {
  it("states the scene BEFORE anything that could contradict it (the reported bug)", () => {
    const p = assembleSystem({ ...base, conversationType: "incognito", scenario: SCENE });
    const scenePos = p.indexOf(SCENE);
    expect(scenePos).toBeGreaterThan(-1);
    // it used to sit at the very end, after every "you are a secretary" block.
    // Now it must precede the dials, the remembered facts and the turn rules.
    for (const later of ["معايرة الشخصية", "حاجات قلتيها عن نفسك", "تعليمات الرد"]) {
      const pos = p.indexOf(later);
      expect(pos, later).toBeGreaterThan(-1);
      expect(scenePos, later).toBeLessThan(pos);
    }
  });

  it("states that the scene overrides her default job", () => {
    const p = assembleSystem({ ...base, conversationType: "incognito", scenario: SCENE });
    expect(p).toContain("بتلغي دورك الافتراضي");
  });

  it("drops the secretary tooling and worklist inside a scene", () => {
    const p = assembleSystem({
      ...base,
      conversationType: "incognito",
      scenario: SCENE,
      secretary: "مهام مفتوحة عليه:\n- يشتري لبن",
    });
    expect(p).not.toContain("أدواتك كسكرتيرة");
    expect(p).not.toContain("يشتري لبن");
  });

  it("drops the earned relationship stage inside a scene", () => {
    const p = assembleSystem({ ...base, conversationType: "incognito", scenario: SCENE });
    expect(p).not.toContain("مرحلة العلاقة دلوقتي");
  });

  it("stops treating old self-facts as unbreakable during a scene", () => {
    const p = assembleSystem({ ...base, conversationType: "incognito", scenario: SCENE });
    expect(p).not.toContain("ممنوع تناقضيها");
    expect(p).toContain("بحب القهوة سادة"); // still there for flavour
  });

  it("leaves normal chats completely unchanged", () => {
    const p = assembleSystem(base);
    expect(p).toContain("أدواتك كسكرتيرة");
    expect(p).toContain("مرحلة العلاقة دلوقتي");
    expect(p).toContain("ممنوع تناقضيها");
  });

  it("keeps incognito-without-a-scene behaving like a normal chat", () => {
    const p = assembleSystem({ ...base, conversationType: "incognito" });
    expect(p).toContain("أدواتك كسكرتيرة");
    expect(p).toContain("فضاء تخيّلي");
  });
});
