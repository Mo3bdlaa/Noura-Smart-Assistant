import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth/guard";
import { getSetting } from "@/lib/settings";
import { getVoiceKeys, markVoiceCooling, pickVoiceKey } from "@/lib/voice/keys";

export const maxDuration = 30;

const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM"; // a warm default until one is set
// flash is ~half the credit cost of multilingual_v2, faster, and supports Arabic.
const MODEL = "eleven_flash_v2_5";

/**
 * Synthesize her reply in a real voice via ElevenLabs. Rotates across a pool of
 * keys (settings/env) and cools a key down on quota/limit errors, so multiple free
 * accounts stretch the monthly credits. Returns 204 when unconfigured/failed so the
 * client falls back to the browser voice.
 */
export async function POST(req: Request) {
  try {
    await requireUser();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }

  const keys = await getVoiceKeys();
  if (keys.length === 0) return new NextResponse(null, { status: 204 });

  const voiceId =
    process.env.ELEVENLABS_VOICE_ID || (await getSetting("elevenlabs_voice_id")) || DEFAULT_VOICE;

  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = (body?.text ?? "").replace(/[*_#`>~]/g, "").trim().slice(0, 800);
  if (!text) return new NextResponse(null, { status: 204 });

  // Try keys until one works; cool down the ones that hit quota/limit.
  const tried = new Set<string>();
  for (let i = 0; i < keys.length; i++) {
    const key = pickVoiceKey(keys.filter((k) => !tried.has(k)));
    if (!key) break;
    tried.add(key);
    try {
      const r = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
          body: JSON.stringify({
            text,
            model_id: MODEL,
            voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.2 },
          }),
        },
      );
      if (r.ok) {
        const audio = await r.arrayBuffer();
        return new NextResponse(audio, {
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
        });
      }
      // quota/rate/auth → cool this key down and try the next one.
      if (r.status === 401 || r.status === 402 || r.status === 429) markVoiceCooling(key);
    } catch {
      /* network error — try next key */
    }
  }
  return new NextResponse(null, { status: 204 });
}
