import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth/guard";
import { tenantForUser } from "@/lib/db/tenant";
import { db } from "@/lib/db/client";
import { assistants } from "@/lib/db/schema";
import { getLlmConfig } from "@/lib/llm/config";
import { getApiKeys } from "@/lib/llm/keys";
import { getSetting } from "@/lib/settings";
import { SettingsForm } from "@/components/SettingsForm";

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const ctx = await tenantForUser(user.id, user.role);
  const [assistant] = await db
    .select({
      name: assistants.name,
      appearance: assistants.appearance,
      voiceId: assistants.voiceId,
      language: assistants.language,
      persona: assistants.persona,
    })
    .from(assistants)
    .where(eq(assistants.id, ctx.assistantId))
    .limit(1);
  const dials = (assistant?.persona as Record<string, number>) ?? {};

  const isAdmin = user.role === "admin";
  const llm = isAdmin ? await getLlmConfig() : null;
  const keyCount = isAdmin ? (await getApiKeys()).length : 0;
  const voiceId = isAdmin ? ((await getSetting("elevenlabs_voice_id")) ?? "") : "";

  return (
    <SettingsForm
      isAdmin={isAdmin}
      initial={{
        displayName: user.displayName ?? "",
        timezone: user.timezone,
        assistantName: assistant?.name ?? "نورا",
        appearance: assistant?.appearance ?? "",
        voiceId: assistant?.voiceId ?? "",
        language: assistant?.language ?? "en",
        playfulness: dials.playfulness ?? 0.8,
        bluntness: dials.bluntness ?? 0.65,
        warmth: dials.warmth ?? 0.8,
      }}
      provider={
        llm
          ? {
              baseUrl: llm.baseURL,
              chatModel: llm.chatModel,
              utilityModel: llm.utilityModel,
              embedModel: llm.embedModel,
              keyCount,
              voiceId,
            }
          : null
      }
    />
  );
}
