import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/guard";

export default async function Home() {
  const user = await currentUser();
  redirect(user ? "/chat" : "/login");
}
