import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/guard";
import { tenantForUser } from "@/lib/db/tenant";
import { getConversation, listMessages } from "@/lib/chat/store";
import { ChatWindow } from "@/components/ChatWindow";

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

  const msgs = await listMessages(ctx, conversationId);

  return (
    <ChatWindow
      conversationId={conv.id}
      conversationType={conv.type}
      initialMessages={msgs
        .filter((m) => m.role !== "system")
        .map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content }))}
    />
  );
}
