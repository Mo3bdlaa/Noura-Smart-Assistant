import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireTenant } from "@/lib/auth/guard";
import { deleteConversation, getConversation, updateScenario } from "@/lib/chat/store";

const PatchBody = z.object({ scenario: z.string().trim().max(2000) });

/** Update an incognito conversation's scenario (roleplay setup). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ctx } = await requireTenant();
    const { id } = await params;
    const conv = await getConversation(ctx, id);
    if (!conv) return NextResponse.json({ error: "مش موجودة" }, { status: 404 });
    if (conv.type !== "incognito") {
      return NextResponse.json({ error: "السيناريو للوضع التخيلي بس." }, { status: 400 });
    }
    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    await updateScenario(ctx, id, parsed.data.scenario || null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}

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
