"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n";
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
 * The status line under her name. Tapping it opens a small popover that breaks her
 * current feelings into percentages — so the mood isn't just a label, it's legible.
 */
export function MoodStatus({
  label,
  stats,
  className,
}: {
  label: string;
  stats: MoodStats;
  className?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

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
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={cn(
          "text-muted leading-tight truncate hover:text-ink transition-theme text-start",
          className,
        )}
      >
        {label}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            dir="rtl"
            className="absolute z-50 mt-1 w-64 max-w-[80vw] rounded-2xl bg-surface border border-border shadow-raised p-3.5 space-y-2.5 animate-fade-in"
          >
            <div className="text-xs font-semibold text-ink">{t("حالتها دلوقتي", "How she feels now")}</div>
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
        </>
      )}
    </div>
  );
}
