import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sessions, users } from "@/lib/db/schema";
import { tenantForUser, type TenantContext } from "@/lib/db/tenant";
import { getSession } from "./session";

export type AuthedUser = {
  id: string;
  email: string;
  role: "admin" | "user";
  displayName: string | null;
  timezone: string;
  locale: "ar" | "en";
  isLocked: boolean;
  onboardedAt: Date | null;
};

/** Resolve the current user from the sealed cookie + a valid (non-revoked) session row. */
export async function currentUser(): Promise<AuthedUser | null> {
  const session = await getSession();
  if (!session.userId || !session.sessionId) return null;

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      displayName: users.displayName,
      timezone: users.timezone,
      locale: users.locale,
      isLocked: users.isLocked,
      onboardedAt: users.onboardedAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.id, session.sessionId),
        eq(sessions.userId, session.userId),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  // A locked account is treated as signed-out everywhere (admin can lock users).
  if (!row || row.isLocked) return null;
  return row;
}

/** Throw-style guard for route handlers / server actions. */
export async function requireUser(): Promise<AuthedUser> {
  const user = await currentUser();
  if (!user) throw new AuthError("UNAUTHENTICATED");
  if (user.isLocked) throw new AuthError("LOCKED");
  return user;
}

export async function requireAdmin(): Promise<AuthedUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new AuthError("FORBIDDEN");
  return user;
}

/** Resolve the tenant context (userId + assistantId) for the current user. */
export async function requireTenant(): Promise<{ user: AuthedUser; ctx: TenantContext }> {
  const user = await requireUser();
  const ctx = await tenantForUser(user.id, user.role);
  return { user, ctx };
}

export class AuthError extends Error {
  constructor(public code: "UNAUTHENTICATED" | "FORBIDDEN" | "LOCKED") {
    super(code);
  }
  get status() {
    return this.code === "UNAUTHENTICATED" ? 401 : this.code === "LOCKED" ? 423 : 403;
  }
}
