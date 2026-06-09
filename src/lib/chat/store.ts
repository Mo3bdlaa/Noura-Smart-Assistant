import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { conversations, messages, type ConversationType } from "@/lib/db/schema";
import type { TenantContext } from "@/lib/db/tenant";
import type { ChatTurn } from "@/lib/llm/chat";

export async function getConversation(ctx: TenantContext, id: string) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, ctx.userId)))
    .limit(1);
  return row ?? null;
}

export async function listConversations(ctx: TenantContext) {
  return db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, ctx.userId))
    .orderBy(desc(conversations.createdAt));
}

export async function getMainConversation(ctx: TenantContext) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.assistantId, ctx.assistantId), eq(conversations.type, "main")))
    .limit(1);
  return row ?? null;
}

export async function createConversation(
  ctx: TenantContext,
  type: Exclude<ConversationType, "main">,
  opts?: { title?: string; scenario?: string },
) {
  const [row] = await db
    .insert(conversations)
    .values({
      userId: ctx.userId,
      assistantId: ctx.assistantId,
      type,
      title: opts?.title ?? null,
      scenario: opts?.scenario ?? null,
    })
    .returning();
  return row!;
}

/** Set/clear an emoji reaction on a message (stored in meta.reaction). */
export async function setMessageReaction(ctx: TenantContext, id: string, reaction: string | null) {
  await db
    .update(messages)
    .set({
      meta: sql`coalesce(${messages.meta}, '{}'::jsonb) || ${JSON.stringify({ reaction })}::jsonb`,
    })
    .where(and(eq(messages.id, id), eq(messages.userId, ctx.userId)));
}

/**
 * Drop a "card" message into the main conversation that links to a new side
 * conversation, so you can see — from main — what side topics you opened.
 */
export async function insertSideCard(ctx: TenantContext, sideId: string, title: string) {
  const main = await getMainConversation(ctx);
  if (!main) return;
  await db.insert(messages).values({
    conversationId: main.id,
    userId: ctx.userId,
    role: "system",
    content: title,
    meta: { sideCard: sideId },
  });
}

/** Keep the side-card label in sync once the side conversation gets a title. */
export async function updateSideCardTitle(sideId: string, title: string) {
  await db
    .update(messages)
    .set({ content: title })
    .where(sql`${messages.meta}->>'sideCard' = ${sideId}`);
}

/** Remove the side-card(s) for a deleted side conversation. */
export async function deleteSideCards(sideId: string) {
  await db.delete(messages).where(sql`${messages.meta}->>'sideCard' = ${sideId}`);
}

/** Set a conversation's title (auto-generated for side/incognito chats). */
export async function setConversationTitle(ctx: TenantContext, id: string, title: string) {
  await db
    .update(conversations)
    .set({ title })
    .where(and(eq(conversations.id, id), eq(conversations.userId, ctx.userId)));
}

/** Update an incognito conversation's scenario (roleplay setup). */
export async function updateScenario(ctx: TenantContext, id: string, scenario: string | null) {
  await db
    .update(conversations)
    .set({ scenario })
    .where(and(eq(conversations.id, id), eq(conversations.userId, ctx.userId)));
}

export async function deleteConversation(ctx: TenantContext, id: string) {
  await db
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, ctx.userId)));
}

/** Move messages (the user's own) into another conversation — used by fork. */
export async function moveMessages(ctx: TenantContext, ids: string[], targetConversationId: string) {
  if (!ids.length) return;
  await db
    .update(messages)
    .set({ conversationId: targetConversationId })
    .where(and(inArray(messages.id, ids), eq(messages.userId, ctx.userId)));
}

/** Recent turns of a conversation (oldest→newest), excluding system messages. */
export async function recentHistory(conversationId: string, limit = 20): Promise<ChatTurn[]> {
  const rows = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  return rows
    .reverse()
    .filter((r) => r.role !== "system")
    .map((r) => ({ role: r.role as ChatTurn["role"], content: r.content }));
}

export async function listMessages(ctx: TenantContext, conversationId: string) {
  return db
    .select()
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.userId, ctx.userId)))
    .orderBy(asc(messages.createdAt));
}

export async function saveMessage(opts: {
  conversationId: string;
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
  meta?: Record<string, unknown>;
}) {
  const [row] = await db
    .insert(messages)
    .values({
      conversationId: opts.conversationId,
      userId: opts.userId,
      role: opts.role,
      content: opts.content,
      meta: opts.meta ?? {},
    })
    .returning({ id: messages.id });
  return row!.id;
}

export type ReplySnapshot = { id: string; role: "user" | "assistant"; preview: string };

const briefOf = (role: string, content: string, id: string): ReplySnapshot => ({
  id,
  role: role === "user" ? "user" : "assistant",
  preview: content.slice(0, 160),
});

/** Snapshot of a message the user chose to reply to (must be theirs). */
export async function getReplySnapshot(
  ctx: TenantContext,
  id: string,
): Promise<ReplySnapshot | null> {
  const [row] = await db
    .select({ id: messages.id, role: messages.role, content: messages.content })
    .from(messages)
    .where(and(eq(messages.id, id), eq(messages.userId, ctx.userId)))
    .limit(1);
  return row ? briefOf(row.role, row.content, row.id) : null;
}

/** Resolve a short quote (from her <replyto:…> tag) to the latest matching user message. */
export async function findUserMessageByQuote(
  conversationId: string,
  quote: string,
): Promise<ReplySnapshot | null> {
  const q = quote.replace(/[%_]/g, " ").trim().slice(0, 60);
  if (q.length < 3) return null;
  const [row] = await db
    .select({ id: messages.id, role: messages.role, content: messages.content })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.role, "user"),
        sql`${messages.content} ILIKE ${"%" + q + "%"}`,
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(1);
  return row ? briefOf(row.role, row.content, row.id) : null;
}
