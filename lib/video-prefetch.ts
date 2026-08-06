/**
 * Warm the browser cache for a remote MP4 before the student hits Play.
 * Safe no-op when the URL is empty or not a direct media file.
 */
const warmed = new Set<string>();

export function prefetchVideoUrl(url: string | null | undefined) {
  const src = url?.trim();
  if (!src || warmed.has(src)) return;
  if (!/^https?:\/\//i.test(src)) return;
  if (typeof window === "undefined") return;

  warmed.add(src);

  // link rel=preload — best effort; cross-origin still helps DNS/TLS + some caches
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "video";
  link.href = src;
  link.crossOrigin = "anonymous";
  document.head.appendChild(link);

  // Also kick a tiny range-friendly fetch when CORS allows (GCS with CORS configured).
  // Abort quickly so we only warm the connection / first bytes.
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
