"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Button } from "./Button";

type Options = {
  title: string;
  body?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

const ConfirmCtx = createContext<(opts: Options) => Promise<boolean>>(async () => false);

export function useConfirm() {
  return useContext(ConfirmCtx);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<Options | null>(null);
  const resolver = useRef<(v: boolean) => void>(() => {});

  const confirm = useCallback((o: Options) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (v: boolean) => {
    resolver.current(v);
    setOpts(null);
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {opts && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4 bg-overlay/55 animate-fade-in"
          onClick={() => close(false)}
        >
          <div
            className="w-full max-w-sm bg-surface border border-border rounded-3xl p-6 shadow-raised animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-ink">{opts.title}</h2>
            {opts.body && <p className="text-sm text-muted mt-1.5 leading-relaxed">{opts.body}</p>}
            <div className="flex gap-2 mt-5">
              <Button variant="ghost" block onClick={() => close(false)}>
                {opts.cancelText ?? "إلغاء"}
              </Button>
              <Button
                variant={opts.danger ? "danger" : "primary"}
                block
                onClick={() => close(true)}
              >
                {opts.confirmText ?? "تمام"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}
