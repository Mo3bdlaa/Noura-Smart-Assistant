import { NextResponse } from "next/server";
import { AuthError, requireTenant } from "@/lib/auth/guard";
import { deleteReminder } from "@/lib/reminders/store";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ctx } = await requireTenant();
    const { id } = await params;
    await deleteReminder(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}
