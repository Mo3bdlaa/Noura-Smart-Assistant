import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "soft" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-theme " +
  "select-none disabled:opacity-50 disabled:pointer-events-none active:scale-[.98] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-bg whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-gold to-amber text-on-accent shadow-soft hover:brightness-[1.04]",
  soft: "bg-accent-soft text-ink hover:brightness-[.97]",
  ghost: "text-ink hover:bg-elevated",
  outline: "border border-border-strong text-ink hover:bg-elevated",
  danger: "bg-danger text-white hover:brightness-[1.05]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-12 px-6 text-base",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, block, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], block && "w-full", className)}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
