import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAdmin } from "@/lib/auth/guard";
import { setSetting } from "@/lib/settings";

/**
 * App-wide LLM provider config (admin only). Everything talks to an
 * OpenAI-compatible endpoint, so switching provider = set base URL + key + model.
 * Empty fields are left unchanged; the key is only written when provided.
 */
const Body = z.object({
  baseUrl: z.string().trim().url().optional().or(z.literal("")),
  apiKey: z.string().trim().optional(),
  chatModel: z.string().trim().max(100).optional(),
  embedModel: z.string().trim().max(100).optional(),
});

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  const { baseUrl, apiKey, chatModel, embedModel } = parsed.data;

  if (baseUrl) await setSetting("llm_base_url", baseUrl);
  if (apiKey) await setSetting("llm_api_key", apiKey);
  if (chatModel) await setSetting("llm_chat_model", chatModel);
  if (embedModel) await setSetting("llm_embed_model", embedModel);

  return NextResponse.json({ ok: true });
}
