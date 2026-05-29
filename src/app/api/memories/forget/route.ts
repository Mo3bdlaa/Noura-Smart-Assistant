import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireTenant } from "@/lib/auth/guard";
import { forgetTopic } from "@/lib/memory/forget";

const Body = z.object({ topic: z.string().trim().min(2).max(200) });

export async function POST(req: Request) {
  try {
    const { ctx } = await requireTenant();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "موضوع غير صالح" }, { status: 400 });
    const result = await forgetTopic({
      userId: ctx.userId,
      assistantId: ctx.assistantId,
      topic: parsed.data.topic,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}
