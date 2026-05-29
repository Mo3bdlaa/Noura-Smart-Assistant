import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/guard";
import { tenantForUser } from "@/lib/db/tenant";
import { db } from "@/lib/db/client";
import { assistants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { listConversations } from "@/lib/chat/store";
import { Sidebar } from "@/components/Sidebar";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const ctx = await tenantForUser(user.id, user.role);

  const [assistant] = await db
    .select({ name: assistants.name })
    .from(assistants)
    .where(eq(assistants.id, ctx.assistantId))
    .limit(1);
  const conversations = await listConversations(ctx);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        assistantName={assistant?.name ?? "نورا"}
        isAdmin={user.role === "admin"}
        conversations={conversations.map((c) => ({
          id: c.id,
          type: c.type,
          title: c.title,
        }))}
      />
      <main className="flex-1 min-w-0 flex flex-col bg-bg">{children}</main>
    </div>
  );
}
