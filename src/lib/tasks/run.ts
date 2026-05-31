import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { assistants, conversations, messages, users, type Task } from "@/lib/db/schema";
import { readMood } from "@/lib/mood/state";
import { assembleSystem } from "@/lib/persona/assemble";
import { geminiGenerate } from "@/lib/llm/gemini-native";
import { generateText } from "@/lib/llm/chat";
import { timeContext } from "@/lib/time/awareness";
import { sendPushToUser } from "@/lib/push/send";
import { dueTasks, advanceTask } from "./store";

/** Build the internal instruction that tells her what to proactively say. */
function instructionFor(task: Task, en: boolean): string {
  if (task.kind === "digest") {
    const topic = task.instruction || task.title;
    return en
      ? `Proactively message the user now. Look up current info and briefly summarize: "${topic}". Lead with the key facts, in your own warm voice.`
      : `ابعتي للمستخدم دلوقتي من نفسك. دوّري على المعلومة المحدّثة ولخّصي بإيجاز: "${topic}". هاتي المهم الأول وبطريقتك.`;
  }
  if (task.kind === "nudge") {
    return en
      ? `Proactively check in on the user warmly (you set this reminder): "${task.title}".`
      : `اطمني على المستخدم من نفسك بحنية (إنتي اللي حطّيتي ده): "${task.title}".`;
  }
  // remind
  return en
    ? `Proactively remind the user now, warmly and briefly, about: "${task.title}".`
    : `فكّري المستخدم دلوقتي بحنية واختصار بـ: "${task.title}".`;
}

async function runTask(task: Task): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.id, task.userId)).limit(1);
  const [assistant] = await db
    .select()
    .from(assistants)
    .where(eq(assistants.id, task.assistantId))
    .limit(1);
  if (!user || !assistant) return;

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
    conversationType: "main",
    locale: user.locale,
  });

  const prompt = instructionFor(task, en);
  let text = "";
  try {
    text =
      task.kind === "digest"
        ? await geminiGenerate({ system, prompt, search: true, temperature: 0.7, maxTokens: 700 })
        : await generateText({ system, prompt, temperature: 0.85, maxTokens: 400 });
  } catch {
    text = "";
  }
  if (!text.trim()) return; // don't post empties / quota failures

  await db.insert(messages).values({
    conversationId: targetConversationId,
    userId: task.userId,
    role: "assistant",
    content: text.trim(),
    meta: { proactive: true, taskId: task.id },
  });

  await sendPushToUser(task.userId, {
    title: assistant.name,
    body: text.trim().replace(/\s+/g, " ").slice(0, 120),
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
