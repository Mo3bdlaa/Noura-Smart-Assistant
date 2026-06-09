import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/db/client";
import { pendingInitiatives, type PendingInitiative } from "@/lib/db/schema";

/** Frame a pending initiative into a natural Arabic hint for the prompt. */
function frame(init: PendingInitiative, timezone: string): string {
  const p = init.payload as Record<string, unknown>;
  switch (init.kind) {
    case "security": {
      const at = p.at ? formatInTimeZone(new Date(p.at as string), timezone, "HH:mm") : "";
      return `حد حاول يدخل بباسورد غلط${at ? ` الساعة ${at}` : ""} من جهاز غريب، وإنتي منعتيه. اسأليه لو ده كان هو، واعرضي تثقي الجهاز لو قال آه.`;
    }
    case "reminder":
      return `فكّريه بـ: ${String(p.title ?? "")}.`;
    case "followup":
      return `اسأليه عن: ${String(p.title ?? "")} اللي كان قلقان منه.`;
    case "time":
      return String(p.text ?? "");
    case "mood":
      return String(p.text ?? "");
    case "dream":
      // already a fully-written, first-person line — surface it almost verbatim.
      return String(p.text ?? "");
    case "life":
      // something from her own day she wants to bring up casually.
      return `حاجة من يومك إنتي حابة تفتحي بيها معاه بتلقائية: ${String(p.text ?? "")}`;
    default:
      return "";
  }
}

/**
 * Dequeue pending initiatives for an assistant, mark them surfaced, and return
 * framed hints to inject into the next turn's prompt.
 */
export async function surfaceInitiatives(opts: {
  userId: string;
  assistantId: string;
  timezone: string;
  limit?: number;
}): Promise<string[]> {
  const rows = await db
    .select()
    .from(pendingInitiatives)
    .where(
      and(
        eq(pendingInitiatives.assistantId, opts.assistantId),
        isNull(pendingInitiatives.surfacedAt),
      ),
    )
    .orderBy(asc(pendingInitiatives.priority), asc(pendingInitiatives.createdAt))
    .limit(opts.limit ?? 3);

  if (!rows.length) return [];

  await db
    .update(pendingInitiatives)
    .set({ surfacedAt: new Date() })
    .where(
      inArray(
        pendingInitiatives.id,
        rows.map((r) => r.id),
      ),
    );

  return rows.map((r) => frame(r, opts.timezone)).filter(Boolean);
}
