import { and, asc, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { tasks, type Task } from "@/lib/db/schema";
import type { TenantContext } from "@/lib/db/tenant";

export type NewTask = {
  kind: "remind" | "digest" | "nudge";
  title: string;
  instruction?: string | null;
  nextRunAt: Date;
  recurrence?: "once" | "daily" | "weekly";
  conversationId?: string | null;
};

export async function createTask(ctx: TenantContext, input: NewTask): Promise<Task> {
  const [row] = await db
    .insert(tasks)
    .values({
      userId: ctx.userId,
      assistantId: ctx.assistantId,
      conversationId: input.conversationId ?? null,
      kind: input.kind,
      title: input.title,
      instruction: input.instruction ?? null,
      nextRunAt: input.nextRunAt,
      recurrence: input.recurrence ?? "once",
    })
    .returning();
  return row!;
}

export async function listTasks(ctx: TenantContext): Promise<Task[]> {
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, ctx.userId), eq(tasks.active, true)))
    .orderBy(asc(tasks.nextRunAt));
}

export async function deleteTask(ctx: TenantContext, id: string): Promise<void> {
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, ctx.userId)));
}

/** Tasks whose time has come (across all users) — used by the scheduler. */
export async function dueTasks(now = new Date(), limit = 30): Promise<Task[]> {
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.active, true), lte(tasks.nextRunAt, now)))
    .orderBy(asc(tasks.nextRunAt))
    .limit(limit);
}

/** Advance a fired task to its next run (or deactivate one-off tasks). */
export async function advanceTask(task: Task, firedAt = new Date()): Promise<void> {
  if (task.recurrence === "once") {
    await db.update(tasks).set({ active: false, lastRunAt: firedAt }).where(eq(tasks.id, task.id));
    return;
  }
  const next = new Date(task.nextRunAt);
  const step = task.recurrence === "weekly" ? 7 : 1;
  // roll forward past now so we don't double-fire
  do {
    next.setDate(next.getDate() + step);
  } while (next <= firedAt);
  await db.update(tasks).set({ nextRunAt: next, lastRunAt: firedAt }).where(eq(tasks.id, task.id));
}
