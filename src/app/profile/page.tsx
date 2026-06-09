import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth/guard";
import { tenantForUser } from "@/lib/db/tenant";
import { db } from "@/lib/db/client";
import { assistants } from "@/lib/db/schema";
import { readMood } from "@/lib/mood/state";
import { getProfile, type ProfileReport } from "@/lib/insights/profile";
import { ProfileView } from "@/components/ProfileView";

export default async function ProfilePage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const ctx = await tenantForUser(user.id, user.role);

  const [a] = await db
    .select({ name: assistants.name, canon: assistants.canon, avatarUrl: assistants.avatarUrl })
    .from(assistants)
    .where(eq(assistants.id, ctx.assistantId))
    .limit(1);
  const mood = await readMood(ctx.assistantId);
  const profile = await getProfile(ctx.assistantId);
  const moodKind = mood.annoyance > 0.35 ? "upset" : mood.happiness > 0.65 ? "happy" : "calm";

  return (
    <ProfileView
      assistantName={a?.name ?? "نورا"}
      mood={moodKind}
      canon={((a?.canon as { fact: string }[]) ?? []).map((c) => c.fact).filter(Boolean)}
      report={(profile?.report as ProfileReport) ?? null}
      summary={profile?.summary ?? null}
      initialNotes={profile?.userNotes ?? ""}
      initialAvatar={a?.avatarUrl ?? null}
    />
  );
}
