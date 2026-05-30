"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, KeyRound, PartyPopper, Sparkles, User } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

const STEPS = ["أهلًا", "حسابك", "مفتاح Gemini", "نورا"] as const;

export function SetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    displayName: "",
    adminEmail: "",
    adminPassword: "",
    geminiApiKey: "",
    assistantName: "نورا",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function next() {
    setError("");
    if (step === 1 && (!form.displayName || !form.adminEmail || form.adminPassword.length < 8)) {
      setError("كمّل بياناتك (الباسورد ٨ حروف على الأقل).");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  const back = () => setStep((s) => Math.max(s - 1, 0));

  async function finish() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "حصل خطأ");
        return;
      }
      router.push("/chat");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center p-4 bg-aura">
      <div className="w-full max-w-md animate-slide-up">
        <div className="bg-surface border border-border rounded-3xl p-6 sm:p-8 shadow-raised space-y-6">
          {/* progress */}
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-theme",
                  i <= step ? "bg-gradient-to-l from-gold to-amber" : "bg-elevated",
                )}
              />
            ))}
          </div>

          {error && (
            <div className="text-sm bg-danger-soft text-danger rounded-xl px-3 py-2.5">{error}</div>
          )}

          {step === 0 && (
            <div className="text-center space-y-3 py-2">
              <Avatar size="xl" mood="happy" className="mx-auto" />
              <h1 className="text-2xl font-extrabold text-ink">يلا نجهّز أنيس</h1>
              <p className="text-muted text-sm leading-relaxed max-w-xs mx-auto">
                كام خطوة بسيطة ونبقى جاهزين — حسابك، مفتاح Gemini، واسم مساعدك.
              </p>
            </div>
          )}

          {step === 1 && (
            <StepBody icon={<User className="size-5" />} title="حسابك (الأدمن)">
              <Field label="اسمك">
                <Input placeholder="مثلاً: محمد" value={form.displayName} onChange={set("displayName")} />
              </Field>
              <Field label="الإيميل">
                <Input type="email" placeholder="[email protected]" value={form.adminEmail} onChange={set("adminEmail")} />
              </Field>
              <Field label="الباسورد" hint="٨ حروف على الأقل">
                <Input type="password" placeholder="••••••••" value={form.adminPassword} onChange={set("adminPassword")} />
              </Field>
            </StepBody>
          )}

          {step === 2 && (
            <StepBody icon={<KeyRound className="size-5" />} title="مفتاح Gemini">
              <p className="text-sm text-muted leading-relaxed">
                من غيره نورا مش هتقدر تتكلم. خده مجانًا من{" "}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent font-semibold hover:underline"
                >
                  Google AI Studio
                </a>
                . تقدر تسيبه فاضي وتحطه بعدين من الإعدادات.
              </p>
              <Field label="المفتاح">
                <Input placeholder="AIza... أو AQ..." value={form.geminiApiKey} onChange={set("geminiApiKey")} />
              </Field>
            </StepBody>
          )}

          {step === 3 && (
            <StepBody icon={<Sparkles className="size-5" />} title="اسم مساعدتك">
              <p className="text-sm text-muted">إنت الأدمن، فتقدر تسميها "نورا" 😏</p>
              <Field label="الاسم">
                <Input value={form.assistantName} onChange={set("assistantName")} />
              </Field>
            </StepBody>
          )}

          {/* nav */}
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="ghost" onClick={back}>
                <ArrowRight className="size-4" /> رجوع
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button block onClick={next}>
                يلا <ArrowLeft className="size-4" />
              </Button>
            ) : (
              <Button block loading={busy} onClick={finish}>
                خلّصنا <PartyPopper className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepBody({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center gap-2.5">
        <span className="grid place-items-center size-10 rounded-xl bg-accent-soft text-accent">
          {icon}
        </span>
        <h2 className="text-lg font-bold text-ink">{title}</h2>
      </div>
      {children}
    </div>
  );
}
