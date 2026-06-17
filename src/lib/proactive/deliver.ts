import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { conversations, messages } from "@/lib/db/schema";
import { sendPushToUser } from "@/lib/push/send";

/**
 * Deliver a proactive message into the main conversation AND push it — so a
 * notification always has a matching message to read when the app is opened
 * (instead of pushing while only stashing an internal "initiative").
 */
export async function deliverProactive(
  userId: string,
  assistantId: string,
  opts: { text: string; pushTitle: string; meta?: Record<string, unknown> },
): Promise<boolean> {
  const text = opts.text.trim();
  if (!text) return false;
  const [main] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.assistantId, assistantId), eq(conversations.type, "main")))
    .limit(1);
  if (!main) return false;

  await db.insert(messages).values({
    conversationId: main.id,
    userId,
    role: "assistant",
    content: text,
    meta: { proactive: true, ...(opts.meta ?? {}) },
  });
  await sendPushToUser(userId, {
    title: opts.pushTitle,
    body: text.replace(/\s+/g, " ").slice(0, 120),
    url: "/chat",
  });
  return true;
}
