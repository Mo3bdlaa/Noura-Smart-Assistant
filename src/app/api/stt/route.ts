import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth/guard";
import { getApiKeys, markCooling, pickKey } from "@/lib/llm/keys";

export const maxDuration = 30;

// flash-lite is reliable + fast for transcription; flash as a fallback if it errors.
const STT_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];

/**
 * Speech-to-text for her voice-chat input. Transcribes the user's recorded audio
 * with Gemini (works server-side everywhere, incl. iOS PWA, and handles Egyptian
 * Arabic far better than the browser's SpeechRecognition). Returns { text }.
 */
export async function POST(req: Request) {
  try {
    await requireUser();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }

  const body = (await req.json().catch(() => null)) as { audio?: string; mimeType?: string } | null;
  const audio = body?.audio ?? "";
  const mimeType = body?.mimeType ?? "audio/wav";
  if (!audio || audio.length > 12_000_000) {
    return NextResponse.json({ error: "صوت غير صالح" }, { status: 400 });
  }

  const keys = await getApiKeys();
  if (keys.length === 0) return NextResponse.json({ text: "" });

  const payload = JSON.stringify({
    contents: [
      {
        parts: [
          {
            text: "فرّغ الكلام في التسجيل الصوتي ده نصيًا بالعامية المصرية زي ما اتقال بالظبط، من غير أي تعليق أو علامات اقتباس. لو مفيش كلام واضح رجّع نص فاضي.",
          },
          { inlineData: { mimeType, data: audio } },
        ],
      },
    ],
    generationConfig: { temperature: 0 },
  });

  for (const model of STT_MODELS) {
    const tried = new Set<string>();
    for (let i = 0; i < keys.length && i < 4; i++) {
      const key = pickKey(keys.filter((k) => !tried.has(k)));
      if (!key || tried.has(key)) break;
      tried.add(key);
      try {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: payload },
        );
        if (r.ok) {
          const j = await r.json();
          const text = (j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
          return NextResponse.json({ text });
        }
        if (r.status === 429 || r.status === 403) markCooling(key);
        if (r.status === 503) break; // model overloaded — try the next model
      } catch {
        /* try next key */
      }
    }
  }
  return NextResponse.json({ text: "" });
}
