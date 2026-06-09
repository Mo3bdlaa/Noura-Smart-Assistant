import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { memories } from "@/lib/db/schema";
import { embed } from "@/lib/llm/embeddings";
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

const AddBody = z.object({
  content: z.string().trim().min(3).max(400),
  type: z.enum(["profile", "preference", "topic", "moment", "person", "emotional"]).default("profile"),
});

/** Manually teach her a memory ("افتكري إن..."). */
export async function POST(req: Request) {
  try {
    const { ctx } = await requireTenant();
    const parsed = AddBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "محتوى غير صالح" }, { status: 400 });
    const { content, type } = parsed.data;
    const embedding = await embed(content, "RETRIEVAL_DOCUMENT");
    const [row] = await db
      .insert(memories)
      .values({
        userId: ctx.userId,
        assistantId: ctx.assistantId,
        type,
        content,
        importance: 0.7, // user-taught → salient
        embedding,
      })
      .returning({
        id: memories.id,
        type: memories.type,
        content: memories.content,
        importance: memories.importance,
        createdAt: memories.createdAt,
      });
    return NextResponse.json({ memory: row });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}
