import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth/guard";
import { tenantForUser } from "@/lib/db/tenant";
import { db } from "@/lib/db/client";
import { assistants } from "@/lib/db/schema";
import { listConversations } from "@/lib/chat/store";
import { readMood, type MoodSnapshot } from "@/lib/mood/state";
import { AppShell } from "@/components/AppShell";
import { getLocale, type Locale } from "@/lib/i18n";

function moodKind(m: MoodSnapshot): "happy" | "calm" | "upset" {
  if (m.annoyance > 0.35) return "upset";
  if (m.happiness > 0.65) return "happy";
  return "calm";
}

function moodLabel(m: MoodSnapshot, locale: Locale): string {
  const t = (ar: string, en: string) => (locale === "en" ? en : ar);
  if (m.annoyance > 0.35)
    return m.intensity > 0.6 ? t("زعلانة منك 😔", "Upset with you 😔") : t("متضايقة شوية", "A bit annoyed");
  if (m.energy < 0.35) return t("تعبانة شوية 🥱", "A little tired 🥱");
  if (m.affection > 0.7) return t("مبسوطة بيك 🥰", "Happy with you 🥰");
  if (m.happiness > 0.65) return t("رايقة ومبسوطة ☀️", "Cheerful & content ☀️");
  if (m.happiness < 0.4) return t("مزاجها متعكنن شوية", "In a bit of a mood");
  return t("موجودة معاك 🙂", "Here with you 🙂");
}

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const ctx = await tenantForUser(user.id, user.role);

  const [assistant] = await db
    .select({ name: assistants.name, avatarUrl: assistants.avatarUrl })
    .from(assistants)
    .where(eq(assistants.id, ctx.assistantId))
    .limit(1);
  const conversations = await listConversations(ctx);
  const mood = await readMood(ctx.assistantId);
  const locale = await getLocale();

  return (
    <AppShell
      assistantName={assistant?.name ?? "نورا"}
      assistantPhoto={assistant?.avatarUrl ?? null}
      mood={moodKind(mood)}
      moodLabel={moodLabel(mood, locale)}
      isAdmin={user.role === "admin"}
      conversations={conversations.map((c) => ({ id: c.id, type: c.type, title: c.title }))}
    >
      {children}
    </AppShell>
  );
}
