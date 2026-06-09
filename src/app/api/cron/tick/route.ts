import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { assistants, pushSubscriptions } from "@/lib/db/schema";
import { drainJobs } from "@/lib/jobs/worker";
import { generateReminderInitiatives } from "@/lib/initiatives/generate";
import { generateDreamInitiatives } from "@/lib/dreams/generate";
import { generateNightlyReflection } from "@/lib/diary/generate";
import { runDueTasks } from "@/lib/tasks/run";

/**
 * Portable scheduler hook (Vercel Cron / GitHub Actions / external).
 * - Drains pending jobs (memory extraction safety net; `after()` is primary).
 * - Proactive sweep: for users who enabled push, fire due reminders and send a
 *   notification in the assistant's voice (so she reaches out even when closed).
 * Mood decay is lazy (computed on read) so it needs no periodic tick.
 *
 * Optional auth: if CRON_SECRET is set, callers must pass it as a Bearer token or
 * `?key=`. Left open when unset so existing schedulers keep working with no config.
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("key") === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

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
    // If they've been away a while, let her miss them / dream about them.
    try {
      await generateDreamInitiatives(userId, a.id, { notify: true });
    } catch {
      /* a failed dream shouldn't break the sweep */
    }
    // Nightly: her private diary + a casual "from my day" line for next time.
    try {
      await generateNightlyReflection(userId, a.id);
    } catch {
      /* a failed diary shouldn't break the sweep */
    }
    swept++;
  }

  return NextResponse.json({ ok: true, processed, tasksRun, swept });
}
