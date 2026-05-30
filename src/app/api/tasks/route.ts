import { NextResponse } from "next/server";
import { AuthError, requireTenant } from "@/lib/auth/guard";
import { listTasks } from "@/lib/tasks/store";

export async function GET() {
  try {
    const { ctx } = await requireTenant();
    return NextResponse.json({ tasks: await listTasks(ctx) });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}
