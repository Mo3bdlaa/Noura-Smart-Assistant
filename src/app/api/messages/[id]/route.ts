import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth/guard";
import { forgetMessage } from "@/lib/memory/forget";

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
