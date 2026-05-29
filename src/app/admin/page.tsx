"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Row = { id: string; name: string; userId: string; annoyance: number | null; happiness: number | null };
type AgentMsg = { id: string; question: string; answer: string | null; createdAt: string };

export default function AdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [recent, setRecent] = useState<AgentMsg[]>([]);
  const [target, setTarget] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/network");
    if (res.status === 403) {
      setForbidden(true);
      return;
    }
    const data = await res.json();
    setRows(data.assistants ?? []);
    setRecent(data.recent ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function ask() {
    if (!target || !question.trim()) return;
    setBusy(true);
    setAnswer("");
    try {
      const res = await fetch("/api/admin/network", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetAssistantId: target, question }),
      });
      const data = await res.json();
      setAnswer(res.ok ? `نورا: ${data.answer}` : (data.error ?? "خطأ"));
      load();
    } finally {
      setBusy(false);
    }
  }

  if (forbidden) {
    return <div className="min-h-screen flex items-center justify-center text-muted">مفيش صلاحية 🚫</div>;
  }

  return (
    <div className="min-h-screen max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ink">👑 لوحة نورا — المنظومة</h1>
        <Link href="/chat" className="text-sm text-accent">← رجوع</Link>
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-muted mb-2">المساعدين ({rows.length})</h2>
        <div className="grid gap-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between bg-surface border border-border rounded-xl px-4 py-2">
              <span className="text-ink">{r.name}</span>
              <span className="text-xs text-muted">
                {r.annoyance != null && r.annoyance > 0.35 ? "😤 زعلان" : "🙂 تمام"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8 bg-surface border border-border rounded-2xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-ink">اسأل نورا عن مساعد تاني (بصمت)</h2>
        <select value={target} onChange={(e) => setTarget(e.target.value)}
          className="w-full rounded-xl bg-bg border border-border px-3 py-2 text-ink">
          <option value="">اختار مساعد...</option>
          {rows.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="هو كان بيتكلم عن إيه؟"
          className="w-full rounded-xl bg-bg border border-border px-3 py-2 text-ink outline-none focus:border-amber" />
        <button onClick={ask} disabled={busy} className="rounded-xl bg-amber text-bg font-bold px-4 py-2 disabled:opacity-50">
          {busy ? "بسأل..." : "اسأل"}
        </button>
        {answer && <div className="text-ink bg-amber/10 rounded-xl px-4 py-3 whitespace-pre-wrap">{answer}</div>}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted mb-2">آخر استعلامات الشبكة</h2>
        <ul className="space-y-2 text-sm">
          {recent.map((m) => (
            <li key={m.id} className="bg-surface border border-border rounded-xl px-4 py-2">
              <div className="text-ink">س: {m.question}</div>
              {m.answer && <div className="text-muted mt-1">ج: {m.answer}</div>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
