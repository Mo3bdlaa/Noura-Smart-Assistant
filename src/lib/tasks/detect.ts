import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { generateJson } from "@/lib/llm/chat";
import type { NewTask } from "./store";

/**
 * Convert a model-produced LOCAL wall-clock time ("2026-06-08 15:30") into a real
 * UTC instant using the user's timezone. We never trust the model to compute the
 * UTC offset itself — that was firing reminders 1–3h late (the Cairo offset).
 * Any stray Z/offset the model adds is ignored: we read the wall-clock digits and
 * place them in `timezone`.
 */
function localToUtc(raw: string, timezone: string): Date | null {
  const m = raw.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const when = fromZonedTime(`${y}-${mo}-${d}T${h}:${mi}:00`, timezone);
  return isNaN(when.getTime()) ? null : when;
}

type ExtractedTask = {
  kind?: "remind" | "digest" | "nudge";
  title?: string;
  instruction?: string | null;
  datetime?: string | null;
  recurrence?: "once" | "daily" | "weekly";
};

/**
 * Detect scheduling requests in a chat message and return **all** the tasks it
 * implies (e.g. "remind me of meds once in the morning and once at night" → two
 * tasks). Returns [] for normal conversation. Runs post-turn (best-effort).
 */
export async function detectTasks(opts: { text: string; timezone: string }): Promise<NewTask[]> {
  const now = new Date();
  const localNow = formatInTimeZone(now, opts.timezone, "yyyy-MM-dd HH:mm (EEEE)");

  const system =
    "You turn a chat message into scheduled tasks the assistant will proactively do " +
    "later (remind, check in, or research+summarize). Output JSON ONLY. THINK about " +
    "what the user actually wants — frequency, sensible times, and WHY — don't just " +
    "copy words. One message can imply MULTIPLE tasks. If it's normal conversation, " +
    "return an empty array.";

  const prompt = `Now: ${localNow} (timezone ${opts.timezone}).
User message: """${opts.text}"""

Output JSON exactly:
{
  "tasks": [
    {
      "kind": "remind" | "digest" | "nudge",
      "title": "short clean label in the user's language (e.g. 'دوا الضغط')",
      "instruction": "the MEANINGFUL body she'll actually say — include the REASON/why behind it plus any specifics (names, doses, steps, links). Make it genuinely helpful, not a bare title. e.g. 'فكّره ياخد دوا الضغط — قال إنه بينسى جرعة بالليل'. null only if truly nothing to add.",
      "datetime": "LOCAL wall-clock for the FIRST run, format 'YYYY-MM-DD HH:mm' (24h). NO timezone/Z/offset.",
      "recurrence": "once" | "daily" | "weekly"
    }
  ]
}

THINK like this before writing:
1) Frequency → recurrence. "every day / كل يوم / يوميًا" = daily. "every week" = weekly. one-off = once.
2) Multiple times a day → SPLIT into one task per time, each with recurrence "daily".
   - "twice a day / مرتين في اليوم" with no times given → 2 daily tasks at sensible spread: 09:00 and 21:00.
   - "three times a day / 3 مرات" → 08:00, 14:00, 20:00. If the user gave times, use those instead.
3) Vague single times → reasonable defaults: "in the morning/الصبح" ≈ 08:00, "noon/الضهر" ≈ 13:00,
   "afternoon/العصر" ≈ 16:00, "evening/بالليل" ≈ 20:00, "before bed/قبل النوم" ≈ 23:00.
4) For recurring tasks, set the FIRST datetime to the next future occurrence of that time.
5) Always capture the user's REASON/context in instruction so the reminder isn't just a title.

Read every datetime as the user's LOCAL clock relative to Now (output the local wall-clock, do NOT convert to UTC).
If no schedulable request, return {"tasks": []}.`;

  const res = await generateJson<{ tasks?: ExtractedTask[] }>({ system, prompt, temperature: 0.3 });
  const out: NewTask[] = [];
  const nowMs = Date.now();
  for (const t of res?.tasks ?? []) {
    if (!t?.datetime || !t.title) continue;
    const recurrence = t.recurrence ?? "once";
    let when = localToUtc(t.datetime, opts.timezone);
    if (!when) continue;
    if (recurrence === "once") {
      if (when.getTime() < nowMs - 60_000) continue; // a one-off in the past is noise
    } else {
      // Recurring: roll the first run forward to the next future occurrence so a
      // "daily at 9am" set at 3pm doesn't fire once immediately.
      const stepDays = recurrence === "weekly" ? 7 : 1;
      while (when.getTime() <= nowMs) when = new Date(when.getTime() + stepDays * 86_400_000);
    }
    out.push({
      kind: t.kind ?? "remind",
      title: t.title.slice(0, 200),
      instruction: t.instruction ?? null,
      nextRunAt: when,
      recurrence,
    });
  }
  return out.slice(0, 6); // safety cap
}
