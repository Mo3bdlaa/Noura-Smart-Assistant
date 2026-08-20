"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Fires due reminders when the app becomes visible. Hosting free tiers run cron
 * once a day, so without this a 9am reminder would sit until the next sweep —
 * opening the app is the most reliable trigger available.
 */
export function DueTasksTicker() {
  const router = useRouter();

  useEffect(() => {
    let stopped = false;
    const run = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/tick", { method: "POST" });
        const data = await res.json().catch(() => ({}));
        // Only refresh when something was actually delivered.
        if (!stopped && data?.ran > 0) router.refresh();
      } catch {
        /* best effort */
      }
    };
    run();
    document.addEventListener("visibilitychange", run);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", run);
    };
  }, [router]);

  return null;
}
