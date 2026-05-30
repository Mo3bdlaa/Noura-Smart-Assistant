"use client";

import { useEffect, useState } from "react";
import { Crown, Send } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, Chip, EmptyState } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";

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
      setAnswer(res.ok ? data.answer : (data.error ?? "خطأ"));
      load();
    } finally {
      setBusy(false);
    }
  }

  if (forbidden) {
    return (
      <PageShell title="لوحة الأدمن" icon={<Crown className="size-5" />}>
        <EmptyState title="مفيش صلاحية 🚫">الصفحة دي للأدمن بس.</EmptyState>
      </PageShell>
    );
  }

  return (
    <PageShell title="لوحة نورا — المنظومة" icon={<Crown className="size-5" />}>
      {/* assistants */}
      <h2 className="text-sm font-semibold text-muted mb-2">المساعدين ({rows.length})</h2>
      <div className="grid gap-2 mb-8">
        {rows.length === 0 ? (
          <p className="text-sm text-faint">لسه مفيش مساعدين تانيين.</p>
        ) : (
          rows.map((r) => {
            const upset = r.annoyance != null && r.annoyance > 0.35;
            return (
              <Card key={r.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={r.name} size="sm" mood={upset ? "upset" : "happy"} />
                <span className="flex-1 text-ink font-medium">{r.name}</span>
                <Chip tone={upset ? "danger" : "accent"}>{upset ? "😤 زعلان" : "🙂 تمام"}</Chip>
              </Card>
            );
          })
        )}
      </div>

      {/* ask the network */}
      <Card className="p-4 space-y-3 mb-8">
        <h2 className="font-semibold text-ink">اسأل نورا عن مساعد تاني (بصمت)</h2>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="w-full h-12 rounded-xl bg-bg border border-border px-3 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-ring/40 transition-theme"
        >
          <option value="">اختار مساعد...</option>
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="هو كان بيتكلم عن إيه؟"
        />
        <Button onClick={ask} loading={busy}>
          <Send className="size-4" /> اسأل
        </Button>
        {answer && (
          <div className="text-ink bg-accent-soft rounded-xl px-4 py-3 whitespace-pre-wrap text-sm leading-relaxed">
            {answer}
          </div>
        )}
      </Card>

      {/* recent */}
      <h2 className="text-sm font-semibold text-muted mb-2">آخر استعلامات الشبكة</h2>
      <ul className="space-y-2">
        {recent.length === 0 ? (
          <p className="text-sm text-faint">مفيش استعلامات لسه.</p>
        ) : (
          recent.map((m) => (
            <Card key={m.id} className="px-4 py-3 text-sm">
              <div className="text-ink">
                <span className="text-faint">س:</span> {m.question}
              </div>
              {m.answer && (
                <div className="text-muted mt-1">
                  <span className="text-faint">ج:</span> {m.answer}
                </div>
              )}
            </Card>
          ))
        )}
      </ul>
    </PageShell>
  );
}
