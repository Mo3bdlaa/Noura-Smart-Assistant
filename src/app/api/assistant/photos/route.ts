import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { AuthError, requireTenant } from "@/lib/auth/guard";
import { db } from "@/lib/db/client";
import { assistantPhotos } from "@/lib/db/schema";

export const maxDuration = 30;

/** List her photo repo (newest first). */
export async function GET() {
  try {
    const { ctx } = await requireTenant();
    const rows = await db
      .select({ id: assistantPhotos.id, url: assistantPhotos.url, tag: assistantPhotos.tag })
      .from(assistantPhotos)
      .where(eq(assistantPhotos.assistantId, ctx.assistantId))
      .orderBy(desc(assistantPhotos.createdAt));
    return NextResponse.json({ photos: rows });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}

// data URL, already downscaled client-side. ~2.7MB cap (base64 of ~2MB).
const AddBody = z.object({
  url: z.string().startsWith("data:image/").max(2_800_000),
  tag: z.string().trim().max(40).optional(),
});

export async function POST(req: Request) {
  try {
    const { ctx } = await requireTenant();
    const parsed = AddBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "صورة غير صالحة" }, { status: 400 });
    const [row] = await db
      .insert(assistantPhotos)
      .values({
        userId: ctx.userId,
        assistantId: ctx.assistantId,
        url: parsed.data.url,
        tag: parsed.data.tag || null,
      })
      .returning({ id: assistantPhotos.id, url: assistantPhotos.url, tag: assistantPhotos.tag });
    return NextResponse.json({ photo: row });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}

const DelBody = z.object({ id: z.string().uuid() });

export async function DELETE(req: Request) {
  try {
    const { ctx } = await requireTenant();
    const parsed = DelBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });
    await db
      .delete(assistantPhotos)
      .where(and(eq(assistantPhotos.id, parsed.data.id), eq(assistantPhotos.userId, ctx.userId)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}
