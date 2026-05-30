import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireTenant, requireUser } from "@/lib/auth/guard";
import { forgetMessage } from "@/lib/memory/forget";
import { setMessageReaction } from "@/lib/chat/store";

/** Delete a message → cascade-deletes its derived memories (true forgetting). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await forgetMessage(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}

const ALLOWED = ["❤️", "😂", "😮", "😢", "👍", "🔥", "🥰"];
const PatchBody = z.object({ reaction: z.string().nullable() });

/** Set/clear an emoji reaction on a message. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ctx } = await requireTenant();
    const { id } = await params;
    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    const r = parsed.data.reaction;
    if (r && !ALLOWED.includes(r)) {
      return NextResponse.json({ error: "رياكشن غير مسموح" }, { status: 400 });
    }
    await setMessageReaction(ctx, id, r);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}
