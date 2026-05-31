"use client";

import { useState } from "react";
import { Brain, Sparkles, UserRound } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Card, Chip } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/components/i18n";
import type { ProfileReport } from "@/lib/insights/profile";

export function ProfileView({
  assistantName,
  mood,
  canon,
  report,
  summary,
  initialNotes,
}: {
  assistantName: string;
  mood: "happy" | "calm" | "upset";
  canon: string[];
  report: ProfileReport | null;
  summary: string | null;
  initialNotes: string;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userNotes: notes }),
      });
      if (!res.ok) {
        toast(t("مش قادر أحفظ", "Couldn't save"), "error");
        return;
      }
      toast(t("اتحفظ ✅", "Saved ✅"), "success");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell title={t("البروفايل", "Profile")} icon={<UserRound className="size-5" />}>
      {/* assistant card */}
      <Card className="p-5 mb-5">
        <div className="flex items-center gap-4">
          <Avatar name={assistantName} size="xl" mood={mood} />
          <div>
            <div className="text-xl font-extrabold text-ink">{assistantName}</div>
            <div className="text-sm text-muted">
              {t("مساعدك — ليها شخصية ومزاج وذاكرة", "your assistant — with personality, mood & memory")}
            </div>
          </div>
        </div>
        {canon.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-semibold text-muted mb-1.5 flex items-center gap-1.5">
              <Sparkles className="size-3.5" /> {t("حاجات قالتها عن نفسها", "things she's said about herself")}
            </div>
            <ul className="space-y-1">
              {canon.slice(-12).map((f, i) => (
                <li key={i} className="text-sm text-ink">• {f}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* how she sees you (AI) */}
      <Card className="p-5 mb-5">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="grid place-items-center size-9 rounded-xl bg-accent-soft text-accent">
            <Brain className="size-4" />
          </span>
          <h2 className="font-bold text-ink">{t("كيف يراك مساعدك", "How your assistant sees you")}</h2>
        </div>
        {!report && !summary ? (
          <p className="text-sm text-muted">
            {t("لسه بيتعرّف عليك — كل ما تتكلموا أكتر، الصورة تتّضح.", "Still getting to know you — it sharpens as you talk more.")}
          </p>
        ) : (
          <div className="space-y-2.5 text-sm">
            {(report?.summary || summary) && (
              <p className="text-ink leading-relaxed">{report?.summary || summary}</p>
            )}
            {report?.traits && report.traits.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {report.traits.map((tr, i) => (
                  <Chip key={i} tone="accent">{tr.name}</Chip>
                ))}
              </div>
            )}
            <Sec label={t("أسلوبك", "Communication")} v={report?.communication_style} />
            <Sec label={t("اهتماماتك", "Interests")} v={report?.interests?.join("، ")} />
            <Sec label={t("اللي بيهمّك", "Values")} v={report?.values?.join("، ")} />
            <Sec label={t("نمطك العاطفي", "Emotional patterns")} v={report?.emotional_patterns} />
          </div>
        )}
      </Card>

      {/* your own notes (editable) */}
      <Card className="p-5">
        <h2 className="font-bold text-ink mb-1">{t("ملاحظاتك عن نفسك", "Your own notes")}</h2>
        <p className="text-sm text-muted mb-3">
          {t("ضيف أو عدّل أي حاجة عايز مساعدك يعرفها عنك.", "Add or edit anything you want your assistant to know about you.")}
        </p>
        <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("مثلاً: بحب أتكلم بالليل، عندي حساسية من...", "e.g. I prefer talking at night, I'm allergic to...")} />
        <div className="mt-3">
          <Button onClick={save} loading={saving}>{t("حفظ", "Save")}</Button>
        </div>
      </Card>
    </PageShell>
  );
}

function Sec({ label, v }: { label: string; v?: string }) {
  if (!v) return null;
  return (
    <div>
      <span className="text-xs font-semibold text-muted">{label}: </span>
      <span className="text-ink">{v}</span>
    </div>
  );
}
