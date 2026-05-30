import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/guard";
import { isInitialized } from "@/lib/settings";

// Depends on live DB + session state — never prerender.
export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await isInitialized())) redirect("/setup");
  const user = await currentUser();
  redirect(user ? "/chat" : "/login");
}
