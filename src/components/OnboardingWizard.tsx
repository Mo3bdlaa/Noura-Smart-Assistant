"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/components/i18n";

/**
 * Minimal first-run: you "hire" your personal secretary by naming her. Everything
 * else starts at sensible defaults and is tweakable later in Settings — no big
 * choices upfront. The relationship grows from there.
 */
export function OnboardingWizard({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function finish() {
    if (name.trim().length < 2) {
      toast(t("اكتب اسم مناسب", "Pick a name"), "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistantName: name.trim(), archetype: "progressive" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error ?? t("في حاجة غلط", "Something went wrong"), "error");
        return;
      }
      router.push("/chat");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={t("عيّنت سكرتيرتك الشخصية 💼", "Meet your new personal secretary 💼")}
      subtitle={t(
        "اديها اسم وابدأ. هتبدأ سكرتيرة، والعلاقة هتكبر حسب تعاملك معاها — وتقدر تظبط أي حاجة بعدين من الإعدادات.",
        "Give her a name and start. She begins as your secretary, and your bond grows with how you treat her — tweak anything later in Settings.",
      )}
    >
      <div className="space-y-4">
        <Field label={t("اسمها", "Her name")}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && finish()}
            placeholder={
              isAdmin ? t('أي اسم — حتى "نورا"', 'Any name — even "Noura"') : t("مثلاً: لمى، مايا، ...", "e.g. Lina, Maya, ...")
            }
            autoFocus
          />
        </Field>
        <Button type="button" block size="lg" onClick={finish} loading={busy}>
          <Sparkles className="size-4" /> {t("يلا نبدأ", "Let's start")}
        </Button>
      </div>
    </AuthShell>
  );
}
