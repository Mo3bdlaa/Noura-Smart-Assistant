import { keyPoolHandlers } from "@/lib/settings/key-pool";

// Pollinations image-gen tokens — same card management as the LLM pool.
const h = keyPoolHandlers({
  pool: "image_gen_tokens",
  singles: ["image_gen_token"],
  envVars: ["POLLINATIONS_TOKEN"],
});

export const GET = h.GET;
export const POST = h.POST;
export const DELETE = h.DELETE;
