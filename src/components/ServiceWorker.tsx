"use client";

import { useEffect } from "react";

/**
 * Register the service worker (installability) and, crucially, reload the page
 * once a NEW worker takes control.
 *
 * sw.js calls skipWaiting()+clients.claim(), so after a deploy the new worker
 * takes over a tab that is still running the OLD client bundle — which shows up
 * as "the fix is deployed but the app still misbehaves". Reloading on
 * `controllerchange` puts the tab on the new build immediately. The guard stops
 * the classic reload loop (controllerchange also fires on first install).
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // First-ever install claims the page too — that's not a version change.
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    const onControllerChange = () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Check for a new build when the app is reopened / brought forward.
          const check = () => reg.update().catch(() => {});
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") check();
          });
          check();
        })
        .catch(() => {});
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);
  return null;
}
