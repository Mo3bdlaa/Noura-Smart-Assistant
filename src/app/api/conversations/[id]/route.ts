import { NextResponse } from "next/server";
import { AuthError, requireTenant } from "@/lib/auth/guard";
import { deleteConversation, getConversation } from "@/lib/chat/store";

/** Delete a side/incognito conversation. Incognito delete = full forgetting. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ctx } = await requireTenant();
    const { id } = await params;
    const conv = await getConversation(ctx, id);
    if (!conv) return NextResponse.json({ error: "مش موجودة" }, { status: 404 });
    if (conv.type === "main") {
      return NextResponse.json({ error: "مينفعش تمسح المحادثة الرئيسية." }, { status: 400 });
    }
    await deleteConversation(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}
