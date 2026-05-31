import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth/guard";
import { tenantForUser } from "@/lib/db/tenant";
import { db } from "@/lib/db/client";
import { assistants } from "@/lib/db/schema";
import { getLlmConfig } from "@/lib/llm/config";
import { getApiKeys } from "@/lib/llm/keys";
import { SettingsForm } from "@/components/SettingsForm";

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const ctx = await tenantForUser(user.id, user.role);
  const [assistant] = await db
    .select({ name: assistants.name })
    .from(assistants)
    .where(eq(assistants.id, ctx.assistantId))
    .limit(1);

  const isAdmin = user.role === "admin";
  const llm = isAdmin ? await getLlmConfig() : null;
  const keyCount = isAdmin ? (await getApiKeys()).length : 0;

  return (
    <SettingsForm
      isAdmin={isAdmin}
      initial={{
        displayName: user.displayName ?? "",
        timezone: user.timezone,
        assistantName: assistant?.name ?? "نورا",
      }}
      provider={
        llm
          ? {
              baseUrl: llm.baseURL,
              chatModel: llm.chatModel,
              utilityModel: llm.utilityModel,
              embedModel: llm.embedModel,
              keyCount,
            }
          : null
      }
    />
  );
}
