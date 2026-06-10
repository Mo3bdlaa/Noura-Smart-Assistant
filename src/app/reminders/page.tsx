"use client";

import { useEffect, useState } from "react";
import { Bell, CalendarHeart, CheckSquare, Globe, Plus, Sparkles, Square, StickyNote, Trash2 } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, Chip, EmptyState } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/components/i18n";
import { cn } from "@/lib/cn";

type Reminder = {
  id: string;
  kind: "reminder" | "important_date";
  title: string;
  dueAt: string | null;
  recurrence: "yearly" | null;
  firedAt: string | null;
};

type Task = {
  id: string;
  kind: "remind" | "digest" | "nudge";
  title: string;
  nextRunAt: string;
  recurrence: "once" | "daily" | "weekly";
};

type SecItem = { id: string; kind: "todo" | "note"; content: string; done: boolean };

export default function RemindersPage() {
  const confirm = useConfirm();
  const toast = useToast();
  const { t, locale } = useI18n();
  const [items, setItems] = useState<Reminder[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [todos, setTodos] = useState<SecItem[]>([]);
  const [notes, setNotes] = useState<SecItem[]>([]);
  const [todoText, setTodoText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<"reminder" | "important_date">("reminder");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [rRes, tRes, sRes] = await Promise.all([
      fetch("/api/reminders"),
      fetch("/api/tasks"),
      fetch("/api/secretary"),
    ]);
    setItems((await rRes.json()).reminders ?? []);
    setTasks((await tRes.json().catch(() => ({}))).tasks ?? []);
    const sec = await sRes.json().catch(() => ({}));
    setTodos(sec.todos ?? []);
    setNotes(sec.notes ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function addSec(kind: "todo" | "note", content: string) {
    if (!content.trim()) return;
    const res = await fetch("/api/secretary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, content: content.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.item) {
      if (kind === "todo") setTodos((x) => [data.item, ...x]);
      else setNotes((x) => [data.item, ...x]);
    }
    kind === "todo" ? setTodoText("") : setNoteText("");
  }
  async function toggleSec(id: string) {
    setTodos((x) => x.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
    await fetch("/api/secretary", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }
  async function delSec(id: string, kind: "todo" | "note") {
    await fetch("/api/secretary", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (kind === "todo") setTodos((x) => x.filter((i) => i.id !== id));
    else setNotes((x) => x.filter((i) => i.id !== id));
  }

  async function delTask(id: string) {
    const ok = await confirm({
      title: t("توقف المهمة دي؟", "Stop this task?"),
      confirmText: t("وقّف", "Stop"),
      cancelText: t("إلغاء", "Cancel"),
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    setTasks((x) => x.filter((r) => r.id !== id));
  }

  function fmtTask(r: Task): string {
    const loc = locale === "en" ? "en-US" : "ar-EG";
    const d = new Date(r.nextRunAt).toLocaleString(loc, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const rec =
      r.recurrence === "daily"
        ? t("يوميًا", "daily")
        : r.recurrence === "weekly"
          ? t("أسبوعيًا", "weekly")
          : "";
    return rec ? `${d} · ${rec}` : d;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !when) {
      toast(t("اكتب العنوان والتاريخ", "Enter a title and date"), "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          title: title.trim(),
          dueAt: new Date(when).toISOString(),
          recurrence: kind === "important_date" ? "yearly" : undefined,
        }),
      });
      if (!res.ok) {
        toast(t("مش قادر أحفظ", "Couldn't save"), "error");
        return;
      }
      setTitle("");
      setWhen("");
      toast(t("اتسجّل ✅", "Saved ✅"), "success");
      load();
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    const ok = await confirm({
      title: t("تمسح ده؟", "Delete this?"),
      confirmText: t("امسح", "Delete"),
      cancelText: t("إلغاء", "Cancel"),
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/reminders/${id}`, { method: "DELETE" });
    setItems((x) => x.filter((r) => r.id !== id));
  }

  function fmt(r: Reminder): string {
    if (!r.dueAt) return "";
    const loc = locale === "en" ? "en-US" : "ar-EG";
    const d = new Date(r.dueAt);
    return r.kind === "important_date"
      ? d.toLocaleDateString(loc, { day: "numeric", month: "long" })
      : d.toLocaleString(loc, {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
  }

  // Next time this fires (yearly dates → upcoming anniversary).
  function nextOccurrence(r: Reminder): Date | null {
    if (!r.dueAt) return null;
    const d = new Date(r.dueAt);
    if (r.recurrence === "yearly") {
      const now = new Date();
      const next = new Date(d);
      next.setFullYear(now.getFullYear());
      const todayMid = new Date(now);
      todayMid.setHours(0, 0, 0, 0);
      if (next < todayMid) next.setFullYear(now.getFullYear() + 1);
      return next;
    }
    return d;
  }

  function countdown(r: Reminder): { label: string; tone: "accent" | "warm" } | null {
    const date = nextOccurrence(r);
    if (!date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tgt = new Date(date);
    tgt.setHours(0, 0, 0, 0);
    const days = Math.round((tgt.getTime() - today.getTime()) / 86_400_000);
    if (days < 0) return null;
    if (days === 0) return { label: t("النهاردة", "Today"), tone: "accent" };
    if (days === 1) return { label: t("بكرة", "Tomorrow"), tone: "accent" };
    return { label: t(`باقي ${days} يوم`, `in ${days}d`), tone: days <= 7 ? "warm" : "accent" };
  }

  // Soonest upcoming first; past non-recurring ones sink to the bottom.
  const sortedItems = [...items].sort((a, b) => {
    const na = nextOccurrence(a);
    const nb = nextOccurrence(b);
    const pa = !!(na && na < new Date() && a.recurrence !== "yearly");
    const pb = !!(nb && nb < new Date() && b.recurrence !== "yearly");
    if (pa !== pb) return pa ? 1 : -1;
    return (na?.getTime() ?? Infinity) - (nb?.getTime() ?? Infinity);
  });

  return (
    <PageShell title={t("مهامك وتذكيراتك", "Your tasks & reminders")} icon={<Bell className="size-5" />}>
      {/* to-do list (she manages these too) */}
      <Card className="p-5 mb-5">
        <h2 className="text-sm font-bold text-ink mb-3 flex items-center gap-1.5">
          <CheckSquare className="size-4 text-accent" /> {t("مهامي", "My to-dos")}
        </h2>
        <div className="flex gap-2 mb-3">
          <Input
            value={todoText}
            onChange={(e) => setTodoText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSec("todo", todoText)}
            placeholder={t("أعمل إيه؟", "What to do?")}
            className="h-11"
          />
          <Button variant="outline" onClick={() => addSec("todo", todoText)}>
            <Plus className="size-4" />
          </Button>
        </div>
        {todos.length === 0 ? (
          <p className="text-sm text-muted">{t("مفيش مهام — ضيف واحدة أو سيب نورا تسجّلها من الشات.", "No to-dos — add one or let her capture them in chat.")}</p>
        ) : (
          <ul className="space-y-1.5">
            {todos.map((it) => (
              <li key={it.id} className="flex items-center gap-2.5 group">
                <button onClick={() => toggleSec(it.id)} aria-label="done" className="shrink-0">
                  {it.done ? (
                    <CheckSquare className="size-5 text-accent" />
                  ) : (
                    <Square className="size-5 text-muted" />
                  )}
                </button>
                <span className={cn("flex-1 text-sm text-ink", it.done && "line-through text-muted")}>
                  {it.content}
                </span>
                <IconButton size="sm" subtle onClick={() => delSec(it.id, "todo")} aria-label="حذف">
                  <Trash2 className="size-4" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* quick notes */}
      <Card className="p-5 mb-6">
        <h2 className="text-sm font-bold text-ink mb-3 flex items-center gap-1.5">
          <StickyNote className="size-4 text-accent" /> {t("نوتس", "Notes")}
        </h2>
        <div className="flex gap-2 mb-3">
          <Input
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSec("note", noteText)}
            placeholder={t("احفظيلي إن...", "Note to keep...")}
            className="h-11"
          />
          <Button variant="outline" onClick={() => addSec("note", noteText)}>
            <Plus className="size-4" />
          </Button>
        </div>
        {notes.length > 0 && (
          <ul className="space-y-1.5">
            {notes.map((it) => (
              <li key={it.id} className="flex items-start gap-2.5 group">
                <StickyNote className="size-4 text-faint mt-0.5 shrink-0" />
                <span className="flex-1 text-sm text-ink">{it.content}</span>
                <IconButton size="sm" subtle onClick={() => delSec(it.id, "note")} aria-label="حذف">
                  <Trash2 className="size-4" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* add reminder form */}
      <Card className="p-5 mb-6">
        <div className="flex gap-2 mb-4">
          <KindTab active={kind === "reminder"} onClick={() => setKind("reminder")} icon={<Bell className="size-4" />} label={t("تذكير", "Reminder")} />
          <KindTab active={kind === "important_date"} onClick={() => setKind("important_date")} icon={<CalendarHeart className="size-4" />} label={t("مناسبة سنوية", "Yearly date")} />
        </div>
        <form onSubmit={add} className="space-y-3">
          <Input
            placeholder={
              kind === "reminder"
                ? t("أفكّرك بإيه؟", "Remind you of what?")
                : t("مناسبة إيه؟ (عيد ميلاد، ذكرى...)", "Which occasion? (birthday, anniversary...)")
            }
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Input
            type={kind === "important_date" ? "date" : "datetime-local"}
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="[color-scheme:light] dark:[color-scheme:dark]"
          />
          <Button type="submit" loading={saving}>
            <Plus className="size-4" /> {t("ضيف", "Add")}
          </Button>
        </form>
      </Card>

      {/* auto tasks (created from chat) */}
      {tasks.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-muted mb-2 flex items-center gap-1.5">
            <Sparkles className="size-4 text-accent" /> {t("مهام تلقائية", "Auto tasks")}
          </h2>
          <ul className="space-y-2">
            {tasks.map((r) => (
              <li
                key={r.id}
                className="group flex items-center gap-3 bg-surface border border-border rounded-2xl px-4 py-3 shadow-soft animate-fade-in"
              >
                <span className="grid place-items-center size-10 rounded-xl bg-accent-soft text-accent shrink-0">
                  {r.kind === "digest" ? <Globe className="size-5" /> : <Bell className="size-5" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-ink truncate">{r.title}</div>
                  <div className="text-xs text-muted">{fmtTask(r)}</div>
                </div>
                <IconButton size="sm" subtle onClick={() => delTask(r.id)} aria-label={t("حذف", "Delete")}>
                  <Trash2 className="size-4" />
                </IconButton>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* list */}
      {loading ? (
        <ul className="space-y-2">
          {[0, 1].map((i) => (
            <li key={i} className="h-16 rounded-2xl bg-surface border border-border animate-pulse" />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <EmptyState icon={<Bell className="size-6" />} title={t("مفيش تذكيرات لسه", "No reminders yet")}>
          {t("ضيف تذكير أو مناسبة، ومساعدك هيفكّرك بيها في وقتها.", "Add a reminder or date and your assistant will nudge you in time.")}
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {sortedItems.map((r) => {
            const past = r.dueAt && new Date(r.dueAt) < new Date() && !r.recurrence;
            const cd = past ? null : countdown(r);
            return (
              <li
                key={r.id}
                className="group flex items-center gap-3 bg-surface border border-border rounded-2xl px-4 py-3 shadow-soft animate-fade-in"
              >
                <span
                  className={cn(
                    "grid place-items-center size-10 rounded-xl shrink-0",
                    r.kind === "important_date" ? "bg-amber/15 text-brown" : "bg-accent-soft text-accent",
                  )}
                >
                  {r.kind === "important_date" ? (
                    <CalendarHeart className="size-5" />
                  ) : (
                    <Bell className="size-5" />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={cn("text-ink truncate", past && "line-through text-muted")}>
                    {r.title}
                  </div>
                  <div className="text-xs text-muted flex items-center gap-1.5 flex-wrap">
                    {fmt(r)}
                    {cd && <Chip tone={cd.tone}>{cd.label}</Chip>}
                    {r.recurrence === "yearly" && <Chip tone="warm">{t("كل سنة", "Yearly")}</Chip>}
                  </div>
                </div>
                <IconButton size="sm" subtle onClick={() => del(r.id)} aria-label="حذف">
                  <Trash2 className="size-4" />
                </IconButton>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}

function KindTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-theme",
        active ? "bg-accent-soft text-accent" : "bg-elevated text-muted hover:text-ink",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
