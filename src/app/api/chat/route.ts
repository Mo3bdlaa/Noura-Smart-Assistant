import { after } from "next/server";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { assistants, type CanonEntry } from "@/lib/db/schema";
import { conversationPolicy } from "@/lib/db/tenant";
import { AuthError, requireTenant } from "@/lib/auth/guard";
import { streamChat } from "@/lib/gemini/chat";
import { assembleSystem } from "@/lib/persona/assemble";
import { retrieveMemories } from "@/lib/memory/retrieve";
import { readMood } from "@/lib/mood/state";
import { timeContext } from "@/lib/time/awareness";
import {
  generateReminderInitiatives,
  generateSecurityInitiatives,
} from "@/lib/initiatives/generate";
import { surfaceInitiatives } from "@/lib/initiatives/surface";
import { getConversation, recentHistory, saveMessage } from "@/lib/chat/store";
import { enqueueExtract, drainJobs } from "@/lib/jobs/worker";

const Body = z.object({
  conversationId: z.string().uuid(),
  message: z.string().trim().min(1).max(4000),
});

export async function POST(req: Request) {
  let user, ctx;
  try {
    ({ user, ctx } = await requireTenant());
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "رسالة غير صالحة" }, { status: 400 });
  }
  const { conversationId, message } = parsed.data;

  const conv = await getConversation(ctx, conversationId);
  if (!conv) return NextResponse.json({ error: "المحادثة مش موجودة" }, { status: 404 });
  const policy = conversationPolicy(conv.type);

  // Persist the user's message (transcript exists even for incognito; only memory/mood are skipped).
  const userMessageId = await saveMessage({
    conversationId,
    userId: ctx.userId,
    role: "user",
    content: message,
  });

  const [assistant] = await db
    .select({ name: assistants.name, persona: assistants.persona, canon: assistants.canon })
    .from(assistants)
    .where(eq(assistants.id, ctx.assistantId))
    .limit(1);

  // Surface initiatives (security/reminders) — never in incognito.
  let initiatives: string[] = [];
  if (conv.type !== "incognito") {
    await generateSecurityInitiatives(ctx.userId, ctx.assistantId);
    await generateReminderInitiatives(ctx.userId, ctx.assistantId);
    initiatives = await surfaceInitiatives({
      userId: ctx.userId,
      assistantId: ctx.assistantId,
      timezone: user.timezone,
    });
  }

  // Memory retrieval needs embeddings; degrade gracefully (no recall) if it fails
  // so a turn never dies on a transient embedding error.
  const safeRetrieve = retrieveMemories({
    userId: ctx.userId,
    assistantId: ctx.assistantId,
    query: message,
  }).catch((e) => {
    console.error("memory retrieval failed", e);
    return [];
  });

  const [history, memories, mood] = await Promise.all([
    recentHistory(conversationId),
    safeRetrieve,
    readMood(ctx.assistantId),
  ]);

  const system = assembleSystem({
    assistantName: assistant?.name ?? "نورا",
    dials: (assistant?.persona as Record<string, number>) ?? undefined,
    canon: (assistant?.canon as CanonEntry[]) ?? [],
    mood,
    memories,
    time: timeContext(user.timezone),
    userDisplayName: user.displayName,
    initiatives,
    conversationType: conv.type,
  });

  // Run async memory/mood reflection after the response is sent.
  after(async () => {
    try {
      await drainJobs();
    } catch (e) {
      console.error("drainJobs failed", e);
    }
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      try {
        for await (const delta of streamChat({ system, history })) {
          full += delta;
          controller.enqueue(encoder.encode(delta));
        }
      } catch (e) {
        console.error("stream error", e);
        if (!full) {
          const msg = "حصل عندي لخبطة بسيطة، ابعتها تاني 🙈";
          full = msg;
          controller.enqueue(encoder.encode(msg));
        }
      } finally {
        // Persist the assistant reply, then enqueue reflection (skip for incognito).
        await saveMessage({
          conversationId,
          userId: ctx!.userId,
          role: "assistant",
          content: full,
        });
        if (conv.type !== "incognito") {
          await enqueueExtract({
            assistantId: ctx!.assistantId,
            userId: ctx!.userId,
            conversationId,
            userMessageId,
            userText: message,
            assistantText: full,
            persistMemory: policy.persistsMemory,
            mutateMood: policy.mutatesMood,
          });
        }
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
