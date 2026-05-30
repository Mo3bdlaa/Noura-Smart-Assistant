"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";

export default function LoginPage() {
  const router = useRouter();
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
      title="أهلًا، اشتقتلك 🙂"
      subtitle="ادخل نكمّل كلامنا من حيث ما وقفنا."
      footer={
        <>
          لسه ماعندكش حساب؟{" "}
          <Link href="/register" className="text-accent font-semibold hover:underline">
            اعمل واحد
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="text-sm bg-danger-soft text-danger rounded-xl px-3 py-2.5">{error}</div>
        )}
        <Field label="الإيميل">
          <Input
            type="email"
            required
            autoComplete="email"
            placeholder="[email protected]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="الباسورد">
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
          دخول
        </Button>
      </form>
    </AuthShell>
  );
}
