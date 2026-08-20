import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { conversations, messages } from "@/lib/db/schema";

/**
 * Social self-respect for her proactive messages: how many of her unprompted
 * messages in the main chat are sitting unanswered since his last reply?
 * 0 = he engages; 3 = she's being ignored. Callers scale gaps/skip accordingly —
 * like a real person who texts less when the other side goes quiet, and warms
 * back up the moment they reply (count resets to 0 on any user message).
 */
export async function unansweredProactiveCount(assistantId: string): Promise<number> {
  const [main] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.assistantId, assistantId), eq(conversations.type, "main")))
    .limit(1);
  if (!main) return 0;

  const [lastUser] = await db
    .select({ at: messages.createdAt })
    .from(messages)
    .where(and(eq(messages.conversationId, main.id), eq(messages.role, "user")))
    .orderBy(desc(messages.createdAt))
    .limit(1);

  const conds = [
    eq(messages.conversationId, main.id),
    eq(messages.role, "assistant" as const),
    sql`${messages.meta}->>'proactive' = 'true'`,
    // Only HER OWN unprompted messages count as "ignored". Reminders the user
    // explicitly asked for (tasks, dated reminders) must never throttle her —
    // not replying to a meds ping isn't a social signal.
    sql`${messages.meta}->>'taskId' is null`,
    sql`coalesce(${messages.meta}->>'reminder','') <> 'true'`,
    sql`coalesce(${messages.meta}->>'reminderFired','') <> 'true'`,
  ];
  if (lastUser) conds.push(gt(messages.createdAt, lastUser.at));

  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(messages)
    .where(and(...conds));
  return Number(row?.n ?? 0);
}
