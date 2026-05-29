import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/guard";
import { isInitialized } from "@/lib/settings";

export default async function Home() {
  if (!(await isInitialized())) redirect("/setup");
  const user = await currentUser();
  redirect(user ? "/chat" : "/login");
}
