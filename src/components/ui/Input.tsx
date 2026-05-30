import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

const fieldBase =
  "w-full rounded-xl bg-bg border border-border text-ink placeholder:text-faint " +
  "transition-theme outline-none focus:border-accent focus:ring-2 focus:ring-ring/40 " +
  "disabled:opacity-60";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(fieldBase, "h-12 px-4", className)} {...props} />;
});

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea ref={ref} className={cn(fieldBase, "px-4 py-3 resize-none", className)} {...props} />
  );
});

/** Labelled field wrapper with optional hint/error. */
export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label?: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  const autoId = useId();
  const id = htmlFor ?? autoId;
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-muted">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-faint">{hint}</p>
      ) : null}
    </div>
  );
}
