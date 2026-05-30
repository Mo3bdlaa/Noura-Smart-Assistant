import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireTenant } from "@/lib/auth/guard";
import { createReminder, listReminders } from "@/lib/reminders/store";

export async function GET() {
  try {
    const { ctx } = await requireTenant();
    return NextResponse.json({ reminders: await listReminders(ctx) });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}

const Body = z.object({
  kind: z.enum(["reminder", "important_date"]),
  title: z.string().trim().min(1).max(200),
  dueAt: z.string().datetime().optional(),
  recurrence: z.enum(["yearly"]).optional(),
});

export async function POST(req: Request) {
  try {
    const { ctx } = await requireTenant();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    const { kind, title, dueAt, recurrence } = parsed.data;
    const reminder = await createReminder(ctx, {
      kind,
      title,
      dueAt: dueAt ? new Date(dueAt) : null,
      // important dates are yearly by default (birthdays etc.)
      recurrence: recurrence ?? (kind === "important_date" ? "yearly" : null),
    });
    return NextResponse.json({ reminder });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}
