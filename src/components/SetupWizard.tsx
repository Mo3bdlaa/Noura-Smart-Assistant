"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
        setError(data.error ?? "خطأ");
        return;
      }
      router.push("/chat");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-3xl p-8 space-y-5">
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-amber" : "bg-elevated"}`} />
          ))}
        </div>

        {error && <div className="text-sm bg-red-500/10 text-red-700 rounded-lg px-3 py-2">{error}</div>}

        {step === 0 && (
          <div className="text-center space-y-3 py-4">
            <div className="text-5xl">✨</div>
            <h1 className="text-2xl font-extrabold text-ink">يلا نجهّز نورا</h1>
            <p className="text-muted text-sm">
              كام خطوة بسيطة ونبقى جاهزين. هتحط حسابك، مفتاح Gemini، واسم مساعدتك.
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-ink">حسابك (الأدمن)</h2>
            <input placeholder="اسمك" value={form.displayName} onChange={set("displayName")}
              className="w-full rounded-xl bg-bg border border-border px-4 py-3 text-ink outline-none focus:border-amber" />
            <input type="email" placeholder="الإيميل" value={form.adminEmail} onChange={set("adminEmail")}
              className="w-full rounded-xl bg-bg border border-border px-4 py-3 text-ink outline-none focus:border-amber" />
            <input type="password" placeholder="باسورد قوي (٨ حروف على الأقل)" value={form.adminPassword} onChange={set("adminPassword")}
              className="w-full rounded-xl bg-bg border border-border px-4 py-3 text-ink outline-none focus:border-amber" />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-ink">مفتاح Gemini 🔑</h2>
            <p className="text-sm text-muted">
              من غيره نورا مش هتقدر تتكلم. خده مجانًا من{" "}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-accent underline">
                Google AI Studio
              </a>
              . تقدر تسيبه فاضي وتحطه بعدين.
            </p>
            <input placeholder="AIza..." value={form.geminiApiKey} onChange={set("geminiApiKey")}
              className="w-full rounded-xl bg-bg border border-border px-4 py-3 text-ink outline-none focus:border-amber" />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-ink">اسم مساعدتك</h2>
            <p className="text-sm text-muted">إنت الأدمن، فتقدر تسميها "نورا" 😏</p>
            <input value={form.assistantName} onChange={set("assistantName")}
              className="w-full rounded-xl bg-bg border border-border px-4 py-3 text-ink outline-none focus:border-amber" />
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {step > 0 && (
            <button onClick={back} className="rounded-xl bg-elevated text-ink px-4 py-3">رجوع</button>
          )}
          {step < STEPS.length - 1 ? (
            <button onClick={next} className="flex-1 rounded-xl bg-amber text-bg font-bold py-3">يلا</button>
          ) : (
            <button onClick={finish} disabled={busy} className="flex-1 rounded-xl bg-amber text-bg font-bold py-3 disabled:opacity-50">
              {busy ? "بجهّز..." : "خلّصنا 🎉"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
