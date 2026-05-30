import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth/guard";
import { tenantForUser } from "@/lib/db/tenant";
import { db } from "@/lib/db/client";
import { assistants } from "@/lib/db/schema";
import { listConversations } from "@/lib/chat/store";
import { readMood, type MoodSnapshot } from "@/lib/mood/state";
import { AppShell } from "@/components/AppShell";

function moodKind(m: MoodSnapshot): "happy" | "calm" | "upset" {
  if (m.annoyance > 0.35) return "upset";
  if (m.happiness > 0.65) return "happy";
  return "calm";
}

function moodLabel(m: MoodSnapshot): string {
  if (m.annoyance > 0.35) return m.intensity > 0.6 ? "زعلانة منك 😔" : "متضايقة شوية";
  if (m.energy < 0.35) return "تعبانة شوية 🥱";
  if (m.affection > 0.7) return "مبسوطة بيك 🥰";
  if (m.happiness > 0.65) return "رايقة ومبسوطة ☀️";
  if (m.happiness < 0.4) return "مزاجها متعكنن شوية";
  return "موجودة معاك 🙂";
}

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const ctx = await tenantForUser(user.id, user.role);

  const [assistant] = await db
    .select({ name: assistants.name })
    .from(assistants)
    .where(eq(assistants.id, ctx.assistantId))
    .limit(1);
  const conversations = await listConversations(ctx);
  const mood = await readMood(ctx.assistantId);

  return (
    <AppShell
      assistantName={assistant?.name ?? "نورا"}
      mood={moodKind(mood)}
      moodLabel={moodLabel(mood)}
      isAdmin={user.role === "admin"}
      conversations={conversations.map((c) => ({ id: c.id, type: c.type, title: c.title }))}
    >
      {children}
    </AppShell>
  );
}
