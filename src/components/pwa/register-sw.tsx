"use client";

import { useEffect } from "react";

export function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.error("SW registration failed:", err));

    // When the browser comes back online, ask the SW to fire a Background Sync
    // tag. Browsers that support the Background Sync API will call our
    // 'fguild-sync' handler in sw.js, which in turn messages open tabs so
    // the React sync queue can be processed.
    const handleOnline = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        if ("sync" in registration) {
          await (registration as ServiceWorkerRegistration & {
            sync: { register: (tag: string) => Promise<void> };
          }).sync.register("fguild-sync");
        }
      } catch {
        // Background Sync API may not be available in all browsers — safe to ignore.
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  return null;
}
