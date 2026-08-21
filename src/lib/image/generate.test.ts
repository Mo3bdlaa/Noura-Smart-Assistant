import { describe, expect, it } from "vitest";
import { buildSelfieUrl, selfiePrompt, upstreamImageUrl } from "./generate";

const LOOK = "Egyptian woman, wavy dark-brown hair, hazel eyes, warm smile";

describe("selfiePrompt", () => {
  it("refuses to generate without a real appearance (would drift off-character)", () => {
    expect(selfiePrompt("", null)).toBeNull();
    expect(selfiePrompt("short", null)).toBeNull();
  });

  it("uses the assistant's gender rather than always 'her'", () => {
    expect(selfiePrompt(LOOK, null, "female")).toContain("selfie of her");
    expect(selfiePrompt(LOOK, null, "male")).toContain("selfie of him");
    expect(selfiePrompt(LOOK, null, "male")).not.toContain("selfie of her");
  });

  it("keeps the appearance first so the face description dominates", () => {
    expect(selfiePrompt(LOOK, "at a cafe", "female")!.startsWith(LOOK)).toBe(true);
  });
});

describe("buildSelfieUrl", () => {
  it("gives the SAME seed for one assistant so the face stays consistent", () => {
    const a = buildSelfieUrl(LOOK, "morning", "assistant-1", "female")!;
    const b = buildSelfieUrl(LOOK, "at night", "assistant-1", "female")!;
    const seed = (u: string) => new URLSearchParams(u.split("?")[1]).get("s");
    expect(seed(a)).toBe(seed(b));
  });

  it("gives different assistants different faces", () => {
    const seed = (u: string) => new URLSearchParams(u.split("?")[1]).get("s");
    expect(seed(buildSelfieUrl(LOOK, null, "assistant-1")!)).not.toBe(
      seed(buildSelfieUrl(LOOK, null, "assistant-2")!),
    );
  });

  it("routes through our proxy, never straight to the upstream provider", () => {
    const url = buildSelfieUrl(LOOK, null, "a1")!;
    expect(url.startsWith("/api/image?")).toBe(true);
    expect(url).not.toContain("pollinations");
  });

  it("returns null when there is no appearance to work from", () => {
    expect(buildSelfieUrl("", null, "a1")).toBeNull();
  });
});

describe("upstreamImageUrl", () => {
  it("includes the token only when we actually have one", () => {
    expect(upstreamImageUrl("x", 1, "tok")).toContain("token=tok");
    expect(upstreamImageUrl("x", 1, null)).not.toContain("token=");
  });
});
