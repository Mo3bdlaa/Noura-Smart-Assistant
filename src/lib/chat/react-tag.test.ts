import { describe, expect, it } from "vitest";
import { couldBeLeadTag, parseLeadTags } from "./react-tag";

describe("parseLeadTags", () => {
  it("extracts a reaction and leaves the reply text", () => {
    const r = parseLeadTags("<react:❤️> وحشتني");
    expect(r.reaction).toBe("❤️");
    expect(r.rest).toBe("وحشتني");
  });

  it("extracts a photo tag with a mood", () => {
    const r = parseLeadTags("<photo:صباح> صباح الخير");
    expect(r.photo).toBe(true);
    expect(r.photoTag).toBe("صباح");
    expect(r.rest).toBe("صباح الخير");
  });

  it("supports a bare photo tag with no text after it", () => {
    const r = parseLeadTags("<photo>");
    expect(r.photo).toBe(true);
    expect(r.photoTag).toBeNull();
    expect(r.rest).toBe("");
  });

  it("handles several stacked lead tags in one reply", () => {
    const r = parseLeadTags("<react:❤️><voice> وحشتني");
    expect(r.reaction).toBe("❤️");
    expect(r.voice).toBe(true);
    expect(r.rest).toBe("وحشتني");
  });

  it("returns plain text untouched", () => {
    const r = parseLeadTags("عادي كلام");
    expect(r).toMatchObject({ reaction: null, photo: false, voice: false, rest: "عادي كلام" });
  });
});

describe("couldBeLeadTag", () => {
  it("holds a partially-streamed tag back", () => {
    for (const buf of ["", "<", "<re", "<react:", "<photo", "<voi"]) {
      expect(couldBeLeadTag(buf), buf).toBe(true);
    }
  });

  it("releases once the text can no longer become a tag", () => {
    expect(couldBeLeadTag("صباح")).toBe(false);
    expect(couldBeLeadTag("<react:❤️>")).toBe(false);
  });
});
