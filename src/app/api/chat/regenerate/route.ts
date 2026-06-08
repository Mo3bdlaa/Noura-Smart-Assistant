import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { assistants, messages, type CanonEntry } from "@/lib/db/schema";
import { AuthError, requireTenant } from "@/lib/auth/guard";
import { streamChat } from "@/lib/llm/chat";
import { assembleSystem } from "@/lib/persona/assemble";
import { retrieveMemories } from "@/lib/memory/retrieve";
import { readMood } from "@/lib/mood/state";
import { timeContext } from "@/lib/time/awareness";
import { getConversation, recentHistory, saveMessage } from "@/lib/chat/store";
import { parseReactLead, couldBeReactLead, REACT_LEAD_RE } from "@/lib/chat/react-tag";
import { getLocale } from "@/lib/i18n";

export const maxDuration = 60;

const Body = z.object({ conversationId: z.string().uuid() });

/** Re-generate the assistant's reply to the last user message (replaces it). */
export async function POST(req: Request) {
  let user, ctx;
  try {
    ({ user, ctx } = await requireTenant());
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  const { conversationId } = parsed.data;

  const conv = await getConversation(ctx, conversationId);
  if (!conv) return NextResponse.json({ error: "المحادثة مش موجودة" }, { status: 404 });

  // Tail of the conversation: the last assistant reply (to replace) + last user turn.
  const tail = await db
    .select({ id: messages.id, role: messages.role, content: messages.content, meta: messages.meta })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(8);

  const lastAssistant = tail.find((m) => m.role === "assistant");
  const lastUser = tail.find((m) => m.role === "user");
  if (!lastUser) return NextResponse.json({ error: "مفيش رسالة تعيدي عليها" }, { status: 400 });

  const images = (lastUser.meta as { images?: string[] } | null)?.images;

  const [assistant] = await db
    .select({ name: assistants.name, persona: assistants.persona, canon: assistants.canon, appearance: assistants.appearance })
    .from(assistants)
    .where(eq(assistants.id, ctx.assistantId))
    .limit(1);

  const safeRetrieve = retrieveMemories({
    userId: ctx.userId,
    assistantId: ctx.assistantId,
    query: lastUser.content,
  }).catch(() => []);

  const [rawHistory, memories, mood, locale] = await Promise.all([
    recentHistory(conversationId),
    safeRetrieve,
    readMood(ctx.assistantId),
    getLocale(),
  ]);

  // Drop trailing assistant turn(s) so the prompt ends at the user turn.
  // We only delete the old reply from the DB once a new one succeeds.
  const history = [...rawHistory];
  while (history.length && history[history.length - 1]!.role === "assistant") history.pop();

  const system = assembleSystem({
    assistantName: assistant?.name ?? "نورا",
    dials: (assistant?.persona as Record<string, number>) ?? undefined,
    canon: (assistant?.canon as CanonEntry[]) ?? [],
    mood,
    memories,
    appearance: assistant?.appearance ?? null,
    time: timeContext(user.timezone),
    userDisplayName: user.displayName,
    conversationType: conv.type,
    scenario: conv.scenario,
    locale,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      // Regenerating a reply: strip any leading "<react:…>" tag so it never shows
      // raw (reactions only apply on the live send path, not on a re-do).
      let buf = "";
      let decided = false;
      const flush = () => {
        controller.enqueue(encoder.encode(parseReactLead(buf).rest));
        buf = "";
        decided = true;
      };
      try {
        for await (const delta of streamChat({ system, history, images, temperature: 1.0 })) {
          full += delta;
          if (decided) {
            controller.enqueue(encoder.encode(delta));
            continue;
          }
          buf += delta;
          if (REACT_LEAD_RE.test(buf) || !couldBeReactLead(buf) || buf.length > 64) flush();
        }
      } catch (e) {
        console.error("regenerate stream error", e);
      } finally {
        if (!decided) flush();
        const replyText = parseReactLead(full).rest.trim();
        if (replyText) {
          if (lastAssistant) {
            await db.delete(messages).where(eq(messages.id, lastAssistant.id));
          }
          await saveMessage({
            conversationId,
            userId: ctx!.userId,
            role: "assistant",
            content: replyText,
          });
        }
        // On empty/failure the old reply is kept; the client refreshes to restore it.
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
