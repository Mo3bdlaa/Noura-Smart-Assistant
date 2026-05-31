import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth/guard";
import { tenantForUser } from "@/lib/db/tenant";
import { db } from "@/lib/db/client";
import { assistants } from "@/lib/db/schema";
import { getConversation, listMessages } from "@/lib/chat/store";
import { readMood, type MoodSnapshot } from "@/lib/mood/state";
import { ChatWindow } from "@/components/ChatWindow";

function moodKind(m: MoodSnapshot): "happy" | "calm" | "upset" {
  if (m.annoyance > 0.35) return "upset";
  if (m.happiness > 0.65) return "happy";
  return "calm";
}

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const ctx = await tenantForUser(user.id, user.role);
  const { conversationId } = await params;

  const conv = await getConversation(ctx, conversationId);
  if (!conv) notFound();

  const [assistant] = await db
    .select({ name: assistants.name })
    .from(assistants)
    .where(eq(assistants.id, ctx.assistantId))
    .limit(1);
  const mood = await readMood(ctx.assistantId);
  const msgs = await listMessages(ctx, conversationId);

  return (
    <ChatWindow
      conversationId={conv.id}
      conversationType={conv.type}
      scenario={conv.scenario}
      assistantName={assistant?.name ?? "نورا"}
      assistantMood={moodKind(mood)}
      initialMessages={msgs
        .filter((m) => m.role !== "system" || (m.meta as { sideCard?: string } | null)?.sideCard)
        .map((m) => {
          const meta =
            (m.meta as { reaction?: string | null; images?: string[]; sideCard?: string } | null) ?? null;
          return {
            id: m.id,
            role: m.role === "user" ? ("user" as const) : ("assistant" as const),
            content: m.content,
            reaction: meta?.reaction ?? null,
            images: meta?.images,
            sideCardId: meta?.sideCard,
          };
        })}
    />
  );
}
