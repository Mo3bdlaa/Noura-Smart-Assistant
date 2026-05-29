import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/guard";
import { tenantForUser } from "@/lib/db/tenant";
import { getMainConversation } from "@/lib/chat/store";

export default async function ChatIndex() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const ctx = await tenantForUser(user.id, user.role);
  const main = await getMainConversation(ctx);
  if (!main) redirect("/login");
  redirect(`/chat/${main.id}`);
}
