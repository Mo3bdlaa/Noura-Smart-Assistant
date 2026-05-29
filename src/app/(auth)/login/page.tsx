"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
          <h1 className="text-3xl font-extrabold text-ink">نورا</h1>
          <p className="text-sm text-muted mt-1">أهلًا، اشتقتلك 🙂 ادخل نكمّل كلامنا.</p>
        </div>
        {error && <div className="text-sm bg-red-500/10 text-red-700 rounded-lg px-3 py-2">{error}</div>}
        <input
          type="email"
          required
          placeholder="الإيميل"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl bg-bg border border-border px-4 py-3 text-ink outline-none focus:border-amber"
        />
        <input
          type="password"
          required
          placeholder="الباسورد"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl bg-bg border border-border px-4 py-3 text-ink outline-none focus:border-amber"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-amber text-bg font-bold py-3 disabled:opacity-50"
        >
          {busy ? "..." : "دخول"}
        </button>
        <p className="text-center text-sm text-muted">
          لسه ماعندكش حساب؟{" "}
          <Link href="/register" className="text-accent font-semibold">
            اعمل واحد
          </Link>
        </p>
      </form>
    </div>
  );
}
