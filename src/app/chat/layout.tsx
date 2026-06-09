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
  const en = locale === "en";
  const pick = (ar: string[], enArr: string[]) => {
    const arr = en ? enArr : ar;
    return arr[Math.floor(Math.random() * arr.length)]!;
  };
  // First matching bucket wins; a random variant within it keeps her alive.
  if (m.safetyOverride)
    return pick(
      ["قلقانة عليك 🫂", "خايفة عليك 🥺", "قلبي معاك دلوقتي 💗", "مش مطمنة عليك 🫂"],
      ["Worried about you 🫂", "Here for you 💗", "Concerned for you 🥺"],
    );
  if (m.annoyance > 0.45 && m.intensity > 0.6)
    return pick(
      ["زعلانة منك 😔", "واخدة في خاطري 💔", "متضايقة منك بجد 😔"],
      ["Upset with you 😔", "Hurt a little 💔"],
    );
  if (m.annoyance > 0.45)
    return pick(["متضايقة شوية 😒", "مش مبسوطة أوي 😕", "زعلانة شوية 😏"], ["A bit annoyed 😒", "Slightly off 😕"]);
  if (m.energy < 0.32)
    return pick(["تعبانة وناعسة 🥱", "نعسانة 😴", "مرهقة شوية 🥱"], ["Tired & sleepy 🥱", "A bit drained 😴"]);
  if (m.affection > 0.72 && m.closeness > 0.6)
    return pick(
      ["قلبي مليان بيك 💗", "بحبك النهاردة 🥰", "قريبة منك وحاسّة بدفا 🥰", "مشتاقة ليك 🥹", "متعلّقة بيك 💞"],
      ["My heart's full of you 💗", "Loving you today 🥰", "Close & warm 🥰", "Missing you 🥹"],
    );
  if (m.affection > 0.72)
    return pick(
      ["مبسوطة بيك 🥰", "مدلّعاك شوية 😌", "حنينة عليك 🤍", "حاسّة بيك 💗"],
      ["Happy with you 🥰", "Feeling tender 🤍", "Fond of you 💗"],
    );
  if (m.closeness > 0.55)
    return pick(
      ["مطمنة عليك 🤍", "فاكراك 💭", "بفكر فيك 💗", "قلبي حاسّك 🤍"],
      ["Thinking of you 💭", "You're on my mind 💗", "Checking on you 🤍"],
    );
  if (m.happiness > 0.7 && m.energy > 0.65)
    return pick(["فايقة ومبسوطة ✨", "مفعمة بالطاقة 🌟", "روقان وطاقة 😄"], ["Bright & cheerful ✨", "Full of energy 🌟"]);
  if (m.happiness > 0.68)
    return pick(["رايقة ومبسوطة ☀️", "مزاجي حلو 😊", "حاسّة بصفا ☀️"], ["Cheerful & content ☀️", "In a good mood 😊"]);
  if (m.closeness < 0.28)
    return pick(["لسه بنتعرف على بعض 🙂", "بكتشفك 👀"], ["Still getting to know you 🙂", "Getting to know you 👀"]);
  if (m.happiness < 0.4)
    return pick(["مزاجها متعكنن شوية 😐", "مش في يومي 😔"], ["In a bit of a mood 😐", "Not my day 😔"]);
  if (m.energy > 0.7) return pick(["نشيطة ومركّزة معاك 🌟"], ["Lively & focused 🌟"]);
  return pick(["موجودة معاك 🙂", "هنا معاك 🤍", "قاعدة معاك 🙂"], ["Here with you 🙂", "With you 🤍"]);
}

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!user.onboardedAt) redirect("/onboarding"); // new users set up their assistant first
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
