import { createHash } from "crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { assistants, ttsCache } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings";
import { getApiKeys, markCooling, pickKey } from "@/lib/llm/keys";
import { getVoiceKeys, markVoiceCooling, pickVoiceKey } from "@/lib/voice/keys";
import { DEFAULT_GEMINI_VOICE, GEMINI_VOICE_NAMES, defaultVoiceFor } from "@/lib/voice/gemini-voices";

const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";
const DEFAULT_ELEVEN_VOICE = "21m00Tcm4TlvDq8ikWAM";

export type Audio = { mime: string; bytes: Buffer };

/** Wrap raw PCM (signed 16-bit LE, mono) in a minimal WAV container. */
function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/** The Gemini voice for an assistant (its own, else a gender-appropriate default). */
export async function resolveGeminiVoice(assistantId: string): Promise<string> {
  try {
    const [a] = await db
      .select({ voiceId: assistants.voiceId, gender: assistants.gender })
      .from(assistants)
      .where(eq(assistants.id, assistantId))
      .limit(1);
    const v = a?.voiceId ?? null;
    if (v && GEMINI_VOICE_NAMES.has(v)) return v;
    return defaultVoiceFor(a?.gender);
  } catch {
    /* fall back */
  }
  return DEFAULT_GEMINI_VOICE;
}

const cleanText = (t: string) => t.replace(/[*_#`>~]/g, "").trim().slice(0, 800);
/** Hash the FULL text (not the truncated slice) so two long lines sharing their
 *  first 800 chars can't collide onto the same cached audio. */
const keyFor = (voice: string, text: string) =>
  createHash("sha256").update(`${voice}|${text.trim()}`).digest("hex");

// The cache lives in Postgres (base64 audio) — bound it so it can't grow forever.
const CACHE_MAX_ROWS = 400;
const CACHE_MAX_AGE_DAYS = 30;

/** Trim the cache back to its bounds. Cheap, and only runs after a real synth. */
async function pruneCache(): Promise<void> {
  try {
    await db.execute(sql`delete from tts_cache where created_at < now() - interval '${sql.raw(String(CACHE_MAX_AGE_DAYS))} days'`);
    await db.execute(sql`
      delete from tts_cache where key in (
        select key from tts_cache order by created_at desc offset ${CACHE_MAX_ROWS}
      )`);
  } catch {
    /* pruning is best-effort */
  }
}

async function geminiSynth(text: string, voiceName: string): Promise<Audio | null> {
  const keys = await getApiKeys();
  if (keys.length === 0) return null;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: `Say this naturally, in a warm conversational tone: ${text}` }] }],
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
          return { mime: "audio/wav", bytes: pcmToWav(Buffer.from(part.data, "base64"), rate) };
        }
      }
      if (r.status === 429 || r.status === 403) markCooling(key);
    } catch {
      /* next key */
    }
  }
  return null;
}

async function elevenSynth(text: string, voiceId: string): Promise<Audio | null> {
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
      if (r.ok) return { mime: "audio/mpeg", bytes: Buffer.from(await r.arrayBuffer()) };
      if (r.status === 401 || r.status === 402 || r.status === 429) markVoiceCooling(key);
    } catch {
      /* next */
    }
  }
  return null;
}

/**
 * Get the audio for a line — from the cache if we've synthesized it before, else
 * generate once (Gemini, ElevenLabs fallback) and store it. Deterministic by
 * (voice, text), so every later play is instant and costs no quota.
 */
export async function getOrSynth(
  text: string,
  geminiVoice: string,
  opts: { cache?: boolean } = {},
): Promise<Audio | null> {
  const useCache = opts.cache !== false; // incognito passes false: leave no trace
  const clean = cleanText(text);
  if (!clean) return null;
  const key = keyFor(geminiVoice, text);

  if (useCache) {
    try {
      const [hit] = await db.select().from(ttsCache).where(eq(ttsCache.key, key)).limit(1);
      if (hit) return { mime: hit.mime, bytes: Buffer.from(hit.audio, "base64") };
    } catch {
      /* cache read failure → just synth */
    }
  }

  let out = await geminiSynth(clean, geminiVoice);
  if (!out) {
    const elevenVoice =
      process.env.ELEVENLABS_VOICE_ID || (await getSetting("elevenlabs_voice_id")) || DEFAULT_ELEVEN_VOICE;
    out = await elevenSynth(clean, elevenVoice);
  }
  if (!out) return null;
  if (!useCache) return out;

  try {
    await db
      .insert(ttsCache)
      .values({ key, mime: out.mime, audio: out.bytes.toString("base64") })
      .onConflictDoNothing();
    await pruneCache();
  } catch {
    /* caching is best-effort */
  }
  return out;
}

/** Pre-generate + cache a line's audio so the first play is instant. */
export async function warmTTS(assistantId: string, text: string): Promise<void> {
  try {
    const voice = await resolveGeminiVoice(assistantId);
    await getOrSynth(text, voice);
  } catch {
    /* best-effort warm */
  }
}
