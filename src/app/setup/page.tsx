import { redirect } from "next/navigation";
import { isInitialized } from "@/lib/settings";
import { SetupWizard } from "@/components/SetupWizard";

export default async function SetupPage() {
  if (await isInitialized()) redirect("/login");
  return <SetupWizard />;
}
