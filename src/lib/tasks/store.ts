import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { taskCompletions, tasks, type Task } from "@/lib/db/schema";
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

export type TaskWithState = Task & { completedToday: boolean };

/** Active tasks + whether a recurring one is already done for `day` (local YYYY-MM-DD). */
export async function listTasksWithState(ctx: TenantContext, day: string): Promise<TaskWithState[]> {
  const rows = await listTasks(ctx);
  if (rows.length === 0) return [];
  const comps = await db
    .select({ taskId: taskCompletions.taskId })
    .from(taskCompletions)
    .where(
      and(
        eq(taskCompletions.userId, ctx.userId),
        eq(taskCompletions.day, day),
        inArray(
          taskCompletions.taskId,
          rows.map((r) => r.id),
        ),
      ),
    );
  const doneSet = new Set(comps.map((c) => c.taskId));
  return rows.map((r) => ({ ...r, completedToday: doneSet.has(r.id) }));
}

/**
 * Toggle a task's completion. One-off → marked done (deactivated) / reopened.
 * Recurring → toggles completion for `day` (stays active, keeps recurring).
 */
export async function toggleTaskDone(ctx: TenantContext, id: string, day: string): Promise<void> {
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, ctx.userId)))
    .limit(1);
  if (!task) return;
  if (task.recurrence === "once") {
    if (task.active) {
      await db.update(tasks).set({ active: false, doneAt: new Date() }).where(eq(tasks.id, id));
    } else {
      await db.update(tasks).set({ active: true, doneAt: null }).where(eq(tasks.id, id));
    }
    return;
  }
  const [existing] = await db
    .select({ id: taskCompletions.id })
    .from(taskCompletions)
    .where(and(eq(taskCompletions.taskId, id), eq(taskCompletions.day, day)))
    .limit(1);
  if (existing) {
    await db.delete(taskCompletions).where(eq(taskCompletions.id, existing.id));
  } else {
    await db
      .insert(taskCompletions)
      .values({ taskId: id, userId: ctx.userId, day })
      .onConflictDoNothing();
  }
}

/** Mark the best-matching active task done (from her <done:…> tag). Returns true if any. */
export async function completeTaskByTitle(ctx: TenantContext, phrase: string, day: string): Promise<boolean> {
  const p = phrase.replace(/[%_]/g, " ").trim().slice(0, 80);
  if (p.length < 2) return false;
  const [task] = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, ctx.userId),
        eq(tasks.active, true),
        eq(tasks.kind, "remind"),
        sql`${tasks.title} ILIKE ${"%" + p + "%"}`,
      ),
    )
    .orderBy(asc(tasks.nextRunAt))
    .limit(1);
  if (!task) return false;
  if (task.recurrence === "once") {
    await db.update(tasks).set({ active: false, doneAt: new Date() }).where(eq(tasks.id, task.id));
  } else {
    await db
      .insert(taskCompletions)
      .values({ taskId: task.id, userId: ctx.userId, day })
      .onConflictDoNothing();
  }
  return true;
}
