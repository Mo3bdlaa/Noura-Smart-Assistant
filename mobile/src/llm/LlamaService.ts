/**
 * Thin wrapper around llama.rn — runs a GGUF model (Gemma 3 4B) fully on-device.
 * No network. The model file lives on the phone; we just point at its path.
 */
import { initLlama, type LlamaContext } from "llama.rn";

export type ChatTurn = { role: "system" | "user" | "assistant"; content: string };

// Gemma's turn separators — used as stop strings so she doesn't keep talking
// for both sides of the conversation.
const STOP = ["<end_of_turn>", "<start_of_turn>", "<eos>"];

let ctx: LlamaContext | null = null;
let loadingPath: string | null = null;

/** Load (or reload) the model from a local file path. Heavy — call once. */
export async function loadModel(
  modelPath: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  if (ctx && loadingPath === modelPath) return;
  if (ctx) {
    await ctx.release();
    ctx = null;
  }
  loadingPath = modelPath;
  ctx = await initLlama(
    {
      model: modelPath,
      n_ctx: 4096,
      n_batch: 512,
      // Offload everything to the Adreno GPU on the S25 Ultra for speed.
      n_gpu_layers: 99,
    },
    onProgress ? (p) => onProgress(p) : undefined,
  );
}

export function isLoaded(): boolean {
  return ctx !== null;
}

/**
 * Stream a reply token-by-token. `onToken` fires for each new piece of text;
 * resolves with the full text when done.
 */
export async function chat(
  messages: ChatTurn[],
  onToken: (partial: string) => void,
): Promise<string> {
  if (!ctx) throw new Error("Model not loaded");
  let full = "";
  await ctx.completion(
    {
      messages,
      n_predict: 400,
      temperature: 0.85,
      top_p: 0.95,
      penalty_repeat: 1.1,
      stop: STOP,
      // Apply the model's built-in (Gemma) chat template.
      jinja: true,
    },
    (data: { token: string }) => {
      full += data.token;
      onToken(full);
    },
  );
  return cleanup(full);
}

/** Strip any stray template tokens the model might emit. */
function cleanup(text: string): string {
  let t = text;
  for (const s of STOP) t = t.split(s).join("");
  return t.trim();
}

export async function unload(): Promise<void> {
  if (ctx) {
    await ctx.release();
    ctx = null;
    loadingPath = null;
  }
}
