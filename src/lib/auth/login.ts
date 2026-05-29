import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { getSession } from "./session";

/** Create a session row + seal the cookie. */
export async function startSession(opts: {
  userId: string;
  role: "admin" | "user";
  deviceId?: string;
}) {
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30d
  const [row] = await db
    .insert(sessions)
    .values({ userId: opts.userId, deviceId: opts.deviceId ?? null, expiresAt })
    .returning({ id: sessions.id });

  const session = await getSession();
  session.userId = opts.userId;
  session.sessionId = row!.id;
  session.role = opts.role;
  await session.save();
}

/** Revoke the current session row + destroy the cookie. */
export async function endSession() {
  const session = await getSession();
  if (session.sessionId) {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.id, session.sessionId));
  }
  session.destroy();
}
