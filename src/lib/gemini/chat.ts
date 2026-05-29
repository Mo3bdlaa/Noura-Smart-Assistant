import type { Content } from "@google/genai";
import { CHAT_MODEL, withGemini } from "./client";

export type ChatTurn = { role: "user" | "assistant"; content: string };

function toContents(history: ChatTurn[]): Content[] {
  return history.map((t) => ({
    role: t.role === "assistant" ? "model" : "user",
    parts: [{ text: t.content }],
  }));
}

/**
 * Stream Noura's reply token-by-token. `system` is the fully-assembled persona +
 * state + memory + directive block from src/lib/persona/assemble.ts.
 */
export async function* streamChat(opts: {
  system: string;
  history: ChatTurn[];
  temperature?: number;
}): AsyncGenerator<string> {
  const stream = await withGemini((ai) =>
    ai.models.generateContentStream({
      model: CHAT_MODEL,
      contents: toContents(opts.history),
      config: {
        systemInstruction: opts.system,
        temperature: opts.temperature ?? 0.9,
        maxOutputTokens: 1200,
      },
    }),
  );

  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) yield text;
  }
}

/** One-shot JSON generation (used by the consolidated reflection call). */
export async function generateJson<T = unknown>(opts: {
  system: string;
  prompt: string;
  temperature?: number;
}): Promise<T | null> {
  const res = await withGemini((ai) =>
    ai.models.generateContent({
      model: CHAT_MODEL,
      contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
      config: {
        systemInstruction: opts.system,
        temperature: opts.temperature ?? 0.4,
        responseMimeType: "application/json",
      },
    }),
  );
  const text = res.text;
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    // Best-effort: strip code fences / extract first JSON object.
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
