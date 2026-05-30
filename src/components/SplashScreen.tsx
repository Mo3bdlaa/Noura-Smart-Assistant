"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * In-app animated launch screen (the native PWA splash is a static image; this
 * adds the motion). Shows once per app session: gentle zoom-in + glow, the
 * ANEES wordmark fades up, then it fades out into the app.
 */
export function SplashScreen() {
  const [show, setShow] = useState(false);
  const [enter, setEnter] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("anees_splash")) return;
    sessionStorage.setItem("anees_splash", "1");
    setShow(true);
    const t0 = requestAnimationFrame(() => setEnter(true)); // trigger transition
    const t1 = setTimeout(() => setLeaving(true), 1750);
    const t2 = setTimeout(() => setShow(false), 2350);
    return () => {
      cancelAnimationFrame(t0);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] grid place-items-center overflow-hidden transition-opacity duration-500",
        leaving ? "opacity-0" : "opacity-100",
      )}
      style={{ backgroundColor: "#201410" }}
      aria-hidden
    >
      {/* warm golden-hour glow */}
      <div
        className={cn(
          "absolute left-1/2 top-1/2 size-[120vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl transition-opacity duration-1000",
          enter ? "opacity-60" : "opacity-0",
        )}
        style={{
          background:
            "radial-gradient(circle, rgba(224,138,99,0.45) 0%, rgba(63,125,79,0.18) 45%, transparent 70%)",
        }}
      />

      <div className="relative flex flex-col items-center gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/splash.jpg"
          alt=""
          className={cn(
            "w-44 h-56 object-cover rounded-[2rem] shadow-2xl ring-1 ring-white/10",
            "transition-all duration-[900ms] ease-out",
            enter ? "opacity-100 scale-100" : "opacity-0 scale-90",
          )}
          style={{ objectPosition: "50% 22%" }}
        />
        <div
          className={cn(
            "text-center transition-all duration-700 delay-200 ease-out",
            enter ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
          )}
        >
          <div className="text-3xl font-extrabold text-[#f6d2b0]">أنيس</div>
          <div className="text-[11px] font-bold tracking-[0.4em] text-[#e08a63] mt-1">ANEES</div>
        </div>
        {/* tiny breathing dots */}
        <div className={cn("flex gap-1.5 transition-opacity duration-700", enter ? "opacity-70" : "opacity-0")}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-1.5 rounded-full bg-[#f6d2b0] animate-typing"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
