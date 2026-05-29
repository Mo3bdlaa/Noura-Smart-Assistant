import { NextResponse } from "next/server";
import { z } from "zod";
import { provisionUser, ProvisionError } from "@/lib/assistant/provision";
import { startSession } from "@/lib/auth/login";
import { isInitialized, setSetting } from "@/lib/settings";

const Body = z.object({
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8, "الباسورد لازم ٨ حروف على الأقل"),
  displayName: z.string().trim().min(1).max(40),
  assistantName: z.string().trim().min(2).max(40).default("نورا"),
  geminiApiKey: z.string().trim().optional(),
  timezone: z.string().trim().optional(),
});

/** First-run setup. Only works while the app is uninitialized (no admin yet). */
export async function POST(req: Request) {
  if (await isInitialized()) {
    return NextResponse.json({ error: "التطبيق متظبّط بالفعل." }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات ناقصة" }, { status: 400 });
  }
  const data = parsed.data;

  try {
    if (data.geminiApiKey) {
      await setSetting("gemini_api_key", data.geminiApiKey);
    }
    const { userId } = await provisionUser({
      email: data.adminEmail,
      password: data.adminPassword,
      role: "admin",
      assistantName: data.assistantName,
      displayName: data.displayName,
      timezone: data.timezone || "Africa/Cairo",
    });
    await startSession({ userId, role: "admin" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ProvisionError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("setup error", err);
    return NextResponse.json({ error: "حصل خطأ في الإعداد." }, { status: 500 });
  }
}
