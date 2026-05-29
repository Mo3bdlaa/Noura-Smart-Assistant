"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", displayName: "", assistantName: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
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
        setError(data.error ?? "خطأ");
        return;
      }
      router.push("/chat");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-surface border border-border rounded-3xl p-8 space-y-4">
        <div className="text-center mb-2">
          <h1 className="text-2xl font-extrabold text-ink">اعمل حساب جديد</h1>
          <p className="text-sm text-muted mt-1">اختار اسم لمساعدك الخاص بيك.</p>
        </div>
        {error && <div className="text-sm bg-red-500/10 text-red-700 rounded-lg px-3 py-2">{error}</div>}
        <input required placeholder="اسمك" value={form.displayName} onChange={set("displayName")}
          className="w-full rounded-xl bg-bg border border-border px-4 py-3 text-ink outline-none focus:border-amber" />
        <input type="email" required placeholder="الإيميل" value={form.email} onChange={set("email")}
          className="w-full rounded-xl bg-bg border border-border px-4 py-3 text-ink outline-none focus:border-amber" />
        <input type="password" required placeholder="باسورد (٨ حروف على الأقل)" value={form.password} onChange={set("password")}
          className="w-full rounded-xl bg-bg border border-border px-4 py-3 text-ink outline-none focus:border-amber" />
        <input required placeholder='اسم مساعدك (مش "نورا" 😏)' value={form.assistantName} onChange={set("assistantName")}
          className="w-full rounded-xl bg-bg border border-border px-4 py-3 text-ink outline-none focus:border-amber" />
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-amber text-bg font-bold py-3 disabled:opacity-50">
          {busy ? "..." : "يلا نبدأ"}
        </button>
        <p className="text-center text-sm text-muted">
          عندك حساب؟ <Link href="/login" className="text-accent font-semibold">ادخل</Link>
        </p>
      </form>
    </div>
  );
}
