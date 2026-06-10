import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth/guard";
import { tenantForUser } from "@/lib/db/tenant";
import { GEMINI_VOICE_NAMES } from "@/lib/voice/gemini-voices";
import { getOrSynth, resolveGeminiVoice } from "@/lib/voice/tts";

export const maxDuration = 30;

/**
 * Speak her reply. Audio is cached (by voice+text), so the first request generates
 * it once and every later play is served instantly from the cache — no
 * re-generation. 204 when unconfigured/failed so the client uses the browser voice.
 */
export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }

  const body = (await req.json().catch(() => null)) as { text?: string; voice?: string } | null;
  const text = (body?.text ?? "").trim();
  if (!text) return new NextResponse(null, { status: 204 });

  // Preview override (auditioning a voice) wins; else her configured voice.
  let voice = body?.voice && GEMINI_VOICE_NAMES.has(body.voice) ? body.voice : null;
  if (!voice) {
    try {
      const ctx = await tenantForUser(user.id, user.role);
      voice = await resolveGeminiVoice(ctx.assistantId);
    } catch {
      voice = "Aoede";
    }
  }

  const audio = await getOrSynth(text, voice);
  if (!audio) return new NextResponse(null, { status: 204 });
  return new NextResponse(new Uint8Array(audio.bytes), {
    headers: { "Content-Type": audio.mime, "Cache-Control": "private, max-age=86400" },
  });
}
