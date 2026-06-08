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
  // First match wins — ordered from most to least overriding.
  if (m.safetyOverride) return t("قلقانة عليك 🫂", "Worried about you 🫂");
  if (m.annoyance > 0.45)
    return m.intensity > 0.6 ? t("زعلانة منك 😔", "Upset with you 😔") : t("متضايقة شوية 😒", "A bit annoyed 😒");
  if (m.energy < 0.32) return t("تعبانة وناعسة 🥱", "Tired & sleepy 🥱");
  if (m.affection > 0.72 && m.closeness > 0.6) return t("قريبة منك وحاسّة بدفا 🥰", "Close & warm with you 🥰");
  if (m.affection > 0.72) return t("مبسوطة بيك 🥰", "Happy with you 🥰");
  if (m.happiness > 0.7 && m.energy > 0.65) return t("فايقة ومبسوطة ✨", "Bright & cheerful ✨");
  if (m.happiness > 0.68) return t("رايقة ومبسوطة ☀️", "Cheerful & content ☀️");
  if (m.closeness < 0.28) return t("لسه بنتعرف على بعض 🙂", "Still getting to know you 🙂");
  if (m.happiness < 0.4) return t("مزاجها متعكنن شوية 😐", "In a bit of a mood 😐");
  if (m.energy > 0.7) return t("نشيطة ومركّزة معاك 🌟", "Lively & focused 🌟");
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
      moodStats={{
        happiness: mood.happiness,
        affection: mood.affection,
        energy: mood.energy,
        annoyance: mood.annoyance,
        intensity: mood.intensity,
        closeness: mood.closeness,
      }}
      isAdmin={user.role === "admin"}
      conversations={conversations.map((c) => ({ id: c.id, type: c.type, title: c.title }))}
    >
      {children}
    </AppShell>
  );
}
