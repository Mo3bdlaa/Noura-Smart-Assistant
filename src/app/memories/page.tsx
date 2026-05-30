"use client";

import { useEffect, useState } from "react";
import { Brain, Trash2 } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Chip, EmptyState } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/components/i18n";

type Mem = { id: string; type: string; content: string; importance: number; createdAt: string };

const TYPE_LABEL: Record<string, [string, string]> = {
  profile: ["معلومة", "Fact"],
  preference: ["تفضيل", "Preference"],
  topic: ["موضوع", "Topic"],
  moment: ["لحظة", "Moment"],
  person: ["شخص", "Person"],
  emotional: ["مشاعر", "Feeling"],
};

export default function MemoriesPage() {
  const confirm = useConfirm();
  const toast = useToast();
  const { t } = useI18n();
  const [mems, setMems] = useState<Mem[]>([]);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/memories");
    const data = await res.json();
    setMems(data.memories ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function del(id: string) {
    const ok = await confirm({
      title: t("تشيل الذكرى دي؟", "Remove this memory?"),
      confirmText: t("شيل", "Remove"),
      cancelText: t("إلغاء", "Cancel"),
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/memories/${id}`, { method: "DELETE" });
    setMems((m) => m.filter((x) => x.id !== id));
  }

  async function forget() {
    if (!topic.trim()) return;
    const res = await fetch("/api/memories/forget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
    });
    const data = await res.json();
    toast(
      t(`نسيت ${data.forgotten ?? 0} حاجة عن "${topic}".`, `Forgot ${data.forgotten ?? 0} thing(s) about "${topic}".`),
      "success",
    );
    setTopic("");
    load();
  }

  return (
    <PageShell title={t("الذاكرة", "Memory")} icon={<Brain className="size-5" />}>
      <p className="text-sm text-muted mb-4">
        {t("اللي مساعدك فاكره عنك — تقدر تشيل أي حاجة في أي وقت.", "What your assistant remembers about you — remove anything, anytime.")}
      </p>

      <div className="flex gap-2 mb-6">
        <Input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && forget()}
          placeholder={t("انسي كل حاجة عن... (موضوع)", "Forget everything about... (a topic)")}
          className="h-11"
        />
        <Button variant="outline" onClick={forget}>
          {t("انسي", "Forget")}
        </Button>
      </div>

      {loading ? (
        <ul className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-16 rounded-2xl bg-surface border border-border animate-pulse" />
          ))}
        </ul>
      ) : mems.length === 0 ? (
        <EmptyState icon={<Brain className="size-6" />} title={t("لسه مفيش ذكريات", "No memories yet")}>
          {t("كل ما تتكلموا أكتر، هتفتكر أكتر.", "The more you talk, the more she remembers.")}
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {mems.map((m) => (
            <li
              key={m.id}
              className="group flex items-start gap-3 bg-surface border border-border rounded-2xl px-4 py-3 shadow-soft animate-fade-in"
            >
              <Chip tone="accent" className="mt-0.5 shrink-0">
                {TYPE_LABEL[m.type] ? t(TYPE_LABEL[m.type][0], TYPE_LABEL[m.type][1]) : m.type}
              </Chip>
              <span className="flex-1 text-ink text-sm leading-relaxed">{m.content}</span>
              <IconButton size="sm" subtle onClick={() => del(m.id)} aria-label="حذف">
                <Trash2 className="size-4" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
