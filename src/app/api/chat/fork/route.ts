import { NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { messages } from "@/lib/db/schema";
import { AuthError, requireTenant } from "@/lib/auth/guard";
import {
  createConversation,
  getConversation,
  insertSideCard,
  moveMessages,
  setConversationTitle,
} from "@/lib/chat/store";
import { generateTitle } from "@/lib/chat/title";

const Body = z.object({
  sourceConversationId: z.string().uuid(),
  messageIds: z.array(z.string().uuid()).min(1).max(100),
});

/** Move the selected messages out of a conversation into a brand-new side chat. */
export async function POST(req: Request) {
  let user, ctx;
  try {
    ({ user, ctx } = await requireTenant());
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  const { sourceConversationId, messageIds } = parsed.data;

  const src = await getConversation(ctx, sourceConversationId);
  if (!src) return NextResponse.json({ error: "المحادثة مش موجودة" }, { status: 404 });

  // Verify the messages belong to this conversation + user; keep original order.
  const rows = await db
    .select({ id: messages.id, role: messages.role, content: messages.content })
    .from(messages)
    .where(
      and(
        inArray(messages.id, messageIds),
        eq(messages.conversationId, sourceConversationId),
        eq(messages.userId, ctx.userId),
      ),
    )
    .orderBy(asc(messages.createdAt));
  if (rows.length === 0) return NextResponse.json({ error: "مفيش رسائل تتنقل" }, { status: 400 });

  const side = await createConversation(ctx, "side");
  await moveMessages(ctx, rows.map((r) => r.id), side.id);

  // Title the new side chat from the moved exchange, and drop a card in main.
  const turns = rows
    .filter((r) => r.role !== "system")
    .map((r) => ({ role: r.role === "assistant" ? ("assistant" as const) : ("user" as const), content: r.content }));
  let title = "";
  try {
    title = (await generateTitle(turns, user.locale))?.trim() ?? "";
  } catch {
    /* fall back below */
  }
  // Never leave it as the generic label: derive from the first moved user message.
  if (!title) {
    const firstUser = turns.find((m) => m.role === "user")?.content ?? "";
    title = firstUser.replace(/\s+/g, " ").trim().slice(0, 32);
  }
  if (!title) title = user.locale === "en" ? "Side chat" : "محادثة جانبية";
  await setConversationTitle(ctx, side.id, title);
  await insertSideCard(ctx, side.id, title);

  return NextResponse.json({ conversation: { id: side.id }, title });
}
