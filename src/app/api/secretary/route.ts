import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireTenant } from "@/lib/auth/guard";
import { addItem, deleteItem, listItems, toggleDone } from "@/lib/secretary/items";

export async function GET() {
  try {
    const { ctx } = await requireTenant();
    return NextResponse.json(await listItems(ctx));
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}

const AddBody = z.object({ kind: z.enum(["todo", "note"]), content: z.string().trim().min(1).max(400) });

export async function POST(req: Request) {
  try {
    const { ctx } = await requireTenant();
    const parsed = AddBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "محتوى غير صالح" }, { status: 400 });
    const item = await addItem(ctx, parsed.data.kind, parsed.data.content);
    return NextResponse.json({ item });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}

const PatchBody = z.object({ id: z.string().uuid() });

export async function PATCH(req: Request) {
  try {
    const { ctx } = await requireTenant();
    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });
    await toggleDone(ctx, parsed.data.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}

export async function DELETE(req: Request) {
  try {
    const { ctx } = await requireTenant();
    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });
    await deleteItem(ctx, parsed.data.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}
