import type OpenAI from "openai";
import { getClient, withLlmKeyed } from "./client";
import { resolveRole, type LlmRole } from "./config";
import { getRoleKeys } from "./keys";
import { geminiGenerate, geminiStream, type RoleCfg } from "./gemini-native";

export type ChatTurn = { role: "user" | "assistant"; content: string };

type Msg = OpenAI.Chat.Completions.ChatCompletionMessageParam;

function isGemini(baseURL: string): boolean {
  return baseURL.includes("generativelanguage");
}

/** Effective base URL + model + key pool for a role. */
async function roleCfg(role: LlmRole): Promise<RoleCfg> {
  const [{ baseURL, model }, keys] = await Promise.all([resolveRole(role), getRoleKeys(role)]);
  return { baseURL, model, keys };
}

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

function parseJsonLoose<T>(text: string | null | undefined): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
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

/**
 * Stream the assistant's reply token-by-token. `system` is the fully-assembled
 * persona + state + memory + directive block (src/lib/persona/assemble.ts).
 * `images` (data URLs) attach to the latest user turn for multimodal models.
 *
 * On Gemini we use the native backend (safety filters off + thinking off);
 * other providers go through the OpenAI-compatible endpoint.
 */
export async function* streamChat(opts: {
  system: string;
  history: ChatTurn[];
  images?: string[];
  temperature?: number;
}): AsyncGenerator<string> {
  const cfg = await roleCfg("chat");
  if (isGemini(cfg.baseURL)) {
    yield* geminiStream(opts, cfg);
    return;
  }

  const stream = (await withLlmKeyed(cfg.keys, (key) =>
    getClient(key, cfg.baseURL).chat.completions.create({
      model: cfg.model,
      messages: toMessages(opts.system, opts.history, opts.images),
      temperature: opts.temperature ?? 0.9,
      max_tokens: 1200,
      stream: true,
    }),
  )) as unknown as AsyncIterable<{ choices?: Array<{ delta?: { content?: string | null } }> }>;

  for await (const chunk of stream) {
    const text = chunk.choices?.[0]?.delta?.content;
    if (text) yield text;
  }
}

/**
 * One-shot plain-text generation. `search` (web grounding) uses the chat model
 * + Gemini's google_search when available; otherwise the lighter utility model.
 */
export async function generateText(opts: {
  system: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  search?: boolean;
}): Promise<string> {
  const cfg = await roleCfg(opts.search ? "chat" : "utility");
  if (isGemini(cfg.baseURL)) {
    return geminiGenerate(
      { system: opts.system, prompt: opts.prompt, temperature: opts.temperature, maxTokens: opts.maxTokens, search: opts.search },
      cfg,
    );
  }
  const res = await withLlmKeyed(cfg.keys, (key) =>
    getClient(key, cfg.baseURL).chat.completions.create({
      model: cfg.model,
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
  const cfg = await roleCfg("utility");
  if (isGemini(cfg.baseURL)) {
    const text = await geminiGenerate({ ...opts, json: true }, cfg);
    return parseJsonLoose<T>(text);
  }
  const res = await withLlmKeyed(cfg.keys, (key) =>
    getClient(key, cfg.baseURL).chat.completions.create({
      model: cfg.model,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.prompt },
      ],
      temperature: opts.temperature ?? 0.4,
      response_format: { type: "json_object" },
    }),
  );
  return parseJsonLoose<T>(res.choices[0]?.message?.content);
}
