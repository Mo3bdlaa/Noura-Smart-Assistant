import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { reminders, type Reminder } from "@/lib/db/schema";
import type { TenantContext } from "@/lib/db/tenant";

export type NewReminder = {
  kind: "reminder" | "important_date";
  title: string;
  dueAt: Date | null;
  recurrence: "yearly" | null;
};

/** All of a user's reminders, soonest first (undated last). */
export async function listReminders(ctx: TenantContext): Promise<Reminder[]> {
  return db
    .select()
    .from(reminders)
    .where(eq(reminders.userId, ctx.userId))
    .orderBy(sql`${reminders.dueAt} asc nulls last`, asc(reminders.createdAt));
}

export async function createReminder(ctx: TenantContext, input: NewReminder): Promise<Reminder> {
  const [row] = await db
    .insert(reminders)
    .values({
      userId: ctx.userId,
      assistantId: ctx.assistantId,
      kind: input.kind,
      title: input.title,
      dueAt: input.dueAt,
      recurrence: input.recurrence,
    })
    .returning();
  return row!;
}

export async function deleteReminder(ctx: TenantContext, id: string): Promise<void> {
  await db.delete(reminders).where(and(eq(reminders.id, id), eq(reminders.userId, ctx.userId)));
}
