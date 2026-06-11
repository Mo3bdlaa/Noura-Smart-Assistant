import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { AuthError, requireTenant } from "@/lib/auth/guard";
import { deleteTask, toggleTaskDone } from "@/lib/tasks/store";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ctx } = await requireTenant();
    const { id } = await params;
    await deleteTask(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}

/** Toggle done: one-off → done/reopen; recurring → done-today / undo. */
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, ctx } = await requireTenant();
    const { id } = await params;
    const day = formatInTimeZone(new Date(), user.timezone || "Africa/Cairo", "yyyy-MM-dd");
    await toggleTaskDone(ctx, id, day);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}
