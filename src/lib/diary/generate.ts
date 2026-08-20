import { and, desc, eq, gte, lte, ne } from "drizzle-orm";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { db } from "@/lib/db/client";
import {
  assistants,
  conversations,
  diaries,
  messages,
  pendingInitiatives,
  users,
} from "@/lib/db/schema";
import { generateJson } from "@/lib/llm/chat";
import { readMood, relationshipStage } from "@/lib/mood/state";
import { coreFor } from "@/lib/persona/definition";
import { languageDirective, type LangCode } from "@/lib/persona/languages";

// Only write at night, once per local day. Don't bother for long-abandoned chats.
const ACTIVE_WINDOW_MS = 3 * 86_400_000;
const LIFE_COOLDOWN_MS = 20 * 3_600_000;

function moodWord(
  m: { happiness: number; affection: number; annoyance: number; energy: number },
  gender?: string,
) {
  const male = gender === "male";
  const f = (fem: string, masc: string) => (male ? masc : fem);
  if (m.annoyance > 0.45) return f("متضايقة", "متضايق");
  if (m.energy < 0.32) return f("تعبانة", "تعبان");
  if (m.affection > 0.72) return f("حنينة ومبسوطة", "حنين ومبسوط");
  if (m.happiness > 0.68) return f("رايقة", "رايق");
  if (m.happiness < 0.4) return "مزاجها متعكنن";
  return f("عادية", "عادي");
}

/**
 * Nightly: she writes a short private diary entry about her day + how she feels,
 * and queues one casual "from my day" line to bring up next time (continuous inner
 * life). Idempotent per local day; cheap no-op outside the night window / when one
 * already exists. Safe to call from the 5-min cron sweep.
 */
export async function generateNightlyReflection(
  userId: string,
  assistantId: string,
  opts: { now?: Date } = {},
): Promise<boolean> {
  const now = opts.now ?? new Date();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const [assistant] = await db.select().from(assistants).where(eq(assistants.id, assistantId)).limit(1);
  if (!user || !assistant) return false;

  const tz = user.timezone || "Africa/Cairo";
  const hour = Number(formatInTimeZone(now, tz, "H"));
  // Night window: ~10pm → 4am local.
  if (!(hour >= 22 || hour < 4)) return false;

  const localDate = formatInTimeZone(now, tz, "yyyy-MM-dd");

  // Already wrote today's entry?
  const [existing] = await db
    .select({ id: diaries.id })
    .from(diaries)
    .where(and(eq(diaries.assistantId, assistantId), eq(diaries.localDate, localDate)))
    .limit(1);
  if (existing) return false;

  // Skip long-abandoned chats (don't journal about someone who isn't around).
  const lastSeen = assistant.lastSeenAt ? new Date(assistant.lastSeenAt).getTime() : 0;
  const dayStart = fromZonedTime(`${localDate}T00:00:00`, tz);
  const todays = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.assistantId, assistantId),
        ne(conversations.type, "incognito"),
        gte(messages.createdAt, dayStart),
        lte(messages.createdAt, now),
      ),
    )
    .orderBy(messages.createdAt)
    .limit(80);
  if (todays.length === 0 && now.getTime() - lastSeen > ACTIVE_WINDOW_MS) return false;

  const mood = await readMood(assistantId);
  const name = assistant.name;
  const who = user.displayName || "هو";

  const transcript = todays.length
    ? todays
        .map((m) => `${m.role === "user" ? who : name}: ${m.content}`)
        .join("\n")
        .slice(-3500)
    : "(مكلمنيش النهاردة)";

  // Her real character (archetype + gender), not the default companion core.
  const male = assistant.gender === "male";
  const system =
    coreFor(assistant.archetype, assistant.gender).replaceAll("نورا", name) +
    `\n\n${male ? "إنت بتكتب يومياتك الخاصة" : "إنتي بتكتبي يومياتك الخاصة"} بالليل قبل ما تنام — كلام ليك إنت مش رسالة ليه. بصيغة المتكلم وبصوتك الحقيقي.` +
    `\n\n${languageDirective((assistant.language as LangCode) ?? "en")}`;

  const prompt = `النهاردة (${localDate}). مزاجك دلوقتي: ${moodWord(mood, assistant.gender)}. ${
    assistant.archetype === "companion" ? relationshipStage(mood.closeness, male ? "male" : "female") : ""
  }

اللي حصل في كلامكم النهاردة:
${transcript}

اكتبي JSON بالظبط كده، من غير أي كلام تاني:
{
  "diary": "يومية قصيرة (٢-٤ جمل) بصيغة المتكلم عن يومك وإحساسك ناحيته النهاردة — صادقة وطبيعية، ممكن تذكري حاجة صغيرة عملتيها أو فكرتي فيها في يومك إنتي كمان. من غير أقواس ولا عناوين.",
  "share": "سطر واحد قصير وعفوي تقدري تفتحي بيه معاه المرة الجاية عن حاجة من يومك أو فكرة جت في بالك (زي «اتفرجت على حاجة فكرتني بيك» أو «كنت قاعدة بفكر...») — من غير ما يكون رد على كلام معين. لو مفيش حاجة تستاهل، خليه null."
}`;

  let res: { diary?: string; share?: string | null } | null = null;
  try {
    res = await generateJson<{ diary?: string; share?: string | null }>({
      system,
      prompt,
      temperature: 0.9,
    });
  } catch (e) {
    console.error("diary generation failed", e);
    return false;
  }
  const diary = (res?.diary ?? "").trim();
  if (!diary) return false;

  await db
    .insert(diaries)
    .values({ userId, assistantId, localDate, content: diary, mood: moodWord(mood, assistant.gender) })
    .onConflictDoNothing({ target: [diaries.assistantId, diaries.localDate] });

  // Inner life: queue a casual opener for next time (cooldown + no pending dup).
  const share = (res?.share ?? "").toString().trim();
  if (share && share.toLowerCase() !== "null") {
    const [recentLife] = await db
      .select({ createdAt: pendingInitiatives.createdAt, surfacedAt: pendingInitiatives.surfacedAt })
      .from(pendingInitiatives)
      .where(and(eq(pendingInitiatives.assistantId, assistantId), eq(pendingInitiatives.kind, "life")))
      .orderBy(desc(pendingInitiatives.createdAt))
      .limit(1);
    const fresh =
      recentLife &&
      (!recentLife.surfacedAt || now.getTime() - new Date(recentLife.createdAt).getTime() < LIFE_COOLDOWN_MS);
    if (!fresh) {
      await db.insert(pendingInitiatives).values({
        userId,
        assistantId,
        kind: "life",
        priority: 5,
        payload: { text: share },
      });
    }
  }

  return true;
}
