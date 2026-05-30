import { NextResponse } from "next/server";
import { AuthError, requireTenant } from "@/lib/auth/guard";
import { deleteTask } from "@/lib/tasks/store";

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
