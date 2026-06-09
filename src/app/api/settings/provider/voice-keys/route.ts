import { keyPoolHandlers } from "@/lib/settings/key-pool";

// ElevenLabs voice keys — same card management as the LLM pool.
const h = keyPoolHandlers({
  pool: "elevenlabs_api_keys",
  singles: ["elevenlabs_api_key"],
  envVars: ["ELEVENLABS_API_KEYS", "ELEVENLABS_API_KEY"],
});

export const GET = h.GET;
export const POST = h.POST;
export const DELETE = h.DELETE;
