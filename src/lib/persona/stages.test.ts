import { describe, expect, it } from "vitest";
import { progressiveStage, stageDirective, stageLabel } from "./stages";
import { coreFor } from "./definition";

describe("progressiveStage", () => {
  it("maps closeness onto the earned relationship ladder", () => {
    expect(progressiveStage(0)).toBe("secretary");
    expect(progressiveStage(0.21)).toBe("secretary");
    expect(progressiveStage(0.22)).toBe("friend");
    expect(progressiveStage(0.5)).toBe("close");
    expect(progressiveStage(0.7)).toBe("companion");
    expect(progressiveStage(0.9)).toBe("lover");
    expect(progressiveStage(1)).toBe("lover");
  });

  it("never skips a stage as closeness rises", () => {
    const order = ["secretary", "friend", "close", "companion", "lover"];
    let last = 0;
    for (let c = 0; c <= 1; c += 0.01) {
      const i = order.indexOf(progressiveStage(c));
      expect(i).toBeGreaterThanOrEqual(last);
      expect(i - last).toBeLessThanOrEqual(1);
      last = i;
    }
  });
});

describe("stageLabel", () => {
  it("is gendered", () => {
    expect(stageLabel("companion", "female")[0]).toBe("رفيقتك");
    expect(stageLabel("companion", "male")[0]).toBe("رفيقك");
  });
});

describe("stageDirective", () => {
  it("keeps the first stage strictly professional", () => {
    const d = stageDirective("secretary", "female");
    expect(d).toContain("مهنية");
    expect(d).not.toContain("رومانسي");
  });

  it("only allows real romance at the final stage", () => {
    expect(stageDirective("friend", "female")).toContain("مش عاطفية");
    expect(stageDirective("lover", "female")).toContain("حب");
  });

  it("uses masculine phrasing for a male assistant", () => {
    expect(stageDirective("secretary", "male")).toContain("إنت سكرتيره");
  });
});

describe("coreFor", () => {
  it("returns a distinct core per archetype", () => {
    const sec = coreFor("secretary", "female");
    const comp = coreFor("companion", "female");
    expect(sec).not.toBe(comp);
    // a fixed secretary must forbid romance outright…
    expect(sec).toContain("مش رومانسية خالص");
    // …while the progressive one defers to the stage directive instead
    expect(coreFor("progressive", "female")).not.toContain("مش رومانسية خالص");
  });

  it("never mixes feminine wording into the male cores", () => {
    for (const a of ["companion", "secretary", "progressive"]) {
      expect(coreFor(a, "male"), a).not.toContain("سكرتيرة");
    }
  });
});
