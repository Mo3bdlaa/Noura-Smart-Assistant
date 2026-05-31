import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireTenant } from "@/lib/auth/guard";
import { setUserNotes } from "@/lib/insights/profile";

const Body = z.object({ userNotes: z.string().max(4000) });

/** Update the user's own notes/additions on their profile. */
export async function PATCH(req: Request) {
  try {
    const { ctx } = await requireTenant();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    await setUserNotes(ctx.userId, ctx.assistantId, parsed.data.userNotes.trim() || null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}
