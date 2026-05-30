import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { AuthError, requireTenant } from "@/lib/auth/guard";
import { db } from "@/lib/db/client";
import { assistants } from "@/lib/db/schema";
import { sendPushToUser } from "@/lib/push/send";

export async function POST() {
  let user, ctx;
  try {
    ({ user, ctx } = await requireTenant());
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }

  const [assistant] = await db
    .select({ name: assistants.name })
    .from(assistants)
    .where(eq(assistants.id, ctx.assistantId))
    .limit(1);
  const name = assistant?.name ?? "نورا";

  const sent = await sendPushToUser(user.id, {
    title: name,
    body: `أنا موجودة 💛 لو محتاجني كلمني.`,
    url: "/chat",
  });

  if (sent === 0) {
    return NextResponse.json(
      { error: "مفيش جهاز مشترك في الإشعارات (أو الإشعارات مش متفعّلة على السيرفر)." },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true, sent });
}
