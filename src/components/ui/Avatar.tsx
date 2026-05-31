import { Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { isReservedName } from "@/lib/assistant/naming";

type Size = "sm" | "md" | "lg" | "xl";
const sizes: Record<Size, string> = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
  xl: "size-20 text-2xl",
};

/**
 * The assistant's mark. For Noura (the reserved name) it shows her photo;
 * otherwise a warm golden-hour gradient orb with the first letter of her name.
 * Optionally rings with her mood state.
 */
export function Avatar({
  name,
  photo,
  size = "md",
  mood,
  className,
}: {
  name?: string;
  /** explicit avatar image (data URL or path) — overrides the name fallback */
  photo?: string | null;
  size?: Size;
  /** "happy" | "calm" | "upset" — tints the surrounding glow */
  mood?: "happy" | "calm" | "upset";
  className?: string;
}) {
  const letter = name?.trim()?.[0];
  const src = photo?.trim() || (name && isReservedName(name) ? "/noura-avatar.jpg" : null);
  const ring =
    mood === "upset"
      ? "ring-2 ring-border-strong"
      : mood === "happy"
        ? "ring-2 ring-amber/60"
        : "ring-1 ring-border";

  if (src) {
    return (
      <span
        className={cn(
          "relative inline-block shrink-0 aspect-square rounded-full overflow-hidden shadow-soft",
          ring,
          sizes[size],
          className,
        )}
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="absolute inset-0 size-full object-cover" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center rounded-full shrink-0",
        "bg-gradient-to-br from-gold via-amber to-accent text-on-accent font-bold",
        "shadow-soft",
        ring,
        sizes[size],
        className,
      )}
      aria-hidden
    >
      {letter ?? <Sparkles className="w-1/2 h-1/2" />}
    </span>
  );
}
