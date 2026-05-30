"use client";

import { useEffect } from "react";

/**
 * Keep the mobile status-bar / PWA <meta name="theme-color"> in sync with the
 * live (mood-driven) --bg token, so the browser chrome matches the app.
 */
export function ThemeColorSync() {
  useEffect(() => {
    const apply = () => {
      const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
      if (!bg) return;
      let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "theme-color";
        document.head.appendChild(meta);
      }
      meta.content = `hsl(${bg})`;
    };
    apply();
    // re-apply shortly after load in case the SSR vars hydrate/transition
    const t = setTimeout(apply, 1300);
    return () => clearTimeout(t);
  }, []);
  return null;
}
