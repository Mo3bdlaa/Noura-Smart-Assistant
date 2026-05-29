import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { memories } from "@/lib/db/schema";
import { AuthError, requireTenant } from "@/lib/auth/guard";

export async function GET() {
  try {
    const { ctx } = await requireTenant();
    const rows = await db
      .select({
        id: memories.id,
        type: memories.type,
        content: memories.content,
        importance: memories.importance,
        createdAt: memories.createdAt,
      })
      .from(memories)
      .where(and(eq(memories.userId, ctx.userId), eq(memories.assistantId, ctx.assistantId)))
      .orderBy(desc(memories.importance), desc(memories.createdAt))
      .limit(300);
    return NextResponse.json({ memories: rows });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}
