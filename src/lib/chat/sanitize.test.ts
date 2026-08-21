import { describe, expect, it } from "vitest";
import { hasVoiceTag, stripControlTags } from "./sanitize";

/**
 * These cases are real regressions that shipped to users: control tags leaking into
 * visible messages (a self-closing <voice/> at the END was the one that broke voice
 * notes twice). Each assertion below corresponds to a bug we actually saw.
 */
describe("stripControlTags", () => {
  it("removes a leading voice tag", () => {
    expect(stripControlTags("<voice> تصبح على خير")).toBe("تصبح على خير");
  });

  it("removes a SELF-CLOSING voice tag at the end (the shipped bug)", () => {
    expect(stripControlTags("ربنا معاك يا محمد وتخلص بسرعة. <voice/>")).toBe(
      "ربنا معاك يا محمد وتخلص بسرعة.",
    );
  });

  it("removes a closing tag and spaced variants", () => {
    expect(stripControlTags("كلام </voice>")).toBe("كلام");
    expect(stripControlTags("< voice / > كلام")).toBe("كلام");
  });

  it("removes secretary capture tags anywhere in the text", () => {
    const s = "تمام سجّلتها <todo: تكلم أحمد بكرة> و <note: الواي فاي 1234> و <done: التقرير> خلص.";
    const out = stripControlTags(s);
    expect(out).not.toMatch(/<\s*\/?\s*(todo|note|done|voice)/i);
    expect(out).toContain("تمام سجّلتها");
    expect(out).toContain("خلص.");
  });

  it("removes a trailing PARTIAL tag the model never closed", () => {
    expect(stripControlTags("خلاص اتعملت <todo: حاجة")).toBe("خلاص اتعملت");
    expect(stripControlTags("تمام <voice")).toBe("تمام");
  });

  it("leaves ordinary text with angle brackets alone", () => {
    expect(stripControlTags("النتيجة 5 < 10 صح")).toBe("النتيجة 5 < 10 صح");
    expect(stripControlTags("عادي كلام")).toBe("عادي كلام");
  });

  it("returns empty for a tag-only message", () => {
    expect(stripControlTags("<voice/>")).toBe("");
  });
});

describe("hasVoiceTag", () => {
  it("detects every variant that has appeared in the wild", () => {
    for (const s of ["<voice>", "</voice>", "<voice/>", "< voice / >", "بعده <voice/>"]) {
      expect(hasVoiceTag(s), s).toBe(true);
    }
  });

  it("does not fire on unrelated tags or plain text", () => {
    expect(hasVoiceTag("<todo: حاجة>")).toBe(false);
    expect(hasVoiceTag("مفيش تاجات هنا")).toBe(false);
  });
});
