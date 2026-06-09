"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarHeart,
  Heart,
  MessageCircle,
  MessageCircleHeart,
  NotebookPen,
  Sparkles,
  Star,
  Sunrise,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState } from "@/components/ui/Card";
import { useI18n } from "@/components/i18n";
import { cn } from "@/lib/cn";

type MoodPoint = { at: string; happiness: number; affection: number; annoyance: number; energy: number };
type Milestone = {
  at: string;
  kind: "first_message" | "messages_count" | "anniversary" | "first_side" | "memory";
  value?: number;
  text?: string;
  memoryType?: string;
};
type TimelineData = {
  startedAt: string | null;
  daysTogether: number;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  mood: MoodPoint[];
  milestones: Milestone[];
  closeness: number;
  diary: { date: string; content: string; mood: string | null }[];
};

export default function TimelinePage() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/timeline")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const loc = locale === "en" ? "en-US" : "ar-EG";
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(loc, { day: "numeric", month: "long", year: "numeric" });

  return (
    <PageShell title={t("رحلتنا مع بعض", "Our journey")} icon={<Heart className="size-5" />}>
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
      ) : !data || !data.startedAt ? (
        <EmptyState icon={<Sparkles className="size-6" />} title={t("لسه بدري", "Still early")}>
          {t("ابدأوا تتكلموا، والرحلة هتتكتب هنا يوم بيوم.", "Start talking — your story will be written here day by day.")}
        </EmptyState>
      ) : (
        <>
          {/* hero stats */}
          <Card className="p-5 mb-5 text-center">
            <div className="text-sm text-muted mb-1">
              {t("من أول رسالة في", "Since your first message on")} {fmtDate(data.startedAt)}
            </div>
            <div className="text-4xl font-extrabold text-ink mb-1">
              {data.daysTogether}{" "}
              <span className="text-lg font-bold text-accent">{t("يوم مع بعض", "days together")}</span>
            </div>
            <div className="flex justify-center gap-5 mt-4 text-sm">
              <Stat n={data.totalMessages} label={t("رسالة", "messages")} />
              <Stat n={data.userMessages} label={t("منك", "from you")} />
              <Stat n={data.assistantMessages} label={t("منها", "from her")} />
            </div>
            <Bond closeness={data.closeness} t={t} />
          </Card>

          {/* mood over time */}
          <MoodChart mood={data.mood} t={t} />

          {/* her nightly diary */}
          {data.diary?.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-muted mt-6 mb-3 flex items-center gap-1.5">
                <NotebookPen className="size-4 text-accent" /> {t("يومياتها", "Her diary")}
              </h2>
              <div className="space-y-3">
                {data.diary.map((d) => (
                  <Card key={d.date} className="p-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-accent">{fmtDate(d.date)}</span>
                      {d.mood && <span className="text-[11px] text-muted">{d.mood}</span>}
                    </div>
                    <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{d.content}</p>
                  </Card>
                ))}
              </div>
            </>
          )}

          {/* milestones */}
          <h2 className="text-sm font-semibold text-muted mt-6 mb-3 flex items-center gap-1.5">
            <Star className="size-4 text-accent" /> {t("محطات", "Milestones")}
          </h2>
          {data.milestones.length === 0 ? (
            <p className="text-sm text-muted">{t("لسه مفيش محطات.", "No milestones yet.")}</p>
          ) : (
            <ol className="relative ms-3 border-s-2 border-border space-y-4 py-1">
              {data.milestones
                .slice()
                .reverse()
                .map((m, i) => (
                  <MilestoneRow key={i} m={m} t={t} fmtDate={fmtDate} />
                ))}
            </ol>
          )}
        </>
      )}
    </PageShell>
  );
}

