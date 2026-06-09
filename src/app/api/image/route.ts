import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth/guard";
import { getSetting } from "@/lib/settings";
import { upstreamImageUrl } from "@/lib/image/generate";

export const maxDuration = 60;

/**
 * Server-side image proxy for her generated selfies. Calls Pollinations with the
 * (optional, free) token from settings — keeping it off the client — caches the
 * result hard (deterministic by prompt+seed), and falls back to her avatar if
 * generation fails or is rate-limited, so a message image never breaks.
 */
export async function GET(req: Request) {
  try {
    await requireUser();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }

  const url = new URL(req.url);
  const prompt = url.searchParams.get("p") ?? "";
  const seed = Number(url.searchParams.get("s") ?? "0") || 0;
  const fallback = NextResponse.redirect(new URL("/noura-avatar.jpg", req.url));
  if (!prompt) return fallback;

  // Pick a token from the pool (settings/env) — keeps Pollinations off its anon limit.
  const pool = ((await getSetting("image_gen_tokens")) ?? "")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const token =
    process.env.POLLINATIONS_TOKEN ||
    pool[Math.floor(Math.random() * pool.length)] ||
    (await getSetting("image_gen_token")) ||
    undefined;

  try {
    const r = await fetch(upstreamImageUrl(prompt, seed, token), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (r.ok && (r.headers.get("content-type") ?? "").startsWith("image/")) {
      const buf = await r.arrayBuffer();
      return new NextResponse(buf, {
        headers: {
          "Content-Type": r.headers.get("content-type") ?? "image/jpeg",
          // deterministic → cache hard on the browser/CDN
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
  } catch {
    /* fall through */
  }
  return fallback;
}
