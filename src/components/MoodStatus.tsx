"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/components/i18n";
import { progressiveStage, stageLabel } from "@/lib/persona/stages";
import { cn } from "@/lib/cn";

export type MoodStats = {
  happiness: number;
  affection: number;
  energy: number;
  annoyance: number;
  intensity: number;
  closeness: number;
};

/**
 * The status line under her name. Tapping it opens a popover that breaks her
 * current feelings into percentages. The popover is rendered through a portal to
 * <body> so the blurred app-bar (which creates its own stacking/containing context)
 * can't trap it behind the chat bubbles.
 */
export function MoodStatus({
  label,
  stats,
  className,
  archetype,
  gender,
}: {
  label: string;
  stats: MoodStats;
  className?: string;
  archetype?: string | null;
  gender?: string | null;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    }
    setOpen((o) => !o);
  }

  const rows: { name: string; val: number; color: string }[] = [
    { name: t("السعادة", "Happiness"), val: stats.happiness, color: "bg-amber" },
    { name: t("المودة ناحيتك", "Warmth toward you"), val: stats.affection, color: "bg-accent" },
    { name: t("الطاقة", "Energy"), val: stats.energy, color: "bg-gold" },
    { name: t("القرب", "Closeness"), val: stats.closeness, color: "bg-brown" },
    { name: t("الانزعاج", "Annoyance"), val: stats.annoyance, color: "bg-danger" },
  ];
  if (stats.intensity > 0.05) {
    rows.push({ name: t("حدّة المشاعر", "Intensity"), val: stats.intensity, color: "bg-danger" });
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={cn(
          "text-muted leading-tight truncate hover:text-ink transition-theme text-start",
          className,
        )}
      >
        {label}
      </button>

      {mounted &&
        open &&
        pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[99]" onClick={() => setOpen(false)} />
            <div
              dir="rtl"
              style={{ position: "fixed", top: pos.top, right: pos.right }}
              className="z-[100] w-64 max-w-[80vw] rounded-2xl bg-surface border border-border shadow-raised p-3.5 space-y-2.5 animate-fade-in"
            >
              <div className="text-xs font-semibold text-ink">{t("حالتها دلوقتي", "How she feels now")}</div>
              {/* The earned relationship stage — the progression is otherwise invisible. */}
              {archetype === "progressive" && (
                <div className="flex items-center justify-between rounded-xl bg-accent-soft px-2.5 py-1.5">
                  <span className="text-[11px] text-muted">{t("المرحلة", "Stage")}</span>
                  <span className="text-[11px] font-semibold text-accent">
                    {(() => {
                      const [ar, en] = stageLabel(progressiveStage(stats.closeness), gender === "male" ? "male" : "female");
                      return t(ar, en);
                    })()}
                  </span>
                </div>
              )}
              {rows.map((r) => {
                const pct = Math.round(Math.max(0, Math.min(1, r.val)) * 100);
                return (
                  <div key={r.name}>
                    <div className="flex justify-between text-[11px] text-muted mb-1">
                      <span>{r.name}</span>
                      <span className="tabular-nums">{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-elevated overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", r.color)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
