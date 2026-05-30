"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";
import { useI18n } from "@/components/i18n";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [form, setForm] = useState({ email: "", password: "", displayName: "", assistantName: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("في حاجة غلط", "Something went wrong"));
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
      title={t("اعمل حساب جديد", "Create an account")}
      subtitle={t("اختار اسم لمساعدك الخاص بيك، وابدأ علاقتكم.", "Name your own assistant and start your story.")}
      footer={
        <>
          {t("عندك حساب؟", "Already have an account?")}{" "}
          <Link href="/login" className="text-accent font-semibold hover:underline">
            {t("ادخل", "Log in")}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="text-sm bg-danger-soft text-danger rounded-xl px-3 py-2.5">{error}</div>
        )}
        <Field label={t("اسمك", "Your name")}>
          <Input required placeholder={t("مثلاً: محمد", "e.g. Omar")} value={form.displayName} onChange={set("displayName")} />
        </Field>
        <Field label={t("الإيميل", "Email")}>
          <Input type="email" required autoComplete="email" placeholder="[email protected]" value={form.email} onChange={set("email")} />
        </Field>
        <Field label={t("الباسورد", "Password")} hint={t("٨ حروف على الأقل", "At least 8 characters")}>
          <Input type="password" required autoComplete="new-password" placeholder="••••••••" value={form.password} onChange={set("password")} />
        </Field>
        <Field label={t("اسم مساعدك", "Your assistant's name")} hint={t('أي اسم يعجبك (مش "نورا" 😏)', 'Any name you like (not "Noura" 😏)')}>
          <Input required placeholder={t("مثلاً: سلمى، ليلى...", "e.g. Salma, Layla...")} value={form.assistantName} onChange={set("assistantName")} />
        </Field>
        <Button type="submit" block size="lg" loading={busy}>
          {t("يلا نبدأ", "Let's start")}
        </Button>
      </form>
    </AuthShell>
  );
}
