import type OpenAI from "openai";
import { getClient, withLlm } from "./client";

export type ChatTurn = { role: "user" | "assistant"; content: string };

type Msg = OpenAI.Chat.Completions.ChatCompletionMessageParam;

function toMessages(system: string, history: ChatTurn[], images?: string[]): Msg[] {
  const msgs: Msg[] = [{ role: "system", content: system }];
  history.forEach((t, i) => {
    const isLastUser = i === history.length - 1 && t.role === "user";
    if (isLastUser && images && images.length) {
      msgs.push({
        role: "user",
        content: [
          ...(t.content ? [{ type: "text" as const, text: t.content }] : []),
          ...images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
        ],
      });
    } else {
      msgs.push({ role: t.role === "assistant" ? "assistant" : "user", content: t.content });
    }
  });
  return msgs;
}

/**
 * Stream the assistant's reply token-by-token. `system` is the fully-assembled
 * persona + state + memory + directive block (src/lib/persona/assemble.ts).
 * `images` (data URLs) attach to the latest user turn for multimodal models.
 */
export async function* streamChat(opts: {
  system: string;
  history: ChatTurn[];
  images?: string[];
  temperature?: number;
}): AsyncGenerator<string> {
  const { client, config } = await getClient();
  // Build params; for Gemini's OpenAI-compat endpoint, disable "thinking" so no
  // internal reasoning ever leaks into the reply (and it's faster).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any = {
    model: config.chatModel,
    messages: toMessages(opts.system, opts.history, opts.images),
    temperature: opts.temperature ?? 0.9,
    max_tokens: 1200,
    stream: true,
  };
  if (config.baseURL.includes("generativelanguage")) {
    params.reasoning_effort = "none";
  }
  const stream = (await withLlm(() =>
    client.chat.completions.create(params),
  )) as unknown as AsyncIterable<{ choices?: Array<{ delta?: { content?: string | null } }> }>;

  // We only ever surface `delta.content` — never any separate reasoning channel.
  for await (const chunk of stream) {
    const text = chunk.choices?.[0]?.delta?.content;
    if (text) yield text;
  }
}

/** One-shot plain-text generation. */
export async function generateText(opts: {
  system: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const { client, config } = await getClient();
  const res = await withLlm(() =>
    client.chat.completions.create({
      model: config.chatModel,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.prompt },
      ],
      temperature: opts.temperature ?? 0.6,
      max_tokens: opts.maxTokens ?? 600,
    }),
  );
  return res.choices[0]?.message?.content?.trim() ?? "";
}

/** One-shot JSON generation (used by the consolidated reflection call). */
export async function generateJson<T = unknown>(opts: {
  system: string;
  prompt: string;
  temperature?: number;
}): Promise<T | null> {
  const { client, config } = await getClient();
  const res = await withLlm(() =>
    client.chat.completions.create({
      model: config.chatModel,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.prompt },
      ],
      temperature: opts.temperature ?? 0.4,
      response_format: { type: "json_object" },
    }),
  );
  const text = res.choices[0]?.message?.content;
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    // some providers wrap JSON in prose/fences — salvage the first {...} block
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
