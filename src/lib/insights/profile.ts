import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { conversations, memories, messages, personalityProfiles, type PersonalityProfile } from "@/lib/db/schema";
import { generateJson } from "@/lib/llm/chat";

export type ProfileReport = {
  summary?: string;
  traits?: { name: string; note: string }[];
  communication_style?: string;
  interests?: string[];
  values?: string[];
  emotional_patterns?: string;
  how_to_support?: string;
};

export async function getProfile(assistantId: string): Promise<PersonalityProfile | null> {
  const [row] = await db
    .select()
    .from(personalityProfiles)
    .where(eq(personalityProfiles.assistantId, assistantId))
    .limit(1);
  return row ?? null;
}

/** Count the user's real (non-incognito) messages — drives the refresh cadence. */
async function realMessageCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(and(eq(conversations.userId, userId), ne(conversations.type, "incognito")));
  return row?.n ?? 0;
}

/** Rebuild the personality report from recent conversation + memories. */
export async function regenerateProfile(
  userId: string,
  assistantId: string,
  locale: "ar" | "en",
): Promise<void> {
  const msgs = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(and(eq(conversations.userId, userId), ne(conversations.type, "incognito")))
    .orderBy(desc(messages.createdAt))
    .limit(60);

  const mems = await db
    .select({ content: memories.content })
    .from(memories)
    .where(eq(memories.assistantId, assistantId))
    .limit(60);

  if (msgs.length < 2) return;

  const transcript = msgs
    .reverse()
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n")
    .slice(0, 6000);
  const memText = mems.map((m) => `- ${m.content}`).join("\n").slice(0, 2000);

  const system =
    locale === "en"
      ? "You are a perceptive psychologist. From the chat + memories, write an honest, nuanced personality read of the USER (not the assistant). Output JSON only."
      : "إنتي محلّلة نفسية فاهمة. من المحادثة + الذكريات، اكتبي قراءة صادقة ودقيقة لشخصية المستخدم (مش المساعد). اطبعي JSON بس.";

  const prompt = `Memories:\n${memText}\n\nRecent conversation:\n${transcript}\n\nReturn JSON exactly:
{
  "summary": "one warm, honest paragraph about who they are",
  "traits": [{"name":"trait","note":"short evidence"}],
  "communication_style": "how they talk/express",
  "interests": ["..."],
  "values": ["what matters to them"],
  "emotional_patterns": "moods, triggers, what lifts them",
  "how_to_support": "how to be there for them"
}
Write the text values in ${locale === "en" ? "English" : "Egyptian Arabic"}.`;

  const report = await generateJson<ProfileReport>({ system, prompt, temperature: 0.5 });
  if (!report) return;

  const count = await realMessageCount(userId);
  await db
    .insert(personalityProfiles)
    .values({
      assistantId,
      userId,
      summary: report.summary ?? null,
      report,
      messageCountAtUpdate: count,
    })
    .onConflictDoUpdate({
      target: personalityProfiles.assistantId,
      set: { summary: report.summary ?? null, report, messageCountAtUpdate: count, updatedAt: new Date() },
    });
}

/** Refresh the profile every few new messages (cheap throttle). Best-effort. */
export async function maybeUpdateProfile(
  userId: string,
  assistantId: string,
  locale: "ar" | "en",
): Promise<void> {
  const existing = await getProfile(assistantId);
  const count = await realMessageCount(userId);
  const since = count - (existing?.messageCountAtUpdate ?? 0);
  if (existing && since < 6) return;
  if (!existing && count < 3) return;
  await regenerateProfile(userId, assistantId, locale);
}
