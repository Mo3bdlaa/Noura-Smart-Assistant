"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { cn } from "@/lib/cn";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BIPEvent = any;

const DISMISS_KEY = "anees_install_dismissed";
const DISMISS_DAYS = 7;

/**
 * Custom "Add to Home Screen" prompt. On Android/Chrome it captures
 * `beforeinstallprompt` and shows an Install button; on iOS Safari (no
 * programmatic install) it shows the Share → Add to Home Screen hint.
 * Hidden when already installed or recently dismissed.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).standalone === true;
    if (standalone) return;

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_DAYS * 864e5) return;

    const ua = navigator.userAgent || "";
    const ios = /iphone|ipad|ipod/i.test(ua);
    const webkit = /^((?!chrome|android).)*safari/i.test(ua) || ios;
    if (ios && webkit) {
      setIsIOS(true);
      setShow(true);
      return;
    }

    const onPrompt = (e: BIPEvent) => {
      e.preventDefault();
      setDeferred(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setShow(false));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  }

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    try {
      await deferred.userChoice;
    } finally {
      setDeferred(null);
      setShow(false);
    }
  }

  if (!show) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-[55] p-3 pb-safe flex justify-center pointer-events-none",
        "animate-slide-up",
      )}
    >
      <div className="pointer-events-auto w-full max-w-sm bg-surface border border-border rounded-2xl shadow-raised p-3 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="size-11 rounded-xl shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-ink text-sm leading-tight">ثبّت أنيس على موبايلك</div>
          {isIOS ? (
            <div className="text-[12px] text-muted leading-snug mt-0.5 flex items-center gap-1 flex-wrap">
              اضغط <Share className="size-3.5 inline" /> «مشاركة» ثم «إضافة إلى الشاشة الرئيسية»
            </div>
          ) : (
            <div className="text-[12px] text-muted leading-tight mt-0.5">يفتح أسرع وكإنه أبليكيشن.</div>
          )}
        </div>
        {!isIOS && (
          <button
            onClick={install}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-gold to-amber text-on-accent font-bold text-sm px-3 py-2 active:scale-95 transition-theme"
          >
            <Download className="size-4" /> تثبيت
          </button>
        )}
        <button onClick={dismiss} aria-label="إغلاق" className="shrink-0 text-muted hover:text-ink p-1">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
