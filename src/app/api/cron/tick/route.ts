import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { assistants, pushSubscriptions } from "@/lib/db/schema";
import { drainJobs } from "@/lib/jobs/worker";
import { generateReminderInitiatives } from "@/lib/initiatives/generate";
import { runDueTasks } from "@/lib/tasks/run";

/**
 * Portable scheduler hook (Vercel Cron / external).
 * - Drains pending jobs (memory extraction safety net; `after()` is primary).
 * - Proactive sweep: for users who enabled push, fire due reminders and send a
 *   notification in the assistant's voice (so she reaches out even when closed).
 * Mood decay is lazy (computed on read) so it needs no periodic tick.
 */
export async function GET() {
  const processed = await drainJobs(50);
  const tasksRun = await runDueTasks();

  let swept = 0;
  const subscribed = await db
    .selectDistinct({ userId: pushSubscriptions.userId })
    .from(pushSubscriptions);

  for (const { userId } of subscribed) {
    const [a] = await db
      .select({ id: assistants.id })
      .from(assistants)
      .where(eq(assistants.userId, userId))
      .limit(1);
    if (!a) continue;
    await generateReminderInitiatives(userId, a.id, { notify: true });
    swept++;
  }

  return NextResponse.json({ ok: true, processed, tasksRun, swept });
}
