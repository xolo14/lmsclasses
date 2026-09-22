/**
 * Warm DNS/TLS for a remote video before Play.
 * Do not Range-fetch: a cached 206 of the first 64 KB makes the player think
 * that is the whole file (no duration, cannot seek forward).
 */

import { looksLikeGcsVideoReference } from "@/lib/gcs-video-ref";
import { resolvePlayableVideoUrl } from "@/lib/resolve-playable-video-url";

const warmed = new Set<string>();

function warmDirectUrl(src: string) {
  if (warmed.has(src)) return;
  if (!/^https?:\/\//i.test(src)) return;
  if (typeof window === "undefined") return;

  warmed.add(src);

  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "video";
  link.href = src;
  document.head.appendChild(link);
}

export function prefetchVideoUrl(url: string | null | undefined) {
  const src = url?.trim();
  if (!src || warmed.has(src)) return;
  if (typeof window === "undefined") return;

  if (looksLikeGcsVideoReference(src) && !/[?&]X-Goog-/i.test(src)) {
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
