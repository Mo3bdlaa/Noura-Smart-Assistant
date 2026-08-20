import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth/guard";
import { tenantForUser } from "@/lib/db/tenant";
import { db } from "@/lib/db/client";
import { assistants } from "@/lib/db/schema";
import { listConversations } from "@/lib/chat/store";
import { readMood, type MoodSnapshot } from "@/lib/mood/state";
import { AppShell } from "@/components/AppShell";
import { DueTasksTicker } from "@/components/DueTasksTicker";
import { getLocale, type Locale } from "@/lib/i18n";

function moodKind(m: MoodSnapshot): "happy" | "calm" | "upset" {
  if (m.annoyance > 0.35) return "upset";
  if (m.happiness > 0.65) return "happy";
  return "calm";
}

/**
 * Status line under her name. Phrased for the assistant's actual gender, and never
 * romantic for a professional assistant — a secretary saying "loving you today" was
 * the single most jarring mismatch in the app.
 */
function moodLabel(
  m: MoodSnapshot,
  locale: Locale,
  opts: { gender?: string | null; archetype?: string | null } = {},
): string {
  const en = locale === "en";
  const male = opts.gender === "male";
  const professional = opts.archetype === "secretary";
  const pick = (arFem: string[], enArr: string[], arMasc?: string[]) => {
    const arr = en ? enArr : male && arMasc ? arMasc : arFem;
    return arr[Math.floor(Math.random() * arr.length)]!;
  };
  // First matching bucket wins; a random variant within it keeps her alive.
  if (m.safetyOverride)
    return pick(
      ["قلقانة عليك 🫂", "خايفة عليك 🥺", "مش مطمنة عليك 🫂"],
      ["Worried about you 🫂", "Here for you 💗", "Concerned for you 🥺"],
      ["قلقان عليك 🫂", "خايف عليك 🥺", "مش مطمن عليك 🫂"],
    );
  if (m.annoyance > 0.45 && m.intensity > 0.6)
    return pick(
      ["زعلانة منك 😔", "واخدة في خاطري 💔", "متضايقة منك بجد 😔"],
      ["Upset with you 😔", "Hurt a little 💔"],
      ["زعلان منك 😔", "واخد في خاطري 💔", "متضايق منك بجد 😔"],
    );
  if (m.annoyance > 0.45)
    return pick(
      ["متضايقة شوية 😒", "مش مبسوطة أوي 😕"],
      ["A bit annoyed 😒", "Slightly off 😕"],
      ["متضايق شوية 😒", "مش مبسوط أوي 😕"],
    );
  if (m.energy < 0.32)
    return pick(
      ["تعبانة وناعسة 🥱", "نعسانة 😴", "مرهقة شوية 🥱"],
      ["Tired & sleepy 🥱", "A bit drained 😴"],
      ["تعبان ونعسان 🥱", "نعسان 😴", "مرهق شوية 🥱"],
    );

  // Affection/closeness buckets are relationship-flavored → skip for a secretary.
  if (!professional) {
    if (m.affection > 0.72 && m.closeness > 0.6)
      return pick(
        ["قلبي مليان بيك 💗", "قريبة منك وحاسّة بدفا 🥰", "مشتاقة ليك 🥹"],
        ["My heart's full of you 💗", "Close & warm 🥰", "Missing you 🥹"],
        ["قلبي مليان بيك 💗", "قريب منك وحاسس بدفا 🥰", "مشتاق ليك 🥹"],
      );
    if (m.affection > 0.72)
      return pick(
        ["مبسوطة بيك 🥰", "حنينة عليك 🤍", "حاسّة بيك 💗"],
        ["Happy with you 🥰", "Feeling tender 🤍", "Fond of you 💗"],
        ["مبسوط بيك 🥰", "حنين عليك 🤍", "حاسس بيك 💗"],
      );
    if (m.closeness > 0.55)
      return pick(
        ["مطمنة عليك 🤍", "فاكراك 💭", "بفكر فيك 💗"],
        ["Thinking of you 💭", "You're on my mind 💗", "Checking on you 🤍"],
        ["مطمن عليك 🤍", "فاكرك 💭", "بفكر فيك 💗"],
      );
  }

  if (m.happiness > 0.7 && m.energy > 0.65)
    return pick(
      ["فايقة ومبسوطة ✨", "مفعمة بالطاقة 🌟"],
      ["Bright & cheerful ✨", "Full of energy 🌟"],
      ["فايق ومبسوط ✨", "مفعم بالطاقة 🌟"],
    );
  if (m.happiness > 0.68)
    return pick(
      ["رايقة ومبسوطة ☀️", "مزاجي حلو 😊"],
      ["Cheerful & content ☀️", "In a good mood 😊"],
      ["رايق ومبسوط ☀️", "مزاجي حلو 😊"],
    );
  if (m.closeness < 0.28)
    return pick(
      ["لسه بنتعرف على بعض 🙂", "بكتشفك 👀"],
      ["Still getting to know you 🙂", "Getting to know you 👀"],
      ["لسه بنتعرف على بعض 🙂", "بكتشفك 👀"],
    );
  if (m.happiness < 0.4)
    return pick(["مش في يومي 😔", "مزاجي متعكنن شوية 😐"], ["In a bit of a mood 😐", "Not my day 😔"]);
  if (m.energy > 0.7)
    return pick(["نشيطة ومركّزة معاك 🌟"], ["Lively & focused 🌟"], ["نشيط ومركّز معاك 🌟"]);
  if (professional)
    return pick(["جاهزة لأي حاجة 🙂", "تحت أمرك 🤍"], ["Ready when you are 🙂", "At your service 🤍"], ["جاهز لأي حاجة 🙂", "تحت أمرك 🤍"]);
  return pick(["موجودة معاك 🙂", "هنا معاك 🤍"], ["Here with you 🙂", "With you 🤍"], ["موجود معاك 🙂", "هنا معاك 🤍"]);
}

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!user.onboardedAt) redirect("/onboarding"); // new users set up their assistant first
  const ctx = await tenantForUser(user.id, user.role);

  const [assistant] = await db
    .select({
      name: assistants.name,
      avatarUrl: assistants.avatarUrl,
      gender: assistants.gender,
      archetype: assistants.archetype,
    })
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
      moodLabel={moodLabel(mood, locale, { gender: assistant?.gender, archetype: assistant?.archetype })}
      assistantArchetype={assistant?.archetype}
      assistantGender={assistant?.gender}
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
      <DueTasksTicker />
      {children}
    </AppShell>
  );
}
