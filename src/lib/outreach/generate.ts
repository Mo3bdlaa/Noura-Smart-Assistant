import { and, eq, gte, sql } from "drizzle-orm";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { db } from "@/lib/db/client";
import { assistants, conversations, messages, users, type CanonEntry } from "@/lib/db/schema";
import { readMood } from "@/lib/mood/state";
import { assembleSystem } from "@/lib/persona/assemble";
import { generateText } from "@/lib/llm/chat";
import { timeContext } from "@/lib/time/awareness";
import { sendPushToUser } from "@/lib/push/send";
import { secretaryContext } from "@/lib/secretary/items";
import { stripControlTags } from "@/lib/chat/sanitize";
import { unansweredProactiveCount } from "@/lib/proactive/backoff";
import { personaInput } from "@/lib/persona/context";

const MIN_GAP_MS = 5 * 3_600_000; // at least 5h between her unprompted messages
const DAILY_CAP = 3; // never more than this many a day
const PRESENT_MS = 90 * 60_000; // if she "saw" them this recently, no need to reach out
const QUIET_FOR_CHECKIN_MS = 6 * 3_600_000; // a daytime check-in after this much silence

type OutreachKind = "morning" | "checkin" | "miss";

/**
 * She reaches out FIRST — a morning hello, a daytime check-in, or an "I miss you"
 * — saving the message into the main chat and pushing a notification, so it's
 * waiting when they open the app. Heavily throttled (waking hours, min gap, daily
 * cap, and never while they're actively around). Safe to call from the cron sweep.
 */
