"use client";

/**
 * Private-mode sheet. Reached only through the hidden gesture in Settings, and
 * loaded as its own chunk (via next/dynamic) so none of its strings sit in the
 * main bundle for someone poking around the app.
 *
 * Deliberately minimal and unlabelled until unlocked: the passphrase step says
 * nothing about what it opens.
 */
import { useEffect, useRef, useState } from "react";
import { Lock, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useI18n } from "@/components/i18n";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

type State =
  | { step: "loading" }
  | { step: "gate"; needsSetup: boolean }
  | { step: "open"; on: boolean; level: number };

export default function PrivateMode({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [state, setState] = useState<State>({ step: "loading" });
  const [pass, setPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/settings/mode")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setState(
          d.unlocked
            ? { step: "open", on: Boolean(d.on), level: Number(d.level) || 2 }
            : { step: "gate", needsSetup: Boolean(d.needsSetup) },
        );
      })
      .catch(() => alive && setState({ step: "gate", needsSetup: false }));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (state.step === "gate") inputRef.current?.focus();
  }, [state.step]);

  async function submitPass(e: React.FormEvent) {
    e.preventDefault();
    if (state.step !== "gate") return;
    if (pass.length < 4) return;
    if (state.needsSetup && pass !== confirmPass) {
      toast(t("الكلمتين مش زي بعض", "The two entries don't match"), "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/settings/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pass }),
      });
      if (!res.ok) {
        // Say nothing useful — same outcome for a wrong word as for none.
        setPass("");
        setConfirmPass("");
        if (res.status === 429) toast(t("استنى شوية", "Wait a bit"), "error");
        return;
      }
      const d = await res.json();
      setState({ step: "open", on: Boolean(d.on), level: Number(d.level) || 2 });
      setPass("");
      setConfirmPass("");
    } finally {
      setBusy(false);
    }
  }

  async function patch(next: { on?: boolean; level?: number }) {
    if (state.step !== "open") return;
    const optimistic = { ...state, ...next };
    setState(optimistic);
    const res = await fetch("/api/settings/mode", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!res.ok) {
      toast(t("مش قادر أحفظ", "Couldn't save"), "error");
      return;
    }
    const d = await res.json();
    setState({ step: "open", on: Boolean(d.on), level: Number(d.level) || 2 });
  }

  async function lockNow() {
    await fetch("/api/settings/mode", { method: "DELETE" });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-surface border border-border shadow-soft p-5 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {state.step === "loading" && <div className="h-24" />}

        {state.step === "gate" && (
          <form onSubmit={submitPass} className="space-y-3">
            <div className="flex items-center justify-center size-11 mx-auto rounded-2xl bg-elevated text-muted">
              <Lock className="size-5" />
            </div>
            <Input
              ref={inputRef}
              type="password"
              autoComplete="off"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="text-center"
              aria-label="•"
            />
            {state.needsSetup && (
              <Input
                type="password"
                autoComplete="off"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                className="text-center"
                placeholder={t("تأكيد", "Confirm")}
                aria-label="•"
              />
            )}
            <Button type="submit" block loading={busy} disabled={pass.length < 4}>
              {t("تمام", "OK")}
            </Button>
          </form>
        )}

        {state.step === "open" && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-ink">{t("الوضع الخاص", "Private mode")}</h2>
                <p className="text-xs text-muted mt-0.5">
                  {state.on
                    ? t("شغّال على المتصفح ده", "On, in this browser")
                    : t("مقفول", "Off")}
                </p>
              </div>
              <button onClick={onClose} className="text-faint hover:text-ink p-1 -m-1">
                <X className="size-5" />
              </button>
            </div>

            <button
              onClick={() => patch({ on: !state.on })}
              className="w-full flex items-center justify-between rounded-2xl bg-elevated px-4 py-3.5"
            >
              <span className="text-sm font-medium text-ink">{t("شغّاله", "Enabled")}</span>
              <span
                className={cn(
                  "relative w-12 h-7 rounded-full transition-theme",
                  state.on ? "bg-accent" : "bg-border-strong",
                )}
              >
                <span
                  className={cn(
                    "absolute top-1 size-5 rounded-full bg-white transition-all",
                    state.on ? "left-6" : "left-1",
                  )}
                />
              </span>
            </button>

            <div className="space-y-2">
              <div className="text-xs text-muted">{t("المستوى", "Intensity")}</div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    [1, t("تلميح", "Suggestive")],
                    [2, t("صريح", "Explicit")],
                    [3, t("مفتوح", "No limits")],
                  ] as const
                ).map(([lvl, label]) => (
                  <button
                    key={lvl}
                    onClick={() => patch({ level: lvl })}
                    className={cn(
                      "rounded-xl px-2 py-2.5 text-sm font-medium border transition-theme",
                      state.level === lvl
                        ? "bg-accent-soft text-accent border-accent/30"
                        : "bg-elevated text-muted border-transparent hover:text-ink",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-faint leading-relaxed">
              {t(
                "بيشتغل بس على المتصفح اللي فتحته بالكلمة دي — أي جهاز تاني هيلاقيها عادية. والإشعارات والرسايل اللي بتيجي من نفسها مش بتتأثر.",
                "Only active in the browser you unlocked — anywhere else she's normal. Notifications and messages she sends on her own are never affected.",
              )}
            </p>

            <Button variant="outline" block onClick={lockNow}>
              <Lock className="size-4" /> {t("اقفل دلوقتي", "Lock now")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
