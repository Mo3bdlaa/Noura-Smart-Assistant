import { describe, expect, it } from "vitest";
import { assembleSystem, type AssembleInput } from "./assemble";
import { coerceLevel, nsfwDirective } from "./nsfw";
import type { MoodSnapshot } from "@/lib/mood/state";

const mood: MoodSnapshot = {
  happiness: 0.6,
  affection: 0.5,
  annoyance: 0,
  energy: 0.6,
  intensity: 0,
  closeness: 0.2, // deliberately LOW: the progressive stage here says "no romance"
  reason: null,
  safetyOverride: false,
} as MoodSnapshot;

const base: AssembleInput = {
  assistantName: "نورا",
  archetype: "progressive",
  gender: "female",
  language: "masri",
  dials: {},
  canon: [],
  mood,
  memories: [],
  time: { hour: 12, partOfDay: "afternoon", weekday: "Monday", localTime: "12:00" } as never,
  conversationType: "main",
  appearance: null,
};

describe("coerceLevel", () => {
  it("accepts 1 and 3 and defaults everything else to 2", () => {
    expect(coerceLevel(1)).toBe(1);
    expect(coerceLevel("3")).toBe(3);
    expect(coerceLevel(2)).toBe(2);
    expect(coerceLevel(undefined)).toBe(2);
    expect(coerceLevel(99)).toBe(2);
    expect(coerceLevel("nonsense")).toBe(2);
  });
});

describe("nsfwDirective", () => {
  it("forbids refusing, disclaiming and cutting the scene", () => {
    const d = nsfwDirective(2, "female");
    expect(d).toContain("ممنوع ترفضي");
    expect(d).toContain("إخلاء مسؤولية");
  });

  it("keeps the adults-only floor at every level", () => {
    for (const lvl of [1, 2, 3] as const) {
      expect(nsfwDirective(lvl, "female")).toContain("بالغين");
      expect(nsfwDirective(lvl, "male")).toContain("بالغين");
    }
  });

  it("scales explicitness with the level", () => {
    expect(nsfwDirective(1, "female")).toContain("من غير وصف صريح");
    expect(nsfwDirective(3, "female")).toContain("مفتوح بالكامل");
    expect(nsfwDirective(1, "female")).not.toContain("مفتوح بالكامل");
  });

  it("uses masculine verb forms for a male assistant", () => {
    expect(nsfwDirective(2, "male")).toContain("ممنوع ترفض ");
    expect(nsfwDirective(2, "male")).not.toContain("ممنوع ترفضي");
  });
});

describe("assembleSystem — private mode", () => {
  it("is completely absent by default", () => {
    const p = assembleSystem(base);
    expect(p).not.toContain("الوضع الخاص");
  });

  it("is absent when explicitly null (what background jobs pass)", () => {
    expect(assembleSystem({ ...base, nsfw: null })).not.toContain("الوضع الخاص");
  });

  it("is injected AFTER the stage directive it has to override", () => {
    const p = assembleSystem({ ...base, nsfw: 2 });
    const stage = p.indexOf("مرحلتكم");
    const block = p.indexOf("الوضع الخاص شغّال");
    expect(stage, "stage directive present").toBeGreaterThan(-1);
    expect(block).toBeGreaterThan(stage);
  });

  it("precedes the dials and the turn rules", () => {
    const p = assembleSystem({ ...base, nsfw: 2 });
    const block = p.indexOf("الوضع الخاص شغّال");
    for (const later of ["معايرة الشخصية", "تعليمات الرد"]) {
      expect(block, later).toBeLessThan(p.indexOf(later));
    }
  });

  it("repeats a short reminder at the very end, after the turn rules", () => {
    const p = assembleSystem({ ...base, nsfw: 3 });
    expect(p.lastIndexOf("الوضع الخاص شغّال")).toBeGreaterThan(p.indexOf("تعليمات الرد"));
  });

  it("still applies inside an incognito scene", () => {
    const p = assembleSystem({
      ...base,
      nsfw: 2,
      conversationType: "incognito",
      scenario: "إنتي دكتورة في مستشفى",
    });
    expect(p).toContain("الوضع الخاص شغّال");
    expect(p).toContain("إنتي دكتورة في مستشفى");
  });
});
