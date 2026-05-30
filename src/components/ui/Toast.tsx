"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "error";
type Toast = { id: number; message: string; tone: Tone };

const ToastCtx = createContext<(message: string, tone?: Tone) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: Tone = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 pb-safe pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-center gap-2.5 rounded-xl px-4 py-3 shadow-raised animate-slide-up",
              "border text-sm max-w-sm w-full",
              t.tone === "error"
                ? "bg-danger-soft border-danger/30 text-danger"
                : t.tone === "success"
                  ? "bg-success-soft border-success/30 text-success"
                  : "bg-elevated border-border text-ink",
            )}
            role="status"
          >
            {t.tone === "error" ? (
              <XCircle className="size-5 shrink-0" />
            ) : t.tone === "success" ? (
              <CheckCircle2 className="size-5 shrink-0" />
            ) : (
              <Info className="size-5 shrink-0" />
            )}
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
