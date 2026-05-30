import { getLlmConfig } from "./config";
import { withLlm } from "./client";
import type { ChatTurn } from "./chat";

/**
 * Native Gemini backend (REST). Used when the provider is Gemini, because the
 * OpenAI-compatible endpoint can't carry Gemini-only options. Here we:
 *  - disable ALL safety filters (BLOCK_NONE) — owner's key, owner's app
 *  - disable "thinking" (thinkingBudget 0) so no reasoning leaks + faster
 * Other providers keep going through the OpenAI-compatible path (src/lib/llm/chat).
 */
const SAFETY = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
  "HARM_CATEGORY_CIVIC_INTEGRITY",
].map((category) => ({ category, threshold: "BLOCK_NONE" }));

// OpenAI-compat base ".../v1beta/openai/" → native ".../v1beta/"
function nativeBase(baseURL: string): string {
  return baseURL.replace(/openai\/?$/, "");
}

function dataUrlToInline(url: string): { mimeType: string; data: string } | null {
  const m = url.match(/^data:([^;]+);base64,(.*)$/);
  return m ? { mimeType: m[1]!, data: m[2]! } : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toContents(history: ChatTurn[], images?: string[]): any[] {
  return history.map((t, i) => {
    const isLastUser = i === history.length - 1 && t.role === "user";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [];
    if (t.content) parts.push({ text: t.content });
    if (isLastUser && images?.length) {
      for (const u of images) {
        const inl = dataUrlToInline(u);
        if (inl) parts.push({ inlineData: inl });
      }
    }
    if (parts.length === 0) parts.push({ text: "" });
    return { role: t.role === "assistant" ? "model" : "user", parts };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractText(data: any): string {
  return (
    data?.candidates?.[0]?.content?.parts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ?.map((p: any) => p.text)
      .filter(Boolean)
      .join("") ?? ""
  );
}

export async function* geminiStream(opts: {
  system: string;
  history: ChatTurn[];
  images?: string[];
  temperature?: number;
}): AsyncGenerator<string> {
  const cfg = await getLlmConfig();
  const url = `${nativeBase(cfg.baseURL)}models/${cfg.chatModel}:streamGenerateContent?alt=sse&key=${encodeURIComponent(cfg.apiKey)}`;
  const body = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: toContents(opts.history, opts.images),
    safetySettings: SAFETY,
    generationConfig: {
      temperature: opts.temperature ?? 0.9,
      maxOutputTokens: 1200,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const res = await withLlm(async () => {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw Object.assign(new Error(`gemini ${r.status}`), { status: r.status });
    return r;
  });
  if (!res.body) return;

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const l = line.trim();
      if (!l.startsWith("data:")) continue;
      const json = l.slice(5).trim();
      if (!json || json === "[DONE]") continue;
      try {
        const text = extractText(JSON.parse(json));
        if (text) yield text;
      } catch {
        /* partial JSON across chunks — ignore, it'll re-buffer */
      }
    }
  }
}

export async function geminiGenerate(opts: {
  system: string;
  prompt: string;
  temperature?: number;
  json?: boolean;
  maxTokens?: number;
}): Promise<string> {
  const cfg = await getLlmConfig();
  const url = `${nativeBase(cfg.baseURL)}models/${cfg.chatModel}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generationConfig: any = {
    temperature: opts.temperature ?? 0.4,
    maxOutputTokens: opts.maxTokens ?? 800,
    thinkingConfig: { thinkingBudget: 0 },
  };
  if (opts.json) generationConfig.responseMimeType = "application/json";

  const data = await withLlm(async () => {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
        safetySettings: SAFETY,
        generationConfig,
      }),
    });
    if (!r.ok) throw Object.assign(new Error(`gemini ${r.status}`), { status: r.status });
    return r.json();
  });
  return extractText(data);
}
