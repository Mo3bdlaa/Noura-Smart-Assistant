import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireTenant } from "@/lib/auth/guard";
import { createConversation, listConversations } from "@/lib/chat/store";

export async function GET() {
  try {
    const { ctx } = await requireTenant();
    return NextResponse.json({ conversations: await listConversations(ctx) });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}

const Body = z.object({
  type: z.enum(["side", "incognito"]),
  title: z.string().trim().max(80).optional(),
});

export async function POST(req: Request) {
  try {
    const { ctx } = await requireTenant();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    const conv = await createConversation(ctx, parsed.data.type, parsed.data.title);
    return NextResponse.json({ conversation: conv });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}
