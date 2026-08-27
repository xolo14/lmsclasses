/**
 * Warm the browser cache for a remote MP4 before the student hits Play.
 * Safe no-op when the URL is empty or not a direct media file.
 * GCS keys / private URLs are resolved to short-lived signed URLs first.
 */

import { resolvePlayableVideoUrl } from "@/lib/resolve-playable-video-url";

const warmed = new Set<string>();

function looksLikeGcsReference(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (v.startsWith("gs://")) return true;
  if (/storage\.(googleapis|cloud\.google)\.com/i.test(v)) return true;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v) && !v.includes("://")) {
    return /\.(mp4|webm|ogg|mov|m4v)(?:\?.*)?$/i.test(v);
  }
  return false;
}

function warmDirectUrl(src: string) {
  if (warmed.has(src)) return;
  if (!/^https?:\/\//i.test(src)) return;
  if (typeof window === "undefined") return;

  warmed.add(src);

  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "video";
  link.href = src;
  link.crossOrigin = "anonymous";
  document.head.appendChild(link);

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 8000);
  fetch(src, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    signal: controller.signal,
    headers: { Range: "bytes=0-65535" },
  })
    .catch(() => {
      // Ignore CORS/network failures — preload link still helps a little.
    })
    .finally(() => window.clearTimeout(timer));
}

export function prefetchVideoUrl(url: string | null | undefined) {
  const src = url?.trim();
  if (!src || warmed.has(src)) return;
  if (typeof window === "undefined") return;

  if (looksLikeGcsReference(src) && !/^https?:\/\/storage\.googleapis\.com\/.*[?&]X-Goog-/i.test(src)) {
    // Mark the key as in-flight so hover doesn't spam /api/video
    warmed.add(src);
    resolvePlayableVideoUrl(src)
      .then((signed) => warmDirectUrl(signed))
      .catch(() => {
        warmed.delete(src);
      });
    return;
  }

  warmDirectUrl(src);
}
