import { Avatar } from "@/components/ui/Avatar";

/** Centered, branded shell for auth + setup screens. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh grid place-items-center p-4 bg-aura">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="flex flex-col items-center text-center mb-6">
          <Avatar size="xl" mood="happy" className="mb-3" />
          <div className="text-xs font-bold tracking-[0.3em] text-amber mb-2">أنيس · ANEES</div>
          <h1 className="text-2xl font-extrabold text-ink">{title}</h1>
          {subtitle && <p className="text-sm text-muted mt-1.5 max-w-xs">{subtitle}</p>}
        </div>
        <div className="bg-surface border border-border rounded-3xl p-6 sm:p-7 shadow-raised">
          {children}
        </div>
        {footer && <div className="text-center text-sm text-muted mt-5">{footer}</div>}
      </div>
    </div>
  );
}