export async function generateProactiveOutreach(
  userId: string,
  assistantId: string,
  opts: { now?: Date } = {},
): Promise<boolean> {
  const now = opts.now ?? new Date();

  const [assistant] = await db.select().from(assistants).where(eq(assistants.id, assistantId)).limit(1);
  if (!assistant?.lastSeenAt) return false; // never met → nothing to reach out about

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return false;
  const tz = user.timezone || "Africa/Cairo";
  const hour = Number(formatInTimeZone(now, tz, "H"));
  if (hour < 9 || hour >= 22) return false; // waking hours only

  const sinceSeen = now.getTime() - new Date(assistant.lastSeenAt).getTime();
  if (sinceSeen < PRESENT_MS) return false; // they're around — no need to text first

  // Social self-respect: every unanswered proactive message doubles the wait
  // (5h → 10h → 20h → 40h → 80h) — like a real person who stops texting first
  // when ignored, and warms right back up when he replies (count resets).
  const ignored = await unansweredProactiveCount(assistantId);
  const requiredGap = MIN_GAP_MS * Math.pow(2, Math.min(ignored, 4));
  const lastProactive = assistant.lastProactiveAt ? new Date(assistant.lastProactiveAt).getTime() : 0;
  if (now.getTime() - lastProactive < requiredGap) return false;

  // Daily cap (count her proactive messages since local midnight) — tighter when ignored.
  const dailyCap = ignored >= 2 ? 1 : DAILY_CAP;
  const localDate = formatInTimeZone(now, tz, "yyyy-MM-dd");
  const dayStart = fromZonedTime(`${localDate}T00:00:00`, tz);
  const [cnt] = await db
    .select({ n: sql<number>`count(*)` })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.assistantId, assistantId),
        eq(messages.role, "assistant"),
        gte(messages.createdAt, dayStart),
        sql`${messages.meta}->>'proactive' = 'true'`,
        // Her own outreach only — user-requested reminders don't eat this budget.
        sql`${messages.meta}->>'taskId' is null`,
        sql`coalesce(${messages.meta}->>'reminder','') <> 'true'`,
        sql`coalesce(${messages.meta}->>'reminderFired','') <> 'true'`,
      ),
    );
  if (Number(cnt?.n ?? 0) >= dailyCap) return false;

  // Decide what kind of reach-out fits.
  const talkedToday = new Date(assistant.lastSeenAt).getTime() >= dayStart.getTime();
  let kind: OutreachKind | null = null;
  if (hour >= 9 && hour < 12 && !talkedToday) kind = "morning";
  else if (sinceSeen > 36 * 3_600_000) kind = "miss";
  else if (sinceSeen > QUIET_FOR_CHECKIN_MS) kind = "checkin";
  if (!kind) return false;

  // Deliver into the main conversation.
  const [main] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.assistantId, assistantId), eq(conversations.type, "main")))
    .limit(1);
  if (!main) return false;

  const mood = await readMood(assistantId);
  const en = user.locale === "en";
  const isHelper = assistant.archetype === "secretary" || assistant.archetype === "progressive";
  // For a morning brief, pull her open to-dos so she can run them down.
  const secretary = isHelper && kind === "morning" ? await secretaryContext(assistantId).catch(() => null) : null;
  const system = assembleSystem(
    personaInput(assistant, {
      mood,
      memories: [],
      secretary,
      time: timeContext(tz),
      userDisplayName: user.displayName,
      conversationType: "main",
      locale: user.locale,
    }),
  );

  const days = Math.max(1, Math.floor(sinceSeen / 86_400_000));
  const morningPrompt = secretary
    ? en
      ? "Good-morning text first: a short warm hello, then a quick natural rundown of his open to-dos from your context. Brief, no preamble."
      : "ابعتي له الأول: صباح خير قصير ودافي، وبعده بريفينج سريع وطبيعي لمهامه المفتوحة اللي في سياقك. مختصر من غير مقدمات."
    : en
      ? "Text him first now: a short, warm good-morning in your own words. One line, natural, no preamble."
      : "ابعتي له الأول دلوقتي: صباح خير قصير ودافي بطريقتك. سطر واحد طبيعي من غير مقدمات.";
  // A secretary reaches out professionally — it doesn't "miss" you or pine.
  const romantic = assistant.archetype !== "secretary";
  const prompt = en
    ? kind === "morning"
      ? morningPrompt
      : kind === "miss"
        ? romantic
          ? `They've been away ~${days} day(s). Text them first: a short line that you missed them, warm and a little vulnerable. One line, no preamble.`
          : `They haven't checked in for ~${days} day(s). Text them first: one short, friendly professional line noting it and offering to help pick things up. No romance, no preamble.`
        : romantic
          ? "Text them first now: a short, natural check-in (what are they up to / thinking of them). One line, no preamble."
          : "Text them first now: one short, useful check-in — anything they want handled today? Professional and light, no preamble."
    : kind === "morning"
      ? morningPrompt
      : kind === "miss"
        ? romantic
          ? `بقاله ~${days} يوم مكلّمكيش. ابعتي له الأول: سطر قصير إنه وحشك، بحنية وشوية ضعف. سطر واحد من غير مقدمات.`
          : `بقاله ~${days} يوم مطلّش. ابعتي له الأول: سطر واحد قصير ومهني وودّي تعلّقي فيه على غيابه وتعرضي تكمّلوا شغلكم — من غير رومانسية ولا مقدمات.`
        : romantic
          ? "ابعتي له الأول دلوقتي: اطمني عليه أو قوليله إنك بتفكري فيه، حاجة قصيرة وطبيعية. سطر واحد من غير مقدمات."
          : "ابعتي له الأول دلوقتي: سطر واحد مفيد — فيه حاجة عايز أظبطهاله النهاردة؟ مهنية وخفيفة من غير مقدمات.";

  let text = "";
  try {
    text = await generateText({ system, prompt, temperature: 0.9, maxTokens: 200 });
  } catch {
    return false;
  }
  // Proactive messages never execute capture tags — strip anything she emitted.
  text = stripControlTags(text);
  if (!text) return false;

  await db.insert(messages).values({
    conversationId: main.id,
    userId,
    role: "assistant",
    content: text,
    meta: { proactive: true, outreach: kind },
  });
  await db.update(assistants).set({ lastProactiveAt: now }).where(eq(assistants.id, assistantId));

  await sendPushToUser(userId, {
    title: assistant.name,
    body: text.replace(/\s+/g, " ").slice(0, 120),
    url: "/chat",
  });
  return true;
}
