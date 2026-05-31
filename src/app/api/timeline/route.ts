import { NextResponse } from "next/server";
import { AuthError, requireTenant } from "@/lib/auth/guard";
import { buildTimeline } from "@/lib/timeline/build";

/** Relationship timeline: milestones, stats, and her mood history for charting. */
export async function GET() {
  try {
    const { ctx } = await requireTenant();
    const data = await buildTimeline(ctx);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}
