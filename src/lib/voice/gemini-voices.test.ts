import { describe, expect, it } from "vitest";
import {
  DEFAULT_GEMINI_VOICE,
  DEFAULT_GEMINI_VOICE_MALE,
  GEMINI_VOICE_NAMES,
  GEMINI_VOICE_OPTIONS,
  defaultVoiceFor,
  voicesFor,
} from "./gemini-voices";

describe("voice defaults", () => {
  it("gives a male assistant a male voice (regression: everyone got a female one)", () => {
    expect(defaultVoiceFor("male")).toBe(DEFAULT_GEMINI_VOICE_MALE);
    expect(defaultVoiceFor("female")).toBe(DEFAULT_GEMINI_VOICE);
    expect(defaultVoiceFor(null)).toBe(DEFAULT_GEMINI_VOICE);
  });

  it("only offers voices matching the assistant's gender", () => {
    expect(voicesFor("male").length).toBeGreaterThan(0);
    expect(voicesFor("male").every((v) => v.gender === "male")).toBe(true);
    expect(voicesFor("female").every((v) => v.gender === "female")).toBe(true);
  });

  it("keeps every default inside the allow-list the API validates against", () => {
    expect(GEMINI_VOICE_NAMES.has(DEFAULT_GEMINI_VOICE)).toBe(true);
    expect(GEMINI_VOICE_NAMES.has(DEFAULT_GEMINI_VOICE_MALE)).toBe(true);
  });

  it("has no duplicate voice names", () => {
    const names = GEMINI_VOICE_OPTIONS.map((v) => v.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
