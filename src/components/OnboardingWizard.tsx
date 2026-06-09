"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles, UserRound, Palette, Volume2, SlidersHorizontal } from "lucide-react";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input, Field, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/components/i18n";
import { GEMINI_VOICE_OPTIONS, DEFAULT_GEMINI_VOICE } from "@/lib/voice/gemini-voices";
import { LANGUAGE_OPTIONS } from "@/lib/persona/languages";

/** First-time setup for a new user's own assistant: name, look, voice, personality. */
export function OnboardingWizard({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [form, setForm] = useState({
    assistantName: "",
    appearance: "",
    language: "en",
    voiceId: DEFAULT_GEMINI_VOICE,
    playfulness: 0.8,
    bluntness: 0.65,
    warmth: 0.8,
  });

  const steps = [t("الاسم", "Name"), t("الشكل", "Look"), t("الصوت", "Voice"), t("الشخصية", "Personality")];

  async function previewVoice() {
    setPreviewing(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: t(
            `أهلاً، أنا ${form.assistantName || "مساعدتك"}. سعيدة إني هكون معاك.`,
            `Hi, I'm ${form.assistantName || "your assistant"}. Glad to be with you.`,
          ),
          voice: form.voiceId,
        }),
      });
      if (res.ok && (res.headers.get("content-type") ?? "").includes("audio")) {
        const url = URL.createObjectURL(await res.blob());
        const a = new Audio(url);
        a.onended = () => URL.revokeObjectURL(url);
        await a.play();
      }
    } catch {
      /* ignore */
    } finally {
      setPreviewing(false);
    }
  }

  function next() {
    if (step === 0 && form.assistantName.trim().length < 2) {
      toast(t("اكتب اسم مناسب", "Pick a name"), "error");
      return;
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  async function finish() {
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assistantName: form.assistantName.trim(),
          appearance: form.appearance.trim(),
          language: form.language,
          voiceId: form.voiceId,
          dials: { playfulness: form.playfulness, bluntness: form.bluntness, warmth: form.warmth },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error ?? t("في حاجة غلط", "Something went wrong"), "error");
        return;
      }
      router.push("/chat");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={t("يلا نجهّز مساعدتك", "Let's set up your assistant")}
      subtitle={t("خطوات سريعة تخليها على مزاجك.", "A few quick steps to make her yours.")}
    >
      {/* progress */}
      <div className="flex gap-1.5 mb-5">
        {steps.map((s, i) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-elevated"}`} />
        ))}
      </div>

      <div className="space-y-4 min-h-[180px]">
        {step === 0 && (
          <Step icon={<Sparkles className="size-5" />} title={t("اسمها", "Her name")}>
            <p className="text-sm text-muted">
              {isAdmin
                ? t('إنت أدمن — تقدر تسميها "نورا".', 'You\'re admin — you can name her "Noura".')
                : t('أي اسم تحبه (مش "نورا").', 'Any name you like (not "Noura").')}
            </p>
            <Field label={t("الاسم", "Name")}>
              <Input
                value={form.assistantName}
                onChange={(e) => setForm((f) => ({ ...f, assistantName: e.target.value }))}
                placeholder={t("مثلاً: لمى، سيلڤا، ...", "e.g. Lina, Maya, ...")}
              />
            </Field>
          </Step>
        )}

        {step === 1 && (
          <Step icon={<Palette className="size-5" />} title={t("شكلها", "Her look")}>
            <p className="text-sm text-muted">
              {t("اوصفها بإيجاز — بيستخدم لما توصف نفسها أو تبعت صورة.", "Briefly describe her — used when she describes herself or sends a photo.")}
            </p>
            <Textarea
              rows={3}
              value={form.appearance}
              onChange={(e) => setForm((f) => ({ ...f, appearance: e.target.value }))}
              placeholder={t("بنت مصرية، شعر بني مموج، عيون عسلي، ابتسامة دافية...", "Egyptian woman, wavy brown hair, hazel eyes, warm smile...")}
            />
          </Step>
        )}

        {step === 2 && (
          <Step icon={<Volume2 className="size-5" />} title={t("لغتها وصوتها", "Her language & voice")}>
            <select
              value={form.language}
              onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
              className="w-full h-12 rounded-xl bg-bg border border-border px-3 text-ink outline-none focus:border-accent mb-1"
            >
              {LANGUAGE_OPTIONS.map((l) => (
                <option key={l.code} value={l.code}>
                  {t(l.ar, l.en)}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <select
                value={form.voiceId}
                onChange={(e) => setForm((f) => ({ ...f, voiceId: e.target.value }))}
                className="flex-1 h-12 rounded-xl bg-bg border border-border px-3 text-ink outline-none focus:border-accent"
              >
                {GEMINI_VOICE_OPTIONS.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} — {t(v.ar, v.en)}
                  </option>
                ))}
              </select>
              <Button type="button" variant="outline" loading={previewing} onClick={previewVoice}>
                <Volume2 className="size-4" /> {t("اسمع", "Listen")}
              </Button>
            </div>
          </Step>
        )}

        {step === 3 && (
          <Step icon={<SlidersHorizontal className="size-5" />} title={t("شخصيتها", "Her personality")}>
            {(
              [
                ["playfulness", t("الهزار والدلع", "Playfulness")],
                ["bluntness", t("الصراحة", "Bluntness")],
                ["warmth", t("الحنية", "Warmth")],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <div className="flex items-center justify-between text-xs text-muted mb-1">
                  <span>{label}</span>
                  <span>{Math.round((form[key] as number) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={form[key] as number}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
                  className="w-full accent-accent"
                />
              </div>
            ))}
          </Step>
        )}
      </div>

      <div className="flex items-center gap-2 mt-6">
        {step > 0 && (
          <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}>
            {t("رجوع", "Back")}
          </Button>
        )}
        <div className="flex-1" />
        {step < steps.length - 1 ? (
          <Button type="button" onClick={next}>
            {t("التالي", "Next")}
          </Button>
        ) : (
          <Button type="button" onClick={finish} loading={busy}>
            {t("يلا نبدأ", "Let's go")}
          </Button>
        )}
      </div>
    </AuthShell>
  );
}

function Step({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center gap-2 text-ink font-bold">
        <span className="text-accent">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}
