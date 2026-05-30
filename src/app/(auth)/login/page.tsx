"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";
import { useI18n } from "@/components/i18n";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
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
      title={t("أهلًا، اشتقتلك 🙂", "Welcome back 🙂")}
      subtitle={t("ادخل نكمّل كلامنا من حيث ما وقفنا.", "Log in and let's pick up where we left off.")}
      footer={
        <>
          {t("لسه ماعندكش حساب؟", "Don't have an account?")}{" "}
          <Link href="/register" className="text-accent font-semibold hover:underline">
            {t("اعمل واحد", "Create one")}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="text-sm bg-danger-soft text-danger rounded-xl px-3 py-2.5">{error}</div>
        )}
        <Field label={t("الإيميل", "Email")}>
          <Input
            type="email"
            required
            autoComplete="email"
            placeholder="[email protected]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label={t("الباسورد", "Password")}>
          <Input
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" block size="lg" loading={busy}>
          {t("دخول", "Log in")}
        </Button>
      </form>
    </AuthShell>
  );
}
