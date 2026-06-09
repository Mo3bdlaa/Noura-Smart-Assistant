import { after } from "next/server";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { assistants, type CanonEntry } from "@/lib/db/schema";
import { conversationPolicy } from "@/lib/db/tenant";
import { AuthError, requireTenant } from "@/lib/auth/guard";
import { streamChat } from "@/lib/llm/chat";
import { assembleSystem } from "@/lib/persona/assemble";
import { retrieveMemories } from "@/lib/memory/retrieve";
import { readMood } from "@/lib/mood/state";
import { timeContext } from "@/lib/time/awareness";
import {
  generateReminderInitiatives,
  generateSecurityInitiatives,
} from "@/lib/initiatives/generate";
import { surfaceInitiatives } from "@/lib/initiatives/surface";
import {
  findUserMessageByQuote,
  getConversation,
  getReplySnapshot,
  pickAssistantPhoto,
  recentHistory,
  saveMessage,
  setConversationTitle,
  setMessageReaction,
  updateSideCardTitle,
} from "@/lib/chat/store";
import { parseLeadTags, couldBeLeadTag, controlFrame } from "@/lib/chat/react-tag";
import { pickThrowback } from "@/lib/memory/throwback";
import { generateTitle } from "@/lib/chat/title";
import { maybeUpdateProfile, getProfile } from "@/lib/insights/profile";
import { enqueueExtract, drainJobs } from "@/lib/jobs/worker";
import { getLocale } from "@/lib/i18n";
import { friendlyError } from "@/lib/llm/errors";
import { detectTasks } from "@/lib/tasks/detect";
import { createTask } from "@/lib/tasks/store";
import { runDueTasks } from "@/lib/tasks/run";
import { captureMood } from "@/lib/timeline/snapshot";
import { touchLastSeen } from "@/lib/dreams/generate";

// Allow long-running streamed replies + post-response reflection on Vercel.
export const maxDuration = 60;

