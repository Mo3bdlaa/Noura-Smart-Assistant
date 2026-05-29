import { NextResponse } from "next/server";
import { drainJobs } from "@/lib/jobs/worker";

/**
 * Portable scheduler hook (Vercel Cron / external). Drains pending jobs.
 * Mood decay is lazy (computed on read) so it needs no periodic tick; this
 * endpoint mainly guarantees memory extraction completes even if `after()` died.
 */
export async function GET() {
  const processed = await drainJobs(50);
  return NextResponse.json({ ok: true, processed });
}
