import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { AuthError, requireAdmin } from "@/lib/auth/guard";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";

const Body = z
  .object({
    isLocked: z.boolean().optional(),
    role: z.enum(["admin", "user"]).optional(),
    newPassword: z.string().min(8).max(200).optional(),
  })
  .refine((b) => b.isLocked !== undefined || b.role !== undefined || b.newPassword !== undefined, {
    message: "nothing to update",
  });

/** Admin: lock/unlock, change role, or reset a user's password. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  const { isLocked, role, newPassword } = parsed.data;

  // Guardrails: an admin can't lock or demote themselves out of access.
  if (id === admin.id && (isLocked === true || role === "user")) {
    return NextResponse.json({ error: "مينفعش تعمل ده لحسابك." }, { status: 400 });
  }

  const update: Partial<typeof users.$inferInsert> = {};
  if (isLocked !== undefined) update.isLocked = isLocked;
  if (role !== undefined) update.role = role;
  if (newPassword !== undefined) update.passwordHash = await hashPassword(newPassword);
  await db.update(users).set(update).where(eq(users.id, id));
  return NextResponse.json({ ok: true });
}

/** Admin: permanently delete a user (cascades to their assistant, chats, memories). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
  const { id } = await params;
  if (id === admin.id) return NextResponse.json({ error: "مينفعش تمسح حسابك." }, { status: 400 });
  await db.delete(users).where(eq(users.id, id));
  return NextResponse.json({ ok: true });
}
