"use client";

import { useEffect } from "react";

/**
 * After deploy, browsers/CDNs may serve old HTML that references removed _next/static chunks.
 * Reload once when a chunk script fails to load so users get fresh HTML.
 */
export function useRecoverStaleChunks() {
  useEffect(() => {
    const storageKey = "lms-chunk-reload";

    const onError = (event: Event) => {
      const errorEvent = event as ErrorEvent;
      const script = event.target as HTMLScriptElement | null;
      const source = errorEvent.filename || script?.src || "";
      if (!source.includes("/_next/static/")) return;
      if (sessionStorage.getItem(storageKey)) return;

      sessionStorage.setItem(storageKey, "1");
      window.location.reload();
    };

    window.addEventListener("error", onError, true);
    return () => window.removeEventListener("error", onError, true);
  }, []);
}
