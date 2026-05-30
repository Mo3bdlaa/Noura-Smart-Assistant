import { getGeminiKey, getSetting } from "@/lib/settings";

/**
 * Provider-agnostic LLM config. Everything funnels through an OpenAI-compatible
 * endpoint, so switching providers = change base URL + key + model (Gemini's
 * OpenAI-compat endpoint is the default; works with OpenAI/Groq/OpenRouter/
 * Ollama/etc. unchanged).
 *
 * Resolution order for each value: env var → DB setting → sensible default.
 */
export type LlmConfig = {
  baseURL: string;
  apiKey: string;
  chatModel: string;
  /** lighter model for background/JSON work (separate free-tier quota bucket) */
  utilityModel: string;
  embedModel: string;
};

const GEMINI_OPENAI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/";

export async function getLlmConfig(): Promise<LlmConfig> {
  const baseURL =
    process.env.LLM_BASE_URL || (await getSetting("llm_base_url")) || GEMINI_OPENAI_BASE;

  // Key: explicit LLM key wins, else fall back to the Gemini key (env/setup).
  const apiKey =
    process.env.LLM_API_KEY || (await getSetting("llm_api_key")) || (await getGeminiKey()) || "";

  const chatModel =
    process.env.LLM_CHAT_MODEL ||
    (await getSetting("llm_chat_model")) ||
    process.env.GEMINI_CHAT_MODEL ||
    "gemini-2.5-flash";

  const utilityModel =
    process.env.LLM_UTILITY_MODEL ||
    (await getSetting("llm_utility_model")) ||
    "gemini-2.0-flash-lite";

  const embedModel =
    process.env.LLM_EMBED_MODEL ||
    (await getSetting("llm_embed_model")) ||
    "gemini-embedding-001";

  return { baseURL, apiKey, chatModel, utilityModel, embedModel };
}
