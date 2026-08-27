/**
 * Client helper: resolve a stored video reference to a playable URL.
 * GCS keys / private GCS URLs go through /api/video for a short-lived signed URL.
 * YouTube, Vimeo, and other public URLs pass through unchanged.
 */

function looksLikeGcsReference(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (v.startsWith("gs://")) return true;
  if (/storage\.(googleapis|cloud\.google)\.com/i.test(v)) return true;
  // Bare object path (no scheme) — treat as GCS key when it has a video extension
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v) && !v.includes("://")) {
    return /\.(mp4|webm|ogg|mov|m4v)(?:\?.*)?$/i.test(v);
  }
  return false;
}

export async function resolvePlayableVideoUrl(
  videoKeyOrUrl: string
): Promise<string> {
  const raw = videoKeyOrUrl.trim();
  if (!raw) throw new Error("Missing video URL");

  if (!looksLikeGcsReference(raw)) {
    return raw;
  }

  const res = await fetch(
    `/api/video?videoKey=${encodeURIComponent(raw)}`,
    { credentials: "same-origin" }
  );

  if (!res.ok) {
    throw new Error(
      res.status === 401 || res.status === 403
        ? "Unauthorized"
        : "Failed to resolve video URL"
    );
  }

  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new Error("Missing signed URL in response");
  return data.url;
}
