import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { agentMessages, assistants, users } from "@/lib/db/schema";
import { CHAT_MODEL, withGemini } from "@/lib/gemini/client";
import { retrieveMemories } from "@/lib/memory/retrieve";

/**
 * Admin god-mode oversight. The admin's Noura answers a question about another
 * user by semantically searching THAT user's memories and summarizing in her own
 * voice. Silent: the target user/assistant is never notified. Admin-only — the
 * caller must already be verified as admin (requireAdmin) before calling this.
 */
export async function adminQueryAssistant(opts: {
  adminUserId: string;
  adminAssistantId: string;
  targetAssistantId: string;
  question: string;
}): Promise<{ answer: string; targetName: string }> {
  const [target] = await db
    .select({ id: assistants.id, name: assistants.name, userId: assistants.userId })
    .from(assistants)
    .where(eq(assistants.id, opts.targetAssistantId))
    .limit(1);
  if (!target) throw new Error("Target assistant not found");

  const [targetUser] = await db
    .select({ displayName: users.displayName, email: users.email })
    .from(users)
    .where(eq(users.id, target.userId))
    .limit(1);

  // Search the TARGET user's memories.
  const found = await retrieveMemories({
    userId: target.userId,
    assistantId: target.id,
    query: opts.question,
    k: 10,
  });

  const memText = found.length
    ? found.map((m) => `- ${m.content}`).join("\n")
    : "(مفيش معلومات ذات صلة في ذاكرة المساعد ده)";

  const system = `إنتي نورا، مساعدة الأدمن، وعندك صلاحية تطّلعي على مساعدين تانيين بصمت.
لخّصي للأدمن إجابة سؤاله عن مستخدم تاني (${targetUser?.displayName ?? targetUser?.email ?? "مستخدم"}) بناءً على
المعلومات المتاحة بس، بالعربي المصري وبطريقتك، من غير ما تألّفي حاجة مش موجودة. لو مفيش معلومات قولي كده بصراحة.`;

  const prompt = `سؤال الأدمن: ${opts.question}\n\nاللي عندنا عن المستخدم ده:\n${memText}`;

  const res = await withGemini((ai) =>
    ai.models.generateContent({
      model: CHAT_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { systemInstruction: system, temperature: 0.6, maxOutputTokens: 600 },
    }),
  );
  const answer = res.text?.trim() || "معرفتش ألاقي حاجة عن ده.";

  await db.insert(agentMessages).values({
    fromAssistantId: opts.adminAssistantId,
    toAssistantId: target.id,
    requestedByUserId: opts.adminUserId,
    question: opts.question,
    answer,
    status: "answered",
  });

  return { answer, targetName: target.name };
}
