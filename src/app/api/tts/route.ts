import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { AuthError, requireUser } from "@/lib/auth/guard";
import { tenantForUser } from "@/lib/db/tenant";
import { db } from "@/lib/db/client";
import { assistants } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings";
import { getApiKeys, markCooling, pickKey } from "@/lib/llm/keys";
import { getVoiceKeys, markVoiceCooling, pickVoiceKey } from "@/lib/voice/keys";
import { DEFAULT_GEMINI_VOICE, GEMINI_VOICE_NAMES } from "@/lib/voice/gemini-voices";

export const maxDuration = 30;

const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";
const DEFAULT_ELEVEN_VOICE = "21m00Tcm4TlvDq8ikWAM";

/** Wrap raw PCM (signed 16-bit LE, mono) in a minimal WAV container. */
function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate (mono, 16-bit)
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** Gemini TTS — works free from servers (unlike ElevenLabs' free tier). */
async function geminiTTS(text: string, voiceName: string): Promise<Response | null> {
  const keys = await getApiKeys();
  if (keys.length === 0) return null;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: `قوليها بصوت بنت مصرية دافية وحنينة وطبيعية: ${text}` }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    },
  });
  const tried = new Set<string>();
  for (let i = 0; i < keys.length && i < 6; i++) {
    const key = pickKey(keys.filter((k) => !tried.has(k)));
    if (!key || tried.has(key)) break;
    tried.add(key);
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent?key=${key}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body },
      );
      if (r.ok) {
        const j = await r.json();
        const part = j?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        if (part?.data) {
          const rate = Number(/rate=(\d+)/.exec(part.mimeType ?? "")?.[1]) || 24000;
          const wav = pcmToWav(Buffer.from(part.data, "base64"), rate);
          return new NextResponse(new Uint8Array(wav), {
            headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
          });
        }
      }
      if (r.status === 429 || r.status === 403) markCooling(key);
    } catch {
      /* try next key */
    }
  }
  return null;
}

/** ElevenLabs fallback — only works if the account is on a paid tier. */
async function elevenTTS(text: string, voiceId: string): Promise<Response | null> {
  const keys = await getVoiceKeys();
  if (keys.length === 0) return null;
  const tried = new Set<string>();
  for (let i = 0; i < keys.length; i++) {
    const key = pickVoiceKey(keys.filter((k) => !tried.has(k)));
    if (!key || tried.has(key)) break;
    tried.add(key);
    try {
      const r = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
          body: JSON.stringify({
            text,
            model_id: "eleven_flash_v2_5",
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
      if (r.status === 401 || r.status === 402 || r.status === 429) markVoiceCooling(key);
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * Speak her reply in a real voice. Primary: Gemini TTS (free, works server-side,
 * uses the existing Gemini key pool). Fallback: ElevenLabs (needs a paid tier — its
 * free tier blocks datacenter IPs). 204 when unconfigured so the client uses the
 * browser voice.
 */
export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }

  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = (body?.text ?? "").replace(/[*_#`>~]/g, "").trim().slice(0, 800);
  if (!text) return new NextResponse(null, { status: 204 });

  // Her configured voice — a Gemini voice name if set, else a warm default.
  let configured: string | null = null;
  try {
    const ctx = await tenantForUser(user.id, user.role);
    const [a] = await db
      .select({ voiceId: assistants.voiceId })
      .from(assistants)
      .where(eq(assistants.id, ctx.assistantId))
      .limit(1);
    configured = a?.voiceId ?? null;
  } catch {
    /* ignore */
  }
  const geminiVoice = configured && GEMINI_VOICE_NAMES.has(configured) ? configured : DEFAULT_GEMINI_VOICE;

  const fromGemini = await geminiTTS(text, geminiVoice);
  if (fromGemini) return fromGemini;

  const elevenVoice =
    process.env.ELEVENLABS_VOICE_ID || (await getSetting("elevenlabs_voice_id")) || DEFAULT_ELEVEN_VOICE;
  const fromEleven = await elevenTTS(text, elevenVoice);
  if (fromEleven) return fromEleven;

  return new NextResponse(null, { status: 204 });
}
