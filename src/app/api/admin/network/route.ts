import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { agentMessages, assistants, moodState } from "@/lib/db/schema";
import { AuthError, requireAdmin } from "@/lib/auth/guard";
import { tenantForUser } from "@/lib/db/tenant";
import { adminQueryAssistant } from "@/lib/network/agent-query";

/** GET: network overview (all assistants + mood). Admin only. */
export async function GET() {
  try {
    await requireAdmin();
    const rows = await db
      .select({
        id: assistants.id,
        name: assistants.name,
        userId: assistants.userId,
        annoyance: moodState.annoyance,
        happiness: moodState.happiness,
      })
      .from(assistants)
      .leftJoin(moodState, eq(assistants.id, moodState.assistantId))
      .orderBy(desc(assistants.createdAt));

    const recent = await db
      .select()
      .from(agentMessages)
      .orderBy(desc(agentMessages.createdAt))
      .limit(20);

    return NextResponse.json({ assistants: rows, recent });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}

const Body = z.object({
  targetAssistantId: z.string().uuid(),
  question: z.string().trim().min(2).max(500),
});

/** POST: silently ask another assistant (god-mode). Admin only. */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const adminCtx = await tenantForUser(admin.id, "admin");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });

    const result = await adminQueryAssistant({
      adminUserId: admin.id,
      adminAssistantId: adminCtx.assistantId,
      targetAssistantId: parsed.data.targetAssistantId,
      question: parsed.data.question,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}
