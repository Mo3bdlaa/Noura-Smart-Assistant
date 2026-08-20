import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth/guard";
import { runDueTasks } from "@/lib/tasks/run";

export const maxDuration = 30;

/**
 * Activity-driven catch-up: the app pings this when it becomes visible, so due
 * reminders fire as soon as you open it rather than waiting for the next cron
 * sweep. (Hosting free tiers only allow one cron run per day, so opening the app
 * is the most reliable trigger we have without an external scheduler.)
 *
 * Throttled per user in-process so a tab regaining focus repeatedly is cheap.
 */
const lastRun = new Map<string, number>();
const MIN_GAP_MS = 60_000;

export async function POST() {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }

  const now = Date.now();
  if (now - (lastRun.get(user.id) ?? 0) < MIN_GAP_MS) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  lastRun.set(user.id, now);

  try {
    const ran = await runDueTasks();
    return NextResponse.json({ ok: true, ran });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