function Bond({ closeness, t }: { closeness: number; t: (a: string, b: string) => string }) {
  const pct = Math.round(closeness * 100);
  const stage =
    closeness < 0.28
      ? t("لسه بتتعرفوا", "Getting to know each other")
      : closeness < 0.55
        ? t("مرتاحين لبعض", "Comfortable together")
        : closeness < 0.8
          ? t("قريبين فعلاً", "Genuinely close")
          : t("علاقة عميقة", "Deeply bonded");
  return (
    <div className="mt-5 pt-4 border-t border-border">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-muted flex items-center gap-1">
          <Heart className="size-3.5 text-accent" /> {t("قرب القلب", "Your bond")}
        </span>
        <span className="font-semibold text-accent">{stage}</span>
      </div>
      <div className="h-2 rounded-full bg-elevated overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber to-accent transition-all duration-700"
          style={{ width: `${Math.max(4, pct)}%` }}
        />
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div className="text-xl font-extrabold text-ink">{n.toLocaleString()}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

/** Tiny dependency-free SVG line chart of her happiness + affection over time. */
function MoodChart({ mood, t }: { mood: MoodPoint[]; t: (a: string, b: string) => string }) {
  const W = 320;
  const H = 90;
  const pad = 6;

  const paths = useMemo(() => {
    if (mood.length < 2) return null;
    const xs = (i: number) => pad + (i / (mood.length - 1)) * (W - pad * 2);
    const ys = (v: number) => H - pad - v * (H - pad * 2);
    const line = (key: keyof MoodPoint) =>
      mood
        .map((p, i) => `${i === 0 ? "M" : "L"} ${xs(i).toFixed(1)} ${ys(p[key] as number).toFixed(1)}`)
        .join(" ");
    return { happiness: line("happiness"), affection: line("affection") };
  }, [mood]);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-ink flex items-center gap-1.5">
          <Sunrise className="size-4 text-accent" /> {t("مزاجها معاك بمرور الوقت", "Her mood over time")}
        </h2>
        <div className="flex gap-3 text-[11px]">
          <Legend color="var(--gold, #e0a93c)" label={t("سعادة", "Happy")} />
          <Legend color="var(--accent, #d96a8a)" label={t("مودة", "Affection")} />
        </div>
      </div>
      {!paths ? (
        <p className="text-xs text-muted py-4 text-center">
          {t("المنحنى هيظهر بعد شوية كلام بينكم 🌱", "The curve appears after you've talked a bit 🌱")}
        </p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24" preserveAspectRatio="none">
          <path d={paths.affection} fill="none" stroke="var(--accent, #d96a8a)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
          <path d={paths.happiness} fill="none" stroke="var(--gold, #e0a93c)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
        </svg>
      )}
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-muted">
      <span className="inline-block size-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function MilestoneRow({
  m,
  t,
  fmtDate,
}: {
  m: Milestone;
  t: (a: string, b: string) => string;
  fmtDate: (iso: string) => string;
}) {
  const { icon, title, tone } = describe(m, t);
  return (
    <li className="ms-4 animate-fade-in">
      <span
        className={cn(
          "absolute -start-[9px] grid place-items-center size-4 rounded-full ring-4 ring-bg",
          tone,
        )}
      />
      <div className="flex items-start gap-3">
        <span className="grid place-items-center size-9 rounded-xl bg-accent-soft text-accent shrink-0 mt-0.5">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-ink font-medium leading-snug">{title}</div>
          <div className="text-xs text-muted">{fmtDate(m.at)}</div>
        </div>
      </div>
    </li>
  );
}

function describe(m: Milestone, t: (a: string, b: string) => string) {
  switch (m.kind) {
    case "first_message":
      return { icon: <Sparkles className="size-5" />, tone: "bg-accent", title: t("أول كلمة بينكم 💛", "Your very first message 💛") };
    case "messages_count":
      return {
        icon: <MessageCircle className="size-5" />,
        tone: "bg-gold",
        title: t(`وصلتوا ${m.value} رسالة`, `Reached ${m.value} messages`),
      };
    case "anniversary": {
      const months = m.value ?? 0;
      const label =
        months >= 12
          ? t(`${months / 12} سنة على أول كلام 🎉`, `${months / 12} year(s) since you met 🎉`)
          : t(`${months} شهور على أول كلام`, `${months} months since you met`);
      return { icon: <CalendarHeart className="size-5" />, tone: "bg-accent", title: label };
    }
    case "first_side":
      return {
        icon: <MessageCircleHeart className="size-5" />,
        tone: "bg-gold",
        title: t("أول محادثة جانبية ليكم", "Your first side chat"),
      };
    case "memory":
      return { icon: <Heart className="size-5" />, tone: "bg-accent", title: m.text ?? t("لحظة بينكم", "A moment together") };
    default:
      return { icon: <Star className="size-5" />, tone: "bg-accent", title: "" };
  }
}
