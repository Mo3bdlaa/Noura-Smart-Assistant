import { redirect } from "next/navigation";
import { isInitialized } from "@/lib/settings";
import { SetupWizard } from "@/components/SetupWizard";

// Depends on live DB state — never prerender.
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await isInitialized()) redirect("/login");
  return <SetupWizard />;
}
