"use client";

import { useEffect, useState } from "react";
import { Brain, ChevronDown, Crown, Lock, MessagesSquare, Send, Unlock, Users } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, Chip, EmptyState } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { useI18n } from "@/components/i18n";
import { cn } from "@/lib/cn";

type Report = {
  summary?: string;
  traits?: { name: string; note: string }[];
  communication_style?: string;
  interests?: string[];
  values?: string[];
  emotional_patterns?: string;
  how_to_support?: string;
};
type Row = {
  id: string;
  email: string;
  displayName: string | null;
  role: "admin" | "user";
  createdAt: string;
  locale: string;
  timezone: string | null;
  assistantId: string | null;
  assistantName: string | null;
  happiness: number | null;
  annoyance: number | null;
  userMessages: number;
  memoryCount: number;
  lastActive: string | null;
  profileSummary: string | null;
  profileReport: Report | null;
  isLocked: boolean;
  userNotes: string | null;
};
type AgentMsg = { id: string; question: string; answer: string | null; createdAt: string };

export default function AdminPage() {
  const { t, locale } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [recent, setRecent] = useState<AgentMsg[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  async function load() {
    const [oRes, nRes] = await Promise.all([
      fetch("/api/admin/overview"),
      fetch("/api/admin/network"),
    ]);
    if (oRes.status === 403 || nRes.status === 403) {
      setForbidden(true);
      return;
    }
    setRows((await oRes.json()).users ?? []);
    setRecent((await nRes.json().catch(() => ({}))).recent ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function toggleLock(u: Row) {
    const next = !u.isLocked;
    setRows((rs) => rs.map((r) => (r.id === u.id ? { ...r, isLocked: next } : r)));
    await fetch(`/api/admin/user/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isLocked: next }),
    });
  }

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
      setAnswer(res.ok ? data.answer : (data.error ?? t("خطأ", "Error")));
    } finally {
      setBusy(false);
    }
  }

  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString(locale === "en" ? "en-US" : "ar-EG", { day: "numeric", month: "short" }) : "—";

  if (forbidden) {
    return (
      <PageShell title={t("لوحة الأدمن", "Admin")} icon={<Crown className="size-5" />}>
        <EmptyState title={t("مفيش صلاحية 🚫", "No access 🚫")}>
          {t("الصفحة دي للأدمن بس.", "This page is admins only.")}
        </EmptyState>
      </PageShell>
    );
  }

  return (
    <PageShell title={t("لوحة الأدمن", "Admin")} icon={<Crown className="size-5" />}>
      {/* stat cards */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        <Stat icon={<Users className="size-4" />} label={t("مستخدمين", "Users")} value={rows.length} />
        <Stat icon={<MessagesSquare className="size-4" />} label={t("رسائل", "Messages")} value={rows.reduce((s, r) => s + (r.userMessages || 0), 0)} />
        <Stat icon={<Brain className="size-4" />} label={t("ذكريات", "Memories")} value={rows.reduce((s, r) => s + (r.memoryCount || 0), 0)} />
      </div>

      <h2 className="text-sm font-semibold text-muted mb-2">
        {t("المستخدمين", "Users")} ({rows.length})
      </h2>
      <div className="grid gap-2 mb-8">
        {rows.map((r) => {
          const upset = r.annoyance != null && r.annoyance > 0.35;
          const isOpen = open === r.id;
          return (
            <Card key={r.id} className="overflow-hidden">
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-start"
                onClick={() => setOpen(isOpen ? null : r.id)}
              >
                <Avatar name={r.assistantName ?? "?"} size="md" mood={upset ? "upset" : "happy"} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink truncate">{r.displayName || r.email}</span>
                    {r.role === "admin" && <Chip tone="warm">admin</Chip>}
                    {r.isLocked && <Chip tone="danger">{t("مقفول", "locked")}</Chip>}
                  </div>
                  <div className="text-xs text-muted truncate">
                    {t("مساعد", "Assistant")}: {r.assistantName ?? "—"} · 💬 {r.userMessages} · 🧠{" "}
                    {r.memoryCount} · {t("آخر نشاط", "last")}: {fmtDate(r.lastActive)}
                  </div>
                </div>
                <ChevronDown className={cn("size-4 text-muted transition-transform", isOpen && "rotate-180")} />
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-border space-y-3 text-sm animate-fade-in">
                  <div className="text-xs text-muted">
                    {r.email} · {r.locale?.toUpperCase()} · {r.timezone ?? ""}
                  </div>
                  {r.profileReport ? (
                    <Profile report={r.profileReport} t={t} />
                  ) : (
                    <p className="text-muted">{t("لسه مفيش تحليل شخصية كفاية.", "Not enough data for a profile yet.")}</p>
                  )}
                  {r.userNotes && (
                    <div className="bg-bg rounded-xl px-3 py-2">
                      <span className="text-xs font-semibold text-muted">{t("ملاحظات المستخدم", "User notes")}: </span>
                      <span className="text-ink">{r.userNotes}</span>
                    </div>
                  )}
                  {r.role !== "admin" && (
                    <Button
                      size="sm"
                      variant={r.isLocked ? "primary" : "outline"}
                      onClick={() => toggleLock(r)}
                    >
                      {r.isLocked ? (
                        <>
                          <Unlock className="size-4" /> {t("فتح الحساب", "Unlock")}
                        </>
                      ) : (
                        <>
                          <Lock className="size-4" /> {t("قفل الحساب", "Lock")}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        {rows.length === 0 && <p className="text-sm text-faint">{t("مفيش مستخدمين.", "No users.")}</p>}
      </div>

      {/* ask the network */}
      <Card className="p-4 space-y-3 mb-8">
        <h2 className="font-semibold text-ink">{t("اسأل مساعدك عن مساعد تاني (بصمت)", "Ask your assistant about another (silently)")}</h2>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="w-full h-12 rounded-xl bg-bg border border-border px-3 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-ring/40 transition-theme"
        >
          <option value="">{t("اختار مساعد...", "Pick an assistant...")}</option>
          {rows.filter((r) => r.assistantId).map((r) => (
            <option key={r.assistantId!} value={r.assistantId!}>
              {r.assistantName} — {r.displayName || r.email}
            </option>
          ))}
        </select>
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t("هو كان بيتكلم عن إيه؟", "What were they talking about?")} />
        <Button onClick={ask} loading={busy}>
          <Send className="size-4" /> {t("اسأل", "Ask")}
        </Button>
        {answer && (
          <div className="text-ink bg-accent-soft rounded-xl px-4 py-3 whitespace-pre-wrap text-sm leading-relaxed">{answer}</div>
        )}
      </Card>

      <h2 className="text-sm font-semibold text-muted mb-2">{t("آخر استعلامات الشبكة", "Recent network queries")}</h2>
      <ul className="space-y-2">
        {recent.length === 0 ? (
          <p className="text-sm text-faint">{t("مفيش استعلامات لسه.", "No queries yet.")}</p>
        ) : (
          recent.map((m) => (
            <Card key={m.id} className="px-4 py-3 text-sm">
              <div className="text-ink"><span className="text-faint">{t("س:", "Q:")}</span> {m.question}</div>
              {m.answer && <div className="text-muted mt-1"><span className="text-faint">{t("ج:", "A:")}</span> {m.answer}</div>}
            </Card>
          ))
        )}
      </ul>
    </PageShell>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="p-3 text-center">
      <div className="mx-auto mb-1 grid place-items-center size-8 rounded-xl bg-accent-soft text-accent">
        {icon}
      </div>
      <div className="text-xl font-extrabold text-ink leading-none">{value}</div>
      <div className="text-[11px] text-muted mt-0.5">{label}</div>
    </Card>
  );
}

function Profile({ report, t }: { report: Report; t: (a: string, e: string) => string }) {
  return (
    <div className="space-y-2.5">
      {report.summary && <p className="text-ink leading-relaxed">{report.summary}</p>}
      {report.traits && report.traits.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {report.traits.map((tr, i) => (
            <Chip key={i} tone="accent" className="whitespace-normal">
              {tr.name}
            </Chip>
          ))}
        </div>
      )}
      <Section label={t("أسلوب الكلام", "Communication")} value={report.communication_style} />
      <Section label={t("اهتماماته", "Interests")} value={report.interests?.join("، ")} />
      <Section label={t("اللي بيهمّه", "Values")} value={report.values?.join("، ")} />
      <Section label={t("نمطه العاطفي", "Emotional patterns")} value={report.emotional_patterns} />
      <Section label={t("إزاي تسانده", "How to support")} value={report.how_to_support} />
    </div>
  );
}

function Section({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-xs font-semibold text-muted">{label}: </span>
      <span className="text-ink text-sm">{value}</span>
    </div>
  );
}
