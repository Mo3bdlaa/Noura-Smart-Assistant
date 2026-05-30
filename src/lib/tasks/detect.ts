import { formatInTimeZone } from "date-fns-tz";
import { generateJson } from "@/lib/llm/chat";
import type { NewTask } from "./store";

type Extracted = {
  is_task?: boolean;
  kind?: "remind" | "digest" | "nudge";
  title?: string;
  instruction?: string | null;
  datetime?: string | null;
  recurrence?: "once" | "daily" | "weekly";
};

/**
 * Detect if the user asked the assistant to do something on a schedule
 * ("remind me at 9", "every morning summarize X", "tomorrow tell me the price").
 * Returns a task to create, or null. Runs post-turn (best-effort).
 */
export async function detectTask(opts: {
  text: string;
  timezone: string;
}): Promise<NewTask | null> {
  const now = new Date();
  const localNow = formatInTimeZone(now, opts.timezone, "yyyy-MM-dd HH:mm (EEEE)");

  const system =
    "You extract scheduling requests from a chat message and output JSON ONLY. " +
    "Decide if the user is asking the assistant to proactively DO something later or on a schedule " +
    "(remind them, check in, or research+summarize something like prices/news). " +
    "If it's just normal conversation, set is_task=false.";

  const prompt = `Now: ${localNow} (timezone ${opts.timezone}).
User message: """${opts.text}"""

Output JSON with this exact shape:
{
  "is_task": boolean,
  "kind": "remind" | "digest" | "nudge",   // digest = needs web search/summary (prices, news, etc.)
  "title": "short label in the user's language",
  "instruction": "for digest: what to research/summarize, else null",
  "datetime": "ISO 8601 with timezone offset for the FIRST run, or null",
  "recurrence": "once" | "daily" | "weekly"
}
Rules: compute datetime relative to Now in the given timezone. If a time of day is implied (e.g. "morning"=09:00), use it. If no date/time at all, is_task=false.`;

  const res = await generateJson<Extracted>({ system, prompt, temperature: 0.1 });
  if (!res?.is_task || !res.datetime || !res.title) return null;

  const when = new Date(res.datetime);
  if (isNaN(when.getTime())) return null;
  // guard: if a one-off time is already in the past, ignore it
  if ((res.recurrence ?? "once") === "once" && when.getTime() < Date.now() - 60_000) return null;

  return {
    kind: res.kind ?? "remind",
    title: res.title.slice(0, 200),
    instruction: res.instruction ?? null,
    nextRunAt: when,
    recurrence: res.recurrence ?? "once",
  };
}
