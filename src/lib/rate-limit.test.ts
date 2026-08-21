import { describe, expect, it } from "vitest";
import { LIMITS, rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  it("allows up to the limit then blocks with a retry hint", () => {
    const key = `test-allow-${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("keeps buckets isolated per key (one user can't throttle another)", () => {
    const a = `test-a-${Math.random()}`;
    const b = `test-b-${Math.random()}`;
    for (let i = 0; i < 5; i++) rateLimit(a, 2, 60_000);
    expect(rateLimit(b, 2, 60_000).ok).toBe(true);
  });

  it("starts a fresh window once the old one expires", async () => {
    const key = `test-window-${Math.random()}`;
    expect(rateLimit(key, 1, 20).ok).toBe(true);
    expect(rateLimit(key, 1, 20).ok).toBe(false);
    await new Promise((r) => setTimeout(r, 30));
    expect(rateLimit(key, 1, 20).ok).toBe(true);
  });

  it("ships budgets that a human can't trip by hand", () => {
    for (const [name, l] of Object.entries(LIMITS)) {
      expect(l.limit, name).toBeGreaterThanOrEqual(20);
      expect(l.windowMs, name).toBeGreaterThan(0);
    }
  });
});
