/**
 * Free image generation core via Pollinations — used when she "sends a selfie" but
 * has no matching uploaded photo. Generated from her appearance so it stays
 * on-character. The actual upstream call happens server-side (/api/image) so the
 * optional token isn't exposed and we can fall back gracefully.
 *
 * Pluggable: swap the upstream in /api/image for Cloudflare/HF/etc. later.
 */
export function selfiePrompt(appearance: string, scene?: string | null): string | null {
  const look = (appearance ?? "").trim();
  if (look.length < 8) return null; // need a real description to stay on-character
  return [
    look,
    "a casual phone selfie of her",
    scene?.trim() || "",
    "natural realistic photo, soft warm lighting, cozy, candid",
  ]
    .filter(Boolean)
    .join(", ")
    .slice(0, 600);
}

/** Stable per-assistant seed so every generated selfie keeps the same face. */
function stableSeed(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 1_000_000;
}

/**
 * Proxy URL the client loads (no token exposed; server does the generation).
 * Passing seedKey (the assistant id) fixes the seed → consistent face across scenes.
 */
export function buildSelfieUrl(
  appearance: string,
  scene?: string | null,
  seedKey?: string | null,
): string | null {
  const prompt = selfiePrompt(appearance, scene);
  if (!prompt) return null;
  const seed = seedKey ? stableSeed(seedKey) : Math.floor(Math.random() * 1_000_000);
  return `/api/image?p=${encodeURIComponent(prompt)}&s=${seed}`;
}

/** Build the upstream Pollinations URL (server-side only). */
export function upstreamImageUrl(prompt: string, seed: number, token?: string | null): string {
  const q = new URLSearchParams({
    width: "768",
    height: "768",
    nologo: "true",
    model: "flux",
    seed: String(seed || 0),
  });
  if (token) q.set("token", token);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${q.toString()}`;
}
