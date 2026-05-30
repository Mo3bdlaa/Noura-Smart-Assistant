import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { assistants, loginAttempts, pendingInitiatives, reminders } from "@/lib/db/schema";
import { sendPushToUser } from "@/lib/push/send";

/**
 * Turn raw events into "things Noura wants to say". Idempotent-ish: security
 * events mark the source login_attempts as surfaced so they aren't re-queued.
 */
export async function generateSecurityInitiatives(userId: string, assistantId: string) {
  const attempts = await db
    .select()
    .from(loginAttempts)
    .where(and(eq(loginAttempts.userId, userId), eq(loginAttempts.surfaced, false)))
    .limit(20);

  for (const a of attempts) {
    // Only failed attempts are worth raising in her voice for MVP.
    if (a.success) {
      await db
        .update(loginAttempts)
        .set({ surfaced: true })
        .where(eq(loginAttempts.id, a.id));
      continue;
    }
    await db.insert(pendingInitiatives).values({
      userId,
      assistantId,
      kind: "security",
      priority: 2,
      payload: {
        event: "failed_login",
        at: a.createdAt.toISOString(),
        ip: a.ip,
        device: a.deviceFingerprint,
      },
    });
    await db.update(loginAttempts).set({ surfaced: true }).where(eq(loginAttempts.id, a.id));
  }
}

export async function generateReminderInitiatives(
  userId: string,
  assistantId: string,
  opts: { now?: Date; notify?: boolean } = {},
) {
  const now = opts.now ?? new Date();
  const due = await db
    .select()
    .from(reminders)
    .where(and(eq(reminders.userId, userId), isNull(reminders.firedAt)))
    .limit(20);

  let assistantName: string | null = null;
  const nameOf = async () => {
    if (assistantName) return assistantName;
    const [a] = await db
      .select({ name: assistants.name })
      .from(assistants)
      .where(eq(assistants.id, assistantId))
      .limit(1);
    assistantName = a?.name ?? "نورا";
    return assistantName;
  };

  for (const r of due) {
    if (r.dueAt && r.dueAt <= now) {
      await db.insert(pendingInitiatives).values({
        userId,
        assistantId,
        kind: "reminder",
        priority: 3,
        payload: { title: r.title, kind: r.kind },
      });
      // Proactive push (when the app may be closed) — in her voice.
      if (opts.notify) {
        const name = await nameOf();
        await sendPushToUser(userId, {
          title: name,
          body:
            r.kind === "important_date"
              ? `النهاردة: ${r.title} 🎉 متنساش!`
              : `فاكر إن النهاردة: ${r.title}؟ 💛`,
          url: "/chat",
        });
      }
      if (r.recurrence === "yearly") {
        // Roll a recurring date forward to its next future occurrence (stays active).
        const next = new Date(r.dueAt);
        while (next <= now) next.setFullYear(next.getFullYear() + 1);
        await db.update(reminders).set({ dueAt: next }).where(eq(reminders.id, r.id));
      } else {
        await db.update(reminders).set({ firedAt: now }).where(eq(reminders.id, r.id));
      }
    }
  }
}
