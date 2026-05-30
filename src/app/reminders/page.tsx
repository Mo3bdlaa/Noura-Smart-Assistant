"use client";

import { useEffect, useState } from "react";
import { Bell, CalendarHeart, Plus, Trash2 } from "lucide-react";
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

export default function RemindersPage() {
  const confirm = useConfirm();
  const toast = useToast();
  const { t, locale } = useI18n();
  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<"reminder" | "important_date">("reminder");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/reminders");
    const data = await res.json();
    setItems(data.reminders ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

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

  return (
    <PageShell title={t("التذكيرات والمناسبات", "Reminders & dates")} icon={<Bell className="size-5" />}>
      {/* add form */}
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
          {items.map((r) => {
            const past = r.dueAt && new Date(r.dueAt) < new Date() && !r.recurrence;
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
                  <div className="text-xs text-muted flex items-center gap-1.5">
                    {fmt(r)}
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
