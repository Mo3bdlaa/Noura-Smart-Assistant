import { and, eq } from "drizzle-orm";
import { db } from "./client";
import { assistants, type ConversationType } from "./schema";

/**
 * Tenant-scoped data access. Route handlers and server components must obtain a
 * `TenantContext` (which always carries userId + assistantId) instead of touching
 * `db` directly, so isolation between users is structural rather than incidental.
 */
export type TenantContext = {
  userId: string;
  assistantId: string;
  role: "admin" | "user";
};

/** Build a tenant context for a logged-in user, resolving their single assistant. */
export async function tenantForUser(
  userId: string,
  role: "admin" | "user",
): Promise<TenantContext> {
  const [assistant] = await db
    .select({ id: assistants.id })
    .from(assistants)
    .where(eq(assistants.userId, userId))
    .limit(1);

  if (!assistant) {
    throw new Error("No assistant provisioned for this user");
  }
  return { userId, assistantId: assistant.id, role };
}

/** Helper to AND a user-scope filter onto any query condition. */
export function scoped<T extends { userId: unknown }>(
  table: T,
  ctx: TenantContext,
  extra?: ReturnType<typeof eq>,
) {
  const base = eq(table.userId as never, ctx.userId);
  return extra ? and(base, extra) : base;
}

/**
 * Centralized write/read policy per conversation type.
 *  - main / side : persist messages + memories, mutate mood
 *  - incognito    : read memory + a COPY of mood, but never persist memory or mutate mood
 */
export function conversationPolicy(type: ConversationType) {
  const isIncognito = type === "incognito";
  return {
    persistsMemory: !isIncognito,
    mutatesMood: !isIncognito,
    readsMemory: true,
    // mood is read from a discarded copy for incognito
    moodIsSandboxed: isIncognito,
  };
}
