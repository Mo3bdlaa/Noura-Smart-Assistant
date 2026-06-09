import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { assistants, memories, type CanonEntry, type MemoryType } from "@/lib/db/schema";
import { generateJson } from "@/lib/llm/chat";
import { embedBatch } from "@/lib/llm/embeddings";
import { applyMoodDelta, bumpCloseness } from "@/lib/mood/update";

const MEMORY_TYPES: [MemoryType, ...MemoryType[]] = [
  "profile",
  "preference",
  "topic",
  "moment",
  "person",
  "emotional",
];

const ReflectionSchema = z.object({
  memories: z
    .array(
      z.object({
        type: z.enum(MEMORY_TYPES),
        content: z.string().min(1).max(400),
        importance: z.number().min(0).max(1).default(0.5),
        structured: z.record(z.unknown()).optional(),
      }),
    )
    .max(8)
    .default([]),
  mood_delta: z
    .object({
      happiness: z.number().min(-1).max(1).default(0),
      affection: z.number().min(-1).max(1).default(0),
      annoyance: z.number().min(-1).max(1).default(0),
      energy: z.number().min(-1).max(1).default(0),
      intensity: z.number().min(-1).max(1).default(0),
      reason: z.string().max(200).nullable().default(null),
      safety_override: z.boolean().default(false),
    })
    .default({}),
  canon: z.array(z.string().min(1).max(300)).max(5).default([]),
});

export type Reflection = z.infer<typeof ReflectionSchema>;

const REFLECTION_SYSTEM = `
إنتي محرك تحليل داخلي لنورا (مش بتكلمي المستخدم). من تبادل رسالة واحد، طلّعي JSON بس، بالظبط بالشكل ده:
{
  "memories": [{ "type": "profile|preference|topic|moment|person|emotional", "content": "حقيقة مقطّرة بالعربي", "importance": 0..1, "structured": {} }],
  "mood_delta": { "happiness": -1..1, "affection": -1..1, "annoyance": -1..1, "energy": -1..1, "intensity": -1..1, "reason": "سبب الزعل لو فيه أو null", "safety_override": true/false },
  "canon": ["حقيقة قالتها نورا عن نفسها (لو وجدت)"]
}
قواعد:
- استخرجي بس الحقائق اللي تستاهل تتفكر (حاجات عن المستخدم، تفضيلاته، ناس في حياته، لحظات مهمة، مشاعر).
- importance: العاطفي/الشخصي/الأشخاص ≥ 0.7، المواضيع العابرة ≤ 0.4. متخزنيش كلام فاضي.
- mood_delta: تغيّر بسيط جداً ومعقول (مش قيمة مطلقة). القيم العادية بين ±0.05 و ±0.2.
  • نورا واثقة ومطمئنة وبتحب اللي بتكلمه — متزعلش من حاجات صغيرة ولا تاخد في خاطرها بسهولة.
  • ارفعي annoyance/intensity بشكل ملحوظ بس لو فيه قلة احترام/تجاهل/إهانة حقيقية (مش مجرد مزاح أو اختلاف رأي).
  • أول ما يطيّبها أو يعتذر أو يبقى حنين → نزّلي annoyance و intensity بقوة (قيم سالبة) وارفعي happiness/affection. المصالحة سهلة.
  • لو التبادل دافي/حنين ارفعي affection شوية. الغضب نادر ومؤقت مش الحالة الافتراضية.
- safety_override = true بس لو المستخدم باين متضايق نفسيًا بجد.
- canon: بس لو نورا قالت حاجة جديدة عن نفسها/حياتها/رأيها لازم تفضل ثابتة.
- لو مفيش حاجة، رجّعي قوائم فاضية. اطلعي JSON بس من غير أي كلام تاني.
`.trim();

/** The single consolidated post-turn reflection call (memories + mood + canon). */
export async function reflect(opts: {
  userText: string;
  assistantText: string;
}): Promise<Reflection | null> {
  const prompt = `رسالة المستخدم:\n${opts.userText}\n\nرد نورا:\n${opts.assistantText}`;
  const raw = await generateJson<unknown>({ system: REFLECTION_SYSTEM, prompt, temperature: 0.3 });
  if (!raw) return null;
  const parsed = ReflectionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Run reflection for one exchange and persist results.
 * - memories + canon persisted only when `persistMemory` (skip for incognito)
 * - mood delta applied only when `mutateMood` (skip for incognito)
 */
export async function processExchange(opts: {
  assistantId: string;
  userId: string;
  conversationId: string;
  userMessageId: string;
  userText: string;
  assistantText: string;
  persistMemory: boolean;
  mutateMood: boolean;
}) {
  const reflection = await reflect({
    userText: opts.userText,
    assistantText: opts.assistantText,
  });
  if (!reflection) return;

  if (opts.persistMemory && reflection.memories.length) {
    // Skip memories whose exact content we already stored (avoids repeats piling up).
    const contents = Array.from(new Set(reflection.memories.map((m) => m.content)));
    const dupRows = await db
      .select({ content: memories.content })
      .from(memories)
      .where(and(eq(memories.assistantId, opts.assistantId), inArray(memories.content, contents)));
    const have = new Set(dupRows.map((r) => r.content));
    const seenBatch = new Set<string>();
    const fresh = reflection.memories.filter((m) => {
      if (have.has(m.content) || seenBatch.has(m.content)) return false;
      seenBatch.add(m.content);
      return true;
    });
    if (fresh.length) {
      const vectors = await embedBatch(fresh.map((m) => m.content));
      await db.insert(memories).values(
        fresh.map((m, i) => ({
          userId: opts.userId,
          assistantId: opts.assistantId,
          sourceMessageId: opts.userMessageId,
          type: m.type,
          content: m.content,
          structured: m.structured ?? null,
          importance: m.importance,
          embedding: vectors[i]!,
        })),
      );
    }
  }

  if (opts.persistMemory && reflection.canon.length) {
    await appendCanon(opts.assistantId, reflection.canon, opts.userMessageId);
  }

  if (opts.mutateMood) {
    const d = reflection.mood_delta;
    await applyMoodDelta({
      assistantId: opts.assistantId,
      reasonSourceConversationId: opts.conversationId,
      delta: {
        happiness: d.happiness,
        affection: d.affection,
        annoyance: d.annoyance,
        energy: d.energy,
        intensity: d.intensity,
        reason: d.reason,
        safetyOverride: d.safety_override,
      },
    });
    // Slowly grow the long-term bond from this warm (or chip it from a hurtful) turn.
    await bumpCloseness({ assistantId: opts.assistantId, affectionDelta: d.affection });
  }
}

const normFact = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const CANON_CAP = 80; // keep canon bounded so the prompt never balloons

async function appendCanon(assistantId: string, facts: string[], sourceMessageId: string) {
  const [row] = await db
    .select({ canon: assistants.canon })
    .from(assistants)
    .where(eq(assistants.id, assistantId))
    .limit(1);
  const existing = (row?.canon as CanonEntry[] | undefined) ?? [];
  const seen = new Set(existing.map((e) => normFact(e.fact)));
  const now = new Date().toISOString();
  // Drop facts we already know (case/space-insensitive) and dups within this batch.
  const additions: CanonEntry[] = [];
  for (const fact of facts) {
    const n = normFact(fact);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    additions.push({ fact, statedAt: now, sourceMessageId });
  }
  if (additions.length === 0) return;
  const merged = [...existing, ...additions].slice(-CANON_CAP);
  await db.update(assistants).set({ canon: merged }).where(eq(assistants.id, assistantId));
}
