import { generateText } from "@/lib/llm/chat";
import type { ChatTurn } from "@/lib/llm/chat";

/** Generate a short (2–4 word) title for a conversation from its first turns. */
export async function generateTitle(history: ChatTurn[], locale: "ar" | "en"): Promise<string> {
  const snippet = history
    .slice(0, 6)
    .map((t) => `${t.role === "user" ? "U" : "A"}: ${t.content}`)
    .join("\n")
    .slice(0, 1200);

  const system =
    locale === "en"
      ? "You write very short chat titles. Output ONLY the title: 2–4 words, no quotes, no punctuation at the end."
      : "بتكتب عنوان قصير جدًا لمحادثة. اطبع العنوان بس: ٢-٤ كلمات، من غير علامات اقتباس ولا نقطة آخره.";

  const title = await generateText({
    system,
    prompt: (locale === "en" ? "Title this chat:\n" : "اعمل عنوان للمحادثة دي:\n") + snippet,
    temperature: 0.4,
    maxTokens: 20,
  });
  return title.replace(/["'«»\n]/g, "").trim().slice(0, 40);
}
