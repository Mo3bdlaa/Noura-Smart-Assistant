"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";

export default function RegisterPage() {
  const router = useRouter();
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
        setError(data.error ?? "في حاجة غلط");
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
      title="اعمل حساب جديد"
      subtitle="اختار اسم لمساعدك الخاص بيك، وابدأ علاقتكم."
      footer={
        <>
          عندك حساب؟{" "}
          <Link href="/login" className="text-accent font-semibold hover:underline">
            ادخل
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="text-sm bg-danger-soft text-danger rounded-xl px-3 py-2.5">{error}</div>
        )}
        <Field label="اسمك">
          <Input required placeholder="مثلاً: محمد" value={form.displayName} onChange={set("displayName")} />
        </Field>
        <Field label="الإيميل">
          <Input type="email" required autoComplete="email" placeholder="[email protected]" value={form.email} onChange={set("email")} />
        </Field>
        <Field label="الباسورد" hint="٨ حروف على الأقل">
          <Input type="password" required autoComplete="new-password" placeholder="••••••••" value={form.password} onChange={set("password")} />
        </Field>
        <Field label="اسم مساعدك" hint='أي اسم يعجبك (مش "نورا" 😏)'>
          <Input required placeholder="مثلاً: سلمى، ليلى..." value={form.assistantName} onChange={set("assistantName")} />
        </Field>
        <Button type="submit" block size="lg" loading={busy}>
          يلا نبدأ
        </Button>
      </form>
    </AuthShell>
  );
}
