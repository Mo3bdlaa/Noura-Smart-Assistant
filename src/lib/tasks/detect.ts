import { formatInTimeZone } from "date-fns-tz";
import { generateJson } from "@/lib/llm/chat";
import type { NewTask } from "./store";

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
      "instruction": "for digest: what to research/summarize, else null",
      "datetime": "ISO 8601 with timezone offset for the FIRST run",
      "recurrence": "once" | "daily" | "weekly"
    }
  ]
}
Rules: compute each datetime relative to Now in the given timezone. Create one task
per distinct time/item (e.g. "9am and 9pm" → two tasks). If no schedulable request,
return {"tasks": []}.`;

  const res = await generateJson<{ tasks?: ExtractedTask[] }>({ system, prompt, temperature: 0.1 });
  const out: NewTask[] = [];
  for (const t of res?.tasks ?? []) {
    if (!t?.datetime || !t.title) continue;
    const when = new Date(t.datetime);
    if (isNaN(when.getTime())) continue;
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
