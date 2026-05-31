import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { AuthError, requireAdmin } from "@/lib/auth/guard";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

const Body = z.object({ isLocked: z.boolean() });

/** Admin: lock or unlock a user account. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
  const { id } = await params;
  if (id === admin.id) {
    return NextResponse.json({ error: "مينفعش تقفل حسابك." }, { status: 400 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });

  await db.update(users).set({ isLocked: parsed.data.isLocked }).where(eq(users.id, id));
  return NextResponse.json({ ok: true });
}
