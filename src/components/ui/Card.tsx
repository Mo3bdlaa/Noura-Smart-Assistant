import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("bg-surface border border-border rounded-2xl shadow-soft", className)}
      {...props}
    >
      {children}
    </div>
  );
}

/** A small pill/label (memory types, statuses, conversation kinds). */
export function Chip({
  className,
  children,
  tone = "neutral",
}: {
  className?: string;
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "warm" | "danger";
}) {
  const tones = {
    neutral: "bg-elevated text-muted",
    accent: "bg-accent-soft text-accent",
    warm: "bg-amber/15 text-brown",
    danger: "bg-danger-soft text-danger",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Friendly empty-state block. */
export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="text-center py-16 px-6 animate-fade-in">
      {icon && (
        <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          {icon}
        </div>
      )}
      <p className="font-semibold text-ink">{title}</p>
      {children && <p className="text-sm text-muted mt-1 max-w-xs mx-auto">{children}</p>}
    </div>
  );
}
