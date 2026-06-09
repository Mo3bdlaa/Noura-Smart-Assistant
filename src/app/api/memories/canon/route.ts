import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { assistants, type CanonEntry } from "@/lib/db/schema";
import { AuthError, requireTenant } from "@/lib/auth/guard";

/** Her self-facts (canon) — things she's said about herself that must stay consistent. */
export async function GET() {
  try {
    const { ctx } = await requireTenant();
    const [a] = await db
      .select({ canon: assistants.canon })
      .from(assistants)
      .where(eq(assistants.id, ctx.assistantId))
      .limit(1);
    const canon = ((a?.canon as CanonEntry[]) ?? []).map((c) => c.fact).filter(Boolean);
    return NextResponse.json({ canon });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}

const DelBody = z.object({ fact: z.string().min(1) });

/** Drop a self-fact she stated. */
export async function DELETE(req: Request) {
  try {
    const { ctx } = await requireTenant();
    const parsed = DelBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "fact مطلوب" }, { status: 400 });
    const [a] = await db
      .select({ canon: assistants.canon })
      .from(assistants)
      .where(eq(assistants.id, ctx.assistantId))
      .limit(1);
    const next = ((a?.canon as CanonEntry[]) ?? []).filter((c) => c.fact !== parsed.data.fact);
    await db.update(assistants).set({ canon: next }).where(eq(assistants.id, ctx.assistantId));
    return NextResponse.json({ canon: next.map((c) => c.fact) });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}