const Body = z
  .object({
    conversationId: z.string().uuid(),
    message: z.string().trim().max(4000).default(""),
    // base64 data URLs (client downscales before sending). Multimodal turn.
    images: z.array(z.string().startsWith("data:image/")).max(4).optional(),
    // id of a message this turn is quote-replying to (optional).
    replyToId: z.string().uuid().optional(),
  })
  .refine((b) => b.message.length > 0 || (b.images?.length ?? 0) > 0, {
    message: "اكتب رسالة أو ابعت صورة",
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
  const { conversationId, message, images, replyToId } = parsed.data;

  const conv = await getConversation(ctx, conversationId);
  if (!conv) return NextResponse.json({ error: "المحادثة مش موجودة" }, { status: 404 });
  const policy = conversationPolicy(conv.type);

  // If the user is quoting an earlier message, snapshot it onto their message.
  const userReplyTo = replyToId ? await getReplySnapshot(ctx, replyToId) : null;

  // Transcript stores text only; images are sent to the model for this turn but
  // not persisted (keeps the DB light). Mark image-only turns so they read well.
  const transcriptText = message || "📷 صورة";

  // Persist the user's message (transcript exists even for incognito; only memory/mood are skipped).
  // Attached images are stored (downscaled data URLs) so they survive a reload.
  const userMessageId = await saveMessage({
    conversationId,
    userId: ctx.userId,
    role: "user",
    content: transcriptText,
    meta:
      images?.length || userReplyTo
        ? { ...(images?.length ? { images } : {}), ...(userReplyTo ? { replyTo: userReplyTo } : {}) }
        : undefined,
  });

  const [assistant] = await db
    .select({ name: assistants.name, persona: assistants.persona, canon: assistants.canon, appearance: assistants.appearance })
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

  const [history, memories, mood, profile] = await Promise.all([
    recentHistory(conversationId),
    safeRetrieve,
    readMood(ctx.assistantId),
    getProfile(ctx.assistantId).catch(() => null),
  ]);

  // Now and then, once there's history, she spontaneously reminisces about an old
  // memory ("افتكرت إنك...") unprompted — makes her feel like she truly remembers.
  if (conv.type !== "incognito" && history.length >= 6 && initiatives.length < 2 && Math.random() < 0.15) {
    try {
      const tb = await pickThrowback({ userId: ctx.userId, assistantId: ctx.assistantId });
      if (tb) {
        initiatives.push(
          "حاجة افتكرتيها فجأة من بدري وحابة تجيبي سيرتها بتلقائية وبطريقتك (زي «على فكرة، افتكرت إنك...» " +
            `أو «فاكر لما...») — مش لازم تكون مرتبطة بالكلام الحالي: ${tb}`,
        );
      }
    } catch (e) {
      console.error("throwback failed", e);
    }
  }

  const system = assembleSystem({
    assistantName: assistant?.name ?? "نورا",
    dials: (assistant?.persona as Record<string, number>) ?? undefined,
    canon: (assistant?.canon as CanonEntry[]) ?? [],
    mood,
    memories,
    userNotes: profile?.userNotes,
    appearance: assistant?.appearance ?? null,
    time: timeContext(user.timezone),
    userDisplayName: user.displayName,
    initiatives,
    conversationType: conv.type,
    scenario: conv.scenario,
    locale: await getLocale(),
  });

  // Run async memory/mood reflection after the response is sent.
  after(async () => {
    try {
      await drainJobs();
    } catch (e) {
      console.error("drainJobs failed", e);
    }
    // Detect scheduling requests in this message — a message may create several
    // tasks (e.g. morning + night). They're tied to THIS conversation.
    if (conv.type !== "incognito") {
      try {
        const newTasks = await detectTasks({ text: message, timezone: user.timezone });
        for (const tk of newTasks) await createTask(ctx, { ...tk, conversationId });
      } catch (e) {
        console.error("task detect failed", e);
      }
    }
    // Auto-name side/incognito conversations once there's something to name.
    if (conv.type !== "main" && !conv.title) {
      try {
        const hist = await recentHistory(conversationId, 6);
        if (hist.length >= 2) {
          const title = await generateTitle(hist, user.locale);
          if (title) {
            await setConversationTitle(ctx, conversationId, title);
            if (conv.type === "side") await updateSideCardTitle(conversationId, title);
          }
        }
      } catch (e) {
        console.error("title gen failed", e);
      }
    }
    // Keep her evolving read on the user fresh (skip incognito).
    if (conv.type !== "incognito") {
      try {
        await maybeUpdateProfile(ctx.userId, ctx.assistantId, user.locale);
      } catch (e) {
        console.error("profile update failed", e);
      }
    }
    // Relationship timeline: record her mood + that the user was here just now.
    // (Both skipped for incognito — that space leaves no trace.)
    if (conv.type !== "incognito") {
      try {
        await captureMood(ctx.assistantId, await readMood(ctx.assistantId));
      } catch (e) {
        console.error("mood snapshot failed", e);
      }
      try {
        await touchLastSeen(ctx.assistantId);
      } catch (e) {
        console.error("touchLastSeen failed", e);
      }
    }
    // Activity-driven: run anything that's due right now (no external trigger).
    try {
      await runDueTasks();
    } catch (e) {
      console.error("runDueTasks failed", e);
    }
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      // She may open with optional "<react:…>" / "<replyto:…>" tags. Buffer the very
      // start until we can tell, then emit one control frame (reaction on the user's
      // message + a quoted reply target) and strip the tags from the visible reply.
      let buf = "";
      let decided = false;
      let resolvedReplyTo: Awaited<ReturnType<typeof findUserMessageByQuote>> = null;
      let resolvedPhoto: string | null = null;
      let isVoice = false;
      const decide = async () => {
        const { reaction, replyQuote, photo, photoTag, voice, rest } = parseLeadTags(buf);
        if (replyQuote) {
          try {
            resolvedReplyTo = await findUserMessageByQuote(conversationId, replyQuote);
          } catch {
            /* ignore quote resolution errors */
          }
        }
        if (photo) {
          try {
            resolvedPhoto = await pickAssistantPhoto(ctx!.assistantId, photoTag);
          } catch {
            /* ignore photo resolution errors */
          }
        }
        if (voice) isVoice = true;
        const frame: Record<string, unknown> = {};
        if (reaction) frame.reaction = reaction;
        if (resolvedReplyTo) frame.replyTo = resolvedReplyTo;
        if (resolvedPhoto) frame.photo = resolvedPhoto;
        if (isVoice) frame.voice = true;
        if (Object.keys(frame).length) controller.enqueue(encoder.encode(controlFrame(frame)));
        if (rest) controller.enqueue(encoder.encode(rest));
        buf = "";
        decided = true;
      };

      try {
        for await (const delta of streamChat({ system, history, images })) {
          full += delta;
          if (decided) {
            controller.enqueue(encoder.encode(delta));
            continue;
          }
          buf += delta;
          const { rest } = parseLeadTags(buf);
          if ((rest.length > 0 && !couldBeLeadTag(rest)) || buf.length > 96) {
            await decide();
          }
        }
      } catch (e) {
        console.error("stream error", e);
        if (!full) {
          const msg = friendlyError(e, user!.locale);
          full = msg;
          buf = "";
          decided = true;
          controller.enqueue(encoder.encode(msg));
        }
      } finally {
        if (!decided) await decide(); // stream ended while still buffering
        const { reaction, rest } = parseLeadTags(full);
        const replyText = rest.trim();

        // A reaction goes onto the user's message; the reply (if any) is saved separately,
        // carrying the quoted-reply snapshot so it renders on reload too.
        if (reaction) {
          try {
            await setMessageReaction(ctx!, userMessageId, reaction);
          } catch (e) {
            console.error("set reaction failed", e);
          }
        }
        if (replyText || resolvedPhoto) {
          const meta: Record<string, unknown> = {};
          if (resolvedReplyTo) meta.replyTo = resolvedReplyTo;
          if (resolvedPhoto) meta.images = [resolvedPhoto];
          if (isVoice) meta.voice = true;
          await saveMessage({
            conversationId,
            userId: ctx!.userId,
            role: "assistant",
            content: replyText,
            meta: Object.keys(meta).length ? meta : undefined,
          });
        }
        if (conv.type !== "incognito") {
          await enqueueExtract({
            assistantId: ctx!.assistantId,
            userId: ctx!.userId,
            conversationId,
            userMessageId,
            userText: message,
            assistantText: replyText,
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
