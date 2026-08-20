import { and, eq } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/db/client";
import { assistants, conversations, messages, taskCompletions, users, type Task } from "@/lib/db/schema";
import { readMood } from "@/lib/mood/state";
import { assembleSystem } from "@/lib/persona/assemble";
import { generateText } from "@/lib/llm/chat";
import { timeContext } from "@/lib/time/awareness";
import { sendPushToUser } from "@/lib/push/send";
import { stripControlTags } from "@/lib/chat/sanitize";
import { personaInput } from "@/lib/persona/context";
import { dueTasks, advanceTask } from "./store";

/**
 * How late this run is, in minutes. On a once-daily cron a 9am reminder can be
 * delivered hours late; she should own that instead of pretending it's on time.
 */
function latenessNote(task: Task, en: boolean, now: Date): string {
  const lateMs = now.getTime() - new Date(task.nextRunAt).getTime();
  const mins = Math.floor(lateMs / 60_000);
  if (mins < 45) return ""; // close enough to "on time"
  const hrs = Math.round(mins / 60);
  return en
    ? ` This is ~${hrs}h later than the scheduled time — briefly acknowledge you're late instead of pretending otherwise.`
    : ` إنتي متأخرة حوالي ${hrs} ساعة عن الميعاد — اعترفي بالتأخير في كلمتين بدل ما تتجاهليه.`;
}

/** Build the internal instruction that tells her what to proactively say. */
function instructionFor(task: Task, en: boolean): string {
  if (task.kind === "digest") {
    const topic = task.instruction || task.title;
    return en
      ? `Proactively message the user now. Look up current info and briefly summarize: "${topic}". Lead with the key facts, in your own warm voice.`
      : `ابعتي للمستخدم دلوقتي من نفسك. دوّري على المعلومة المحدّثة ولخّصي بإيجاز: "${topic}". هاتي المهم الأول وبطريقتك.`;
  }
  const details = task.instruction?.trim();
  if (task.kind === "nudge") {
    return en
      ? `Proactively check in on the user warmly (you set this reminder): "${task.title}". One short message, no questions piling up.`
      : `اطمني على المستخدم من نفسك (إنتي اللي حطّيتي ده): "${task.title}". رسالة واحدة قصيرة من غير أسئلة كتير.`;
  }
  // remind — include any details the user gave so the message is useful.
  return en
    ? `Proactively remind the user now, briefly and naturally, about: "${task.title}".${
        details ? ` Include these details: ${details}.` : ""
      } One short message. Do NOT emit any control tags.`
    : `فكّري المستخدم دلوقتي باختصار وبطبيعية بـ: "${task.title}".${
        details ? ` ولازم تقولي التفاصيل دي: ${details}.` : ""
      } رسالة واحدة قصيرة، ومن غير أي تاجات.`;
}

/** Is this recurring task already checked off for the user's local day? */
async function completedToday(task: Task, tz: string, now: Date): Promise<boolean> {
  if (task.recurrence === "once") return false; // one-offs deactivate when done
  const day = formatInTimeZone(now, tz || "Africa/Cairo", "yyyy-MM-dd");
  const [row] = await db
    .select({ id: taskCompletions.id })
    .from(taskCompletions)
    .where(and(eq(taskCompletions.taskId, task.id), eq(taskCompletions.day, day)))
    .limit(1);
  return !!row;
}

async function runTask(task: Task): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.id, task.userId)).limit(1);
  const [assistant] = await db
    .select()
    .from(assistants)
    .where(eq(assistants.id, task.assistantId))
    .limit(1);
  if (!user || !assistant) return;

  // Already done today (user checked it off) → don't nag about it again.
  if ((task.kind === "remind" || task.kind === "nudge") && (await completedToday(task, user.timezone, new Date()))) {
    return;
  }

  // Deliver into the conversation the task was set in; fall back to main.
  let targetConversationId: string | null = null;
  if (task.conversationId) {
    const [c] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, task.conversationId))
      .limit(1);
    targetConversationId = c?.id ?? null;
  }
  if (!targetConversationId) {
    const [main] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.assistantId, task.assistantId), eq(conversations.type, "main")))
      .limit(1);
    targetConversationId = main?.id ?? null;
  }
  if (!targetConversationId) return;

  const en = user.locale === "en";
  const mood = await readMood(task.assistantId);
  const system = assembleSystem(
    personaInput(assistant, {
      mood,
      memories: [],
      time: timeContext(user.timezone),
      userDisplayName: user.displayName,
      conversationType: "main",
      locale: user.locale,
    }),
  );

  const prompt = instructionFor(task, en) + latenessNote(task, en, new Date());
  let text = "";
  try {
    text =
      task.kind === "digest"
        ? await generateText({ system, prompt, search: true, temperature: 0.7, maxTokens: 700 })
        : await generateText({ system, prompt, temperature: 0.85, maxTokens: 400 });
  } catch {
    text = "";
  }
  // Proactive messages never execute capture tags — strip anything the model emitted.
  text = stripControlTags(text);
  if (!text) return; // don't post empties / quota failures

  await db.insert(messages).values({
    conversationId: targetConversationId,
    userId: task.userId,
    role: "assistant",
    content: text,
    meta: { proactive: true, taskId: task.id, reminder: task.kind === "remind" },
  });

  await sendPushToUser(task.userId, {
    title: assistant.name,
    body: text.replace(/\s+/g, " ").slice(0, 120),
    url: "/chat",
  });
}

/** Run all due tasks. Safe to call from cron + activity-driven paths. */
export async function runDueTasks(now = new Date()): Promise<number> {
  const due = await dueTasks(now);
  let ran = 0;
  for (const task of due) {
    // advance first so a slow/failed run can't double-fire on the next tick
    await advanceTask(task, now);
    try {
      await runTask(task);
      ran++;
    } catch {
      /* swallow — a failed task shouldn't break the whole sweep */
    }
  }
  return ran;
}
