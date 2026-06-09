import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/guard";
import { OnboardingWizard } from "@/components/OnboardingWizard";

export default async function OnboardingPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.onboardedAt) redirect("/chat");
  return <OnboardingWizard isAdmin={user.role === "admin"} />;
}
