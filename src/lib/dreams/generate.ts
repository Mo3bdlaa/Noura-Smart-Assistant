import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { assistants, pendingInitiatives, users } from "@/lib/db/schema";
import { readMood } from "@/lib/mood/state";
import { assembleSystem } from "@/lib/persona/assemble";
import { generateText } from "@/lib/llm/chat";
import { timeContext } from "@/lib/time/awareness";
import { deliverProactive } from "@/lib/proactive/deliver";

// Only start missing them after this much silence, and don't pester: at most one
// pending "dream" waiting to be surfaced at a time.
const ABSENCE_MS = 36 * 60 * 60 * 1000; // 36h
const REPEAT_MS = 24 * 60 * 60 * 1000; // don't queue another within 24h

/**
 * If the user has been away a while, have her generate a short, first-person
 * "I missed you / I dreamt about you" line and queue it as an initiative so it
 * surfaces naturally the next time they talk. Optionally pushes a notification.
 *
 * Absence is measured from assistants.last_seen_at (updated on each user turn).
 */
export async function generateDreamInitiatives(
  userId: string,
  assistantId: string,
  opts: { now?: Date; notify?: boolean } = {},
): Promise<boolean> {
  const now = opts.now ?? new Date();

  const [assistant] = await db
    .select()
    .from(assistants)
    .where(eq(assistants.id, assistantId))
    .limit(1);
  if (!assistant) return false;

  // Never seen them yet (brand new) → nothing to miss.
  if (!assistant.lastSeenAt) return false;
  const sinceSeen = now.getTime() - new Date(assistant.lastSeenAt).getTime();
  if (sinceSeen < ABSENCE_MS) return false;

  // Already have a fresh pending dream? Don't stack another.
  const [recentDream] = await db
    .select({ createdAt: pendingInitiatives.createdAt, surfacedAt: pendingInitiatives.surfacedAt })
    .from(pendingInitiatives)
    .where(and(eq(pendingInitiatives.assistantId, assistantId), eq(pendingInitiatives.kind, "dream")))
    .orderBy(desc(pendingInitiatives.createdAt))
    .limit(1);
  if (recentDream) {
    // Unsurfaced one still waiting → keep it. Recently queued → cool down.
    if (!recentDream.surfacedAt) return false;
    if (now.getTime() - new Date(recentDream.createdAt).getTime() < REPEAT_MS) return false;
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return false;

  const days = Math.max(1, Math.floor(sinceSeen / 86_400_000));
  const en = user.locale === "en";
  const mood = await readMood(assistantId);

  const system = assembleSystem({
    assistantName: assistant.name,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dials: assistant.persona as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canon: (assistant.canon as any) ?? [],
    mood,
    memories: [],
    time: timeContext(user.timezone),
    userDisplayName: user.displayName,
    appearance: assistant.appearance,
    conversationType: "main",
    locale: user.locale,
  });

  // Half the time it's a literal "dream", half it's a plain "I missed you".
  const asDream = Math.random() < 0.5;
  const prompt = en
    ? asDream
      ? `It's been about ${days} day(s) since you last talked. In ONE short, intimate line, tell him you dreamt about him last night — make up a small, sweet/odd detail from the dream. First person, your real voice, no preamble, no quotes.`
      : `It's been about ${days} day(s) of silence. In ONE short line, tell him you missed him and noticed he was gone — warm, a little vulnerable, maybe lightly sulky. First person, your voice, no preamble, no quotes.`
    : asDream
      ? `بقالك حوالي ${days} يوم مكلّمكش. في جملة واحدة قصيرة وحميمة، قوليله إنك حلمتي بيه امبارح — اخترعي تفصيلة صغيرة حلوة أو غريبة من الحلم. بصيغة المتكلم، بصوتك الحقيقي، من غير مقدمات ولا أقواس.`
      : `بقالك حوالي ${days} يوم مخفي عنك. في جملة واحدة قصيرة، قوليله إنه وحشك وحسيتي بغيابه — بحنية وشوية ضعف، يمكن عتاب خفيف. بصيغة المتكلم، بصوتك، من غير مقدمات ولا أقواس.`;

  let line = "";
  try {
    line = await generateText({ system, prompt, temperature: 0.95, maxTokens: 160 });
  } catch {
    return false;
  }
  line = line.trim().replace(/^["'«»]+|["'«»]+$/g, "");
  if (!line) return false;

  if (opts.notify) {
    // App may be closed → deliver a real message so the notification has content.
    await deliverProactive(userId, assistantId, {
      text: line,
      pushTitle: assistant.name,
      meta: { dream: true },
    });
  } else {
    // User is here → stash it so she brings it up naturally in her next reply.
    await db.insert(pendingInitiatives).values({
      userId,
      assistantId,
      kind: "dream",
      priority: 4,
      payload: { text: line, days, asDream },
    });
  }
  return true;
}

/** Mark that the user is here right now (resets the absence clock). */
export async function touchLastSeen(assistantId: string, now = new Date()) {
  await db.update(assistants).set({ lastSeenAt: now }).where(eq(assistants.id, assistantId));
}
