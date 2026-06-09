import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth/guard";
import { getSetting } from "@/lib/settings";

export const maxDuration = 30;

const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM"; // a warm default until one is set

/**
 * Synthesize her reply in a real voice via ElevenLabs. The key + voice id come
 * from settings (or env), so each deployment configures its own. Returns 204 when
 * voice isn't configured so the client gracefully falls back to browser TTS.
 */
export async function POST(req: Request) {
  try {
    await requireUser();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }

  const key = process.env.ELEVENLABS_API_KEY || (await getSetting("elevenlabs_api_key"));
  const voiceId =
    process.env.ELEVENLABS_VOICE_ID || (await getSetting("elevenlabs_voice_id")) || DEFAULT_VOICE;
  if (!key) return new NextResponse(null, { status: 204 }); // not configured → browser fallback

  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = (body?.text ?? "").replace(/[*_#`>~]/g, "").trim().slice(0, 800);
  if (!text) return new NextResponse(null, { status: 204 });

  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2", // supports Arabic
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.2 },
        }),
      },
    );
    if (!r.ok) return new NextResponse(null, { status: 204 });
    const audio = await r.arrayBuffer();
    return new NextResponse(audio, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
