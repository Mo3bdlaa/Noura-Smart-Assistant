import { NextResponse } from "next/server";
import { z } from "zod";
import { provisionUser, ProvisionError } from "@/lib/assistant/provision";
import { startSession } from "@/lib/auth/login";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(8, "الباسورد لازم ٨ حروف على الأقل"),
  displayName: z.string().trim().min(1).max(40).optional(),
  assistantName: z.string().trim().min(2).max(40),
});

export async function POST(req: Request) {
  if (process.env.REGISTRATION_OPEN !== "true") {
    return NextResponse.json({ error: "التسجيل مقفول دلوقتي." }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "بيانات ناقصة" },
      { status: 400 },
    );
  }

  try {
    const { userId } = await provisionUser({ ...parsed.data, role: "user" });
    await startSession({ userId, role: "user" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ProvisionError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("register error", err);
    return NextResponse.json({ error: "حصل خطأ، جرّب تاني." }, { status: 500 });
  }
}
