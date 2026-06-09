import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAdmin } from "@/lib/auth/guard";
import { setSetting } from "@/lib/settings";

/**
 * App-wide LLM provider config (admin only). A global base URL + key pool +
 * models, plus optional per-role overrides (chat / utility / embed) so each can
 * use its own provider + keys.
 */
const Role = z.object({
  baseUrl: z.string().trim().optional(),
  apiKeys: z.string().trim().max(8000).optional(),
  model: z.string().trim().max(100).optional(),
});

const Body = z.object({
  baseUrl: z.string().trim().url().optional().or(z.literal("")),
  apiKeys: z.string().trim().max(8000).optional(),
  chatModel: z.string().trim().max(100).optional(),
  utilityModel: z.string().trim().max(100).optional(),
  embedModel: z.string().trim().max(100).optional(),
  // ElevenLabs voice (her real spoken voice) — pool of keys, one per line.
  elevenLabsKeys: z.string().trim().max(4000).optional(),
  voiceId: z.string().trim().max(100).optional(),
  // Image generation (Pollinations) — optional free token for reliable selfies.
  imageGenToken: z.string().trim().max(200).optional(),
  // per-role overrides
  chat: Role.optional(),
  utility: Role.optional(),
  embed: Role.optional(),
});

const cleanKeys = (s: string) =>
  s
    .split(/[\n,]+/)
    .map((k) => k.trim())
    .filter(Boolean)
    .join("\n");

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  const d = parsed.data;

  // Only non-empty fields are written, so saving never wipes what you didn't touch.
  if (d.baseUrl) await setSetting("llm_base_url", d.baseUrl);
  if (d.apiKeys) await setSetting("llm_api_keys", cleanKeys(d.apiKeys));
  if (d.chatModel) await setSetting("llm_chat_model", d.chatModel);
  if (d.utilityModel) await setSetting("llm_utility_model", d.utilityModel);
  if (d.embedModel) await setSetting("llm_embed_model", d.embedModel);
  if (d.elevenLabsKeys) await setSetting("elevenlabs_api_keys", cleanKeys(d.elevenLabsKeys));
  if (d.voiceId) await setSetting("elevenlabs_voice_id", d.voiceId.trim());
  if (d.imageGenToken) await setSetting("image_gen_token", d.imageGenToken.trim());

  for (const role of ["chat", "utility", "embed"] as const) {
    const r = d[role];
    if (!r) continue;
    if (r.baseUrl) await setSetting(`llm_${role}_base_url`, r.baseUrl.trim());
    if (r.apiKeys) await setSetting(`llm_${role}_api_keys`, cleanKeys(r.apiKeys));
    if (r.model) await setSetting(`llm_${role}_model`, r.model);
  }

  return NextResponse.json({ ok: true });
}
