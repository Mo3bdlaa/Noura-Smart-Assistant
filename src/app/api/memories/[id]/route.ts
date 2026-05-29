import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth/guard";
import { deleteMemory } from "@/lib/memory/forget";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await deleteMemory(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}
