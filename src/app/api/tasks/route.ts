import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { AuthError, requireTenant } from "@/lib/auth/guard";
import { listTasksWithState } from "@/lib/tasks/store";

export async function GET() {
  try {
    const { user, ctx } = await requireTenant();
    const day = formatInTimeZone(new Date(), user.timezone || "Africa/Cairo", "yyyy-MM-dd");
    return NextResponse.json({ tasks: await listTasksWithState(ctx, day) });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}
