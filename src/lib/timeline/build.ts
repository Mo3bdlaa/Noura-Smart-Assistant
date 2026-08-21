import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { assistants, conversations, diaries, memories, messages } from "@/lib/db/schema";
import type { TenantContext } from "@/lib/db/tenant";
import { readMood } from "@/lib/mood/state";
import { moodHistory, type MoodPoint } from "./snapshot";
import { progressiveStage } from "@/lib/persona/stages";

export type Milestone = {
  /** ISO date of the milestone */
  at: string;
  /** machine kind so the UI can pick an icon/label */
  kind: "first_message" | "messages_count" | "anniversary" | "first_side" | "memory";
  /** number payload for messages_count (100, 1000…) or anniversary months */
  value?: number;
  /** free text for memory milestones */
  text?: string;
  /** memory subtype for icon coloring */
  memoryType?: string;
};

export type TimelineData = {
  startedAt: string | null; // first message ever
  daysTogether: number;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  mood: MoodPoint[];
  milestones: Milestone[];
  /** Slow-moving relationship bond, 0..1. */
  closeness: number;
  /** Persona archetype + gender so the page labels itself correctly. */
  archetype: string;
  gender: string;
  /** Earned relationship stage (progressive archetype), else null. */
  stage: string | null;
  /** Her recent nightly diary entries (newest first). */
  diary: { date: string; content: string; mood: string | null }[];
};

const MSG_THRESHOLDS = [100, 500, 1000, 5000, 10000];

/** Assemble everything the relationship timeline needs in one pass. */
export async function buildTimeline(ctx: TenantContext): Promise<TimelineData> {
  // First message + counts (scoped to this user).
  const [first] = await db
    .select({ at: messages.createdAt })
    .from(messages)
    .where(eq(messages.userId, ctx.userId))
    .orderBy(asc(messages.createdAt))
    .limit(1);

  const [counts] = await db
    .select({
      total: count(),
      users: sql<number>`count(*) filter (where ${messages.role} = 'user')`,
      assistants: sql<number>`count(*) filter (where ${messages.role} = 'assistant')`,
    })
    .from(messages)
    .where(eq(messages.userId, ctx.userId));

  const startedAt = first?.at ? new Date(first.at) : null;
  const totalMessages = Number(counts?.total ?? 0);
  const userMessages = Number(counts?.users ?? 0);
  const assistantMessages = Number(counts?.assistants ?? 0);

  const milestones: Milestone[] = [];

  if (startedAt) {
    milestones.push({ at: startedAt.toISOString(), kind: "first_message" });

    // Message-count milestones: find the timestamp of the Nth message.
    for (const n of MSG_THRESHOLDS) {
      if (totalMessages >= n) {
        const [row] = await db
          .select({ at: messages.createdAt })
          .from(messages)
          .where(eq(messages.userId, ctx.userId))
          .orderBy(asc(messages.createdAt))
          .limit(1)
          .offset(n - 1);
        if (row?.at) milestones.push({ at: new Date(row.at).toISOString(), kind: "messages_count", value: n });
      }
    }

    // Monthly / yearly anniversaries that have already passed.
    const now = new Date();
    const anniversaries = [1, 3, 6, 12, 24, 36]; // months
    for (const m of anniversaries) {
      const d = new Date(startedAt);
      d.setMonth(d.getMonth() + m);
      if (d <= now) milestones.push({ at: d.toISOString(), kind: "anniversary", value: m });
    }
  }

  // First side conversation opened.
  const [firstSide] = await db
    .select({ at: conversations.createdAt })
    .from(conversations)
    .where(and(eq(conversations.userId, ctx.userId), eq(conversations.type, "side")))
    .orderBy(asc(conversations.createdAt))
    .limit(1);
  if (firstSide?.at) milestones.push({ at: new Date(firstSide.at).toISOString(), kind: "first_side" });

  // Emotional / moment memories become little story beats on the line.
  const beats = await db
    .select({ at: memories.createdAt, content: memories.content, type: memories.type })
    .from(memories)
    .where(
      and(
        eq(memories.userId, ctx.userId),
        eq(memories.assistantId, ctx.assistantId),
        inArray(memories.type, ["moment", "emotional"]),
      ),
    )
    .orderBy(asc(memories.createdAt))
    .limit(40);
  for (const b of beats) {
    milestones.push({
      at: new Date(b.at).toISOString(),
      kind: "memory",
      text: b.content,
      memoryType: b.type,
    });
  }

  milestones.sort((a, b) => a.at.localeCompare(b.at));

  const daysTogether = startedAt
    ? Math.max(1, Math.ceil((Date.now() - startedAt.getTime()) / 86_400_000))
    : 0;

  const mood = await moodHistory(ctx.assistantId);
  const { closeness } = await readMood(ctx.assistantId);

  const [identity] = await db
    .select({ archetype: assistants.archetype, gender: assistants.gender })
    .from(assistants)
    .where(eq(assistants.id, ctx.assistantId))
    .limit(1);
  const archetype = identity?.archetype ?? "companion";
  const gender = identity?.gender ?? "female";

  const diaryRows = await db
    .select({ date: diaries.localDate, content: diaries.content, mood: diaries.mood })
    .from(diaries)
    .where(eq(diaries.assistantId, ctx.assistantId))
    .orderBy(desc(diaries.localDate))
    .limit(14);

  return {
    startedAt: startedAt?.toISOString() ?? null,
    daysTogether,
    totalMessages,
    userMessages,
    assistantMessages,
    mood,
    milestones,
    closeness,
    archetype,
    gender,
    stage: archetype === "progressive" ? progressiveStage(closeness) : null,
    diary: diaryRows,
  };
}
