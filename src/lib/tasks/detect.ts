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
    "You extract scheduling requests from a chat message and output JSON ONLY. " +
    "A single message may imply MULTIPLE tasks (e.g. two times of day, or several items). " +
    "Each task = the assistant proactively doing something later/on a schedule " +
    "(remind, check in, or research+summarize like prices/news). " +
    "If it's just normal conversation, return an empty array.";

  const prompt = `Now: ${localNow} (timezone ${opts.timezone}).
User message: """${opts.text}"""

Output JSON exactly:
{
  "tasks": [
    {
      "kind": "remind" | "digest" | "nudge",
      "title": "short label in the user's language",
      "instruction": "ALL the details/body to include in the message — e.g. exact medication names, doses, steps, links; or for digest what to research. Keep any specifics the user gave. null only if none.",
      "datetime": "LOCAL wall-clock time for the FIRST run, format 'YYYY-MM-DD HH:mm' (24h). NO timezone, NO 'Z', NO offset — just the clock time the user means.",
      "recurrence": "once" | "daily" | "weekly"
    }
  ]
}
Rules: read each datetime as the user's LOCAL clock relative to Now (do NOT convert
to UTC — output exactly the local wall-clock time). Create one task per distinct
time/item (e.g. "9am and 9pm" → two tasks). If no schedulable request, return {"tasks": []}.`;

  const res = await generateJson<{ tasks?: ExtractedTask[] }>({ system, prompt, temperature: 0.1 });
  const out: NewTask[] = [];
  for (const t of res?.tasks ?? []) {
    if (!t?.datetime || !t.title) continue;
    const when = localToUtc(t.datetime, opts.timezone);
    if (!when) continue;
    if ((t.recurrence ?? "once") === "once" && when.getTime() < Date.now() - 60_000) continue;
    out.push({
      kind: t.kind ?? "remind",
      title: t.title.slice(0, 200),
      instruction: t.instruction ?? null,
      nextRunAt: when,
      recurrence: t.recurrence ?? "once",
    });
  }
  return out.slice(0, 6); // safety cap
}
