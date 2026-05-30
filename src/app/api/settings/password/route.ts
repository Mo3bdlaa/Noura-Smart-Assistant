import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth/guard";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

const Body = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "الباسورد الجديد لازم ٨ حروف على الأقل"),
});

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" }, { status: 400 });
  }

  const [row] = await db
    .select({ hash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!row || !(await verifyPassword(row.hash, parsed.data.currentPassword))) {
    return NextResponse.json({ error: "الباسورد الحالي غلط" }, { status: 400 });
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.newPassword) })
    .where(eq(users.id, user.id));

  return NextResponse.json({ ok: true });
}
