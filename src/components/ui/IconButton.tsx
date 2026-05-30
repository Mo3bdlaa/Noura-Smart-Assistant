import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type Size = "sm" | "md" | "lg";
const sizes: Record<Size, string> = {
  sm: "size-8",
  md: "size-10",
  lg: "size-11",
};

export type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: Size;
  /** visually subtle until hovered (used for row actions like delete) */
  subtle?: boolean;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = "md", subtle, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-full transition-theme shrink-0",
        "text-muted hover:text-ink hover:bg-elevated active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        subtle && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
