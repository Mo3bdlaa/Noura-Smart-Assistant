import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { conversations, messages } from "@/lib/db/schema";
import { generateText } from "@/lib/llm/chat";

const KEEP_RECENT = 20; // turns kept verbatim in the prompt (recentHistory)
const MIN_TO_FOLD = 12; // wait until enough older turns pile up before summarizing

/** The conversation's rolling summary (older turns folded into a short recap). */
export async function getConversationSummary(conversationId: string): Promise<string | null> {
  const [row] = await db
    .select({ summary: conversations.summary })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  return row?.summary ?? null;
}

/**
 * Fold the older turns (everything but the most recent KEEP_RECENT) into a compact
 * running summary, so very long chats keep continuity without ballooning the prompt
 * or making her forget. Incremental + idempotent: only summarizes turns newer than
 * what's already folded, and only once enough have accumulated.
 */
export async function maybeSummarize(conversationId: string, locale: "ar" | "en"): Promise<void> {
  const [conv] = await db
    .select({ summary: conversations.summary, through: conversations.summaryThrough })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!conv) return;

  const all = await db
    .select({ role: messages.role, content: messages.content, createdAt: messages.createdAt })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));
  if (all.length <= KEEP_RECENT + MIN_TO_FOLD) return;

  const older = all.slice(0, all.length - KEEP_RECENT);
  const through = conv.through ? new Date(conv.through) : null;
  const foldable = older.filter(
    (m) => m.role !== "system" && (!through || new Date(m.createdAt) > through),
  );
  if (foldable.length < MIN_TO_FOLD) return;

  const convoText = foldable
    .map((m) => `${m.role === "user" ? "هو" : "هي"}: ${m.content}`)
    .join("\n")
    .slice(0, 6000);

  const system =
    locale === "en"
      ? "You maintain a running memory summary of a conversation. Merge the OLD summary with the NEW turns into one concise summary that preserves: key facts, open threads, promises/plans, and important feelings/events. Bullet points, ≤ 180 words. Output only the summary."
      : "بتحافظي على ملخص جارٍ لمحادثة. ادمجي الملخص القديم مع الكلام الجديد في ملخص واحد مختصر يحفظ: الحقائق المهمة، المواضيع المفتوحة، الوعود والخطط، والمشاعر/الأحداث المهمة. نقط، ≤ 180 كلمة. اطبعي الملخص بس.";
  const prompt =
    (conv.summary ? `الملخص القديم:\n${conv.summary}\n\n` : "") + `كلام جديد:\n${convoText}`;

  try {
    const summary = (await generateText({ system, prompt, temperature: 0.3, maxTokens: 400 }))?.trim();
    if (summary) {
      await db
        .update(conversations)
        .set({ summary: summary.slice(0, 2000), summaryThrough: foldable[foldable.length - 1]!.createdAt })
        .where(eq(conversations.id, conversationId));
    }
  } catch {
    /* summary is best-effort */
  }
}
