import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { AuthError, requireUser } from "@/lib/auth/guard";
import { tenantForUser } from "@/lib/db/tenant";
import { db } from "@/lib/db/client";
import { assistants } from "@/lib/db/schema";
import { getApiKeys, markCooling, pickKey } from "@/lib/llm/keys";
import { LIMITS, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 30;

// flash-lite is reliable + fast for transcription; flash as a fallback if it errors.
const STT_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];

/**
 * Transcription hint for the assistant's configured language — a fixed Egyptian
 * prompt mis-transcribes every other language the assistant supports.
 */
function transcriptionPrompt(language: string): string {
  const tail = " Transcribe exactly what was said, verbatim, with no commentary or quotes. Return empty text if nothing intelligible.";
  switch (language) {
    case "masri":
      return "فرّغ الكلام في التسجيل الصوتي ده نصيًا بالعامية المصرية زي ما اتقال بالظبط، من غير أي تعليق أو علامات اقتباس. لو مفيش كلام واضح رجّع نص فاضي.";
    case "levantine":
      return "فرّغ الكلام بالتسجيل الصوتي هاد نصيًا باللهجة الشامية متل ما انقال بالظبط، بدون أي تعليق أو علامات اقتباس. إذا ما في كلام واضح رجّع نص فاضي.";
    case "khaliji":
      return "فرّغ الكلام في التسجيل الصوتي هذا نصيًا باللهجة الخليجية مثل ما انقال بالضبط، بدون أي تعليق أو علامات اقتباس. إذا ما فيه كلام واضح رجّع نص فاضي.";
    case "maghrebi":
      return "فرّغ الهضرة في هاد التسجيل الصوتي نصيًا بالدارجة المغاربية بحال ما تقالت بالضبط، بلا أي تعليق ولا علامات اقتباس. إلا ما كانش هضرة واضحة رجّع نص خاوي.";
    case "msa":
      return "فرّغ الكلام في هذا التسجيل الصوتي نصيًا بالعربية الفصحى كما قيل تمامًا، دون أي تعليق أو علامات اقتباس. إن لم يكن هناك كلام واضح فأعد نصًا فارغًا.";
    case "fr":
      return "Transcris exactement ce qui est dit dans cet enregistrement, en français." + tail;
    case "auto":
      return "Detect the spoken language/dialect and transcribe in it." + tail;
    default:
      return "Transcribe this recording in English." + tail;
  }
}

/**
 * Speech-to-text for her voice-chat input. Transcribes the user's recorded audio
 * with Gemini (works server-side everywhere, incl. iOS PWA). The prompt follows the
 * assistant's configured language so non-Egyptian setups transcribe correctly.
 * Returns { text }.
 */
export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }

  const rl = rateLimit(`stt:${user.id}`, LIMITS.stt.limit, LIMITS.stt.windowMs);
  if (!rl.ok) return NextResponse.json({ text: "" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });

  const body = (await req.json().catch(() => null)) as { audio?: string; mimeType?: string } | null;
  const audio = body?.audio ?? "";
  const mimeType = body?.mimeType ?? "audio/wav";
  if (!audio || audio.length > 12_000_000) {
    return NextResponse.json({ error: "صوت غير صالح" }, { status: 400 });
  }

  const keys = await getApiKeys();
  if (keys.length === 0) return NextResponse.json({ text: "" });

  // Transcribe in the assistant's language, not a hardcoded one.
  let language = "en";
  try {
    const ctx = await tenantForUser(user.id, user.role);
    const [a] = await db
      .select({ language: assistants.language })
      .from(assistants)
      .where(eq(assistants.id, ctx.assistantId))
      .limit(1);
    language = a?.language ?? "en";
  } catch {
    /* fall back to the default prompt */
  }

  const payload = JSON.stringify({
    contents: [
      {
        parts: [
          { text: transcriptionPrompt(language) },
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
