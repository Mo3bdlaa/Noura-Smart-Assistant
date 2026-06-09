"use client";

import { useEffect, useMemo, useState } from "react";
import { Brain, Plus, Sparkles, Trash2, UserCircle2 } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Chip, EmptyState } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/components/i18n";
import { cn } from "@/lib/cn";

type Mem = { id: string; type: string; content: string; importance: number; createdAt: string };

const TYPES = ["profile", "preference", "topic", "moment", "person", "emotional"] as const;
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
  const [canon, setCanon] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [newMem, setNewMem] = useState("");
  const [newType, setNewType] = useState<string>("profile");
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    const [mRes, cRes] = await Promise.all([fetch("/api/memories"), fetch("/api/memories/canon")]);
    setMems((await mRes.json()).memories ?? []);
    setCanon((await cRes.json().catch(() => ({}))).canon ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of mems) c[m.type] = (c[m.type] ?? 0) + 1;
    return c;
  }, [mems]);
  const shown = filter === "all" ? mems : mems.filter((m) => m.type === filter);

  async function add() {
    const content = newMem.trim();
    if (content.length < 3) {
      toast(t("اكتب حاجة أطول شوية", "Write a bit more"), "error");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, type: newType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error ?? t("مش قادر أضيف", "Couldn't add"), "error");
        return;
      }
      setMems((m) => [data.memory, ...m]);
      setNewMem("");
      toast(t("اتعلّمتها ✅", "Learned it ✅"), "success");
    } finally {
      setAdding(false);
    }
  }

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

  async function delCanon(fact: string) {
    const ok = await confirm({
      title: t("تشيل الحقيقة دي عن نفسها؟", "Remove this self-fact?"),
      confirmText: t("شيل", "Remove"),
      cancelText: t("إلغاء", "Cancel"),
      danger: true,
    });
    if (!ok) return;
    const res = await fetch("/api/memories/canon", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fact }),
    });
    setCanon((await res.json().catch(() => ({ canon }))).canon ?? canon.filter((f) => f !== fact));
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
        {t("اللي مساعدك فاكره عنك — ضيف، علّمها، أو شيل أي حاجة.", "What your assistant remembers — add, teach, or remove anything.")}
      </p>

      {/* teach a memory */}
      <div className="bg-surface border border-border rounded-2xl p-3 mb-5 shadow-soft">
        <div className="text-sm font-medium text-ink mb-2 flex items-center gap-1.5">
          <Sparkles className="size-4 text-accent" /> {t("علّمها حاجة تفتكرها", "Teach her something")}
        </div>
        <Input
          value={newMem}
          onChange={(e) => setNewMem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={t("مثلاً: بحب القهوة سادة، وبكره الزحمة", "e.g. I like black coffee and hate crowds")}
          className="mb-2"
        />
        <div className="flex items-center gap-2">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="h-10 rounded-xl bg-bg border border-border px-2 text-sm text-ink outline-none focus:border-accent"
          >
            {TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(TYPE_LABEL[ty][0], TYPE_LABEL[ty][1])}
              </option>
            ))}
          </select>
          <div className="flex-1" />
          <Button variant="outline" onClick={add} loading={adding}>
            <Plus className="size-4" /> {t("ضيف", "Add")}
          </Button>
        </div>
      </div>

      {/* type filter */}
      {!loading && mems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={t("الكل", "All")} n={mems.length} />
          {TYPES.filter((ty) => counts[ty]).map((ty) => (
            <FilterChip
              key={ty}
              active={filter === ty}
              onClick={() => setFilter(ty)}
              label={t(TYPE_LABEL[ty][0], TYPE_LABEL[ty][1])}
              n={counts[ty]}
            />
          ))}
        </div>
      )}

      {loading ? (
        <ul className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-16 rounded-2xl bg-surface border border-border animate-pulse" />
          ))}
        </ul>
      ) : mems.length === 0 ? (
        <EmptyState icon={<Brain className="size-6" />} title={t("لسه مفيش ذكريات", "No memories yet")}>
          {t("كل ما تتكلموا أكتر، هتفتكر أكتر — أو علّمها حاجة فوق.", "The more you talk, the more she remembers — or teach her above.")}
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {shown.map((m) => (
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

      {/* her own self-facts (canon) */}
      {canon.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-muted mt-7 mb-3 flex items-center gap-1.5">
            <UserCircle2 className="size-4 text-accent" /> {t("حاجات بتقولها عن نفسها", "What she says about herself")}
          </h2>
          <ul className="space-y-2">
            {canon.map((f) => (
              <li
                key={f}
                className="group flex items-start gap-3 bg-surface border border-border rounded-2xl px-4 py-3 shadow-soft animate-fade-in"
              >
                <span className="flex-1 text-ink text-sm leading-relaxed">{f}</span>
                <IconButton size="sm" subtle onClick={() => delCanon(f)} aria-label="حذف">
                  <Trash2 className="size-4" />
                </IconButton>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* forget by topic */}
      <h2 className="text-sm font-semibold text-muted mt-7 mb-2">{t("نسيان بالموضوع", "Forget by topic")}</h2>
      <div className="flex gap-2">
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
    </PageShell>
  );
}

function FilterChip({ active, onClick, label, n }: { active: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium border transition-theme",
        active ? "bg-accent text-on-accent border-accent" : "bg-surface text-muted border-border hover:text-ink",
      )}
    >
      {label} <span className="opacity-70">{n}</span>
    </button>
  );
}
