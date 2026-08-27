/**
 * Isomorphic helpers for detecting GCS private video references.
 * Safe for client bundles (no @google-cloud/storage).
 */

const VIDEO_EXT = /\.(mp4|webm|ogg|mov|m4v)(?:\?.*)?$/i;

export function getConfiguredGcsBucket(): string {
  return (
    (typeof process !== "undefined" && process.env.GCS_BUCKET_NAME?.trim()) ||
    "lmsclasses-videos"
  );
}

/** True when value should be resolved via /api/video signed URLs. */
export function looksLikeGcsVideoReference(
  value: string,
  bucketName = getConfiguredGcsBucket()
): boolean {
  const v = value.trim();
  if (!v) return false;

  if (v.startsWith("gs://")) {
    return new RegExp(`^gs:\\/\\/${escapeRegExp(bucketName)}\\/.+`, "i").test(v);
  }

  // Bare object path with a video extension
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v) && !v.includes("://")) {
    return VIDEO_EXT.test(v);
  }

  try {
    const url = new URL(v);
    const host = url.hostname.toLowerCase();
    if (host === "storage.googleapis.com" || host === "storage.cloud.google.com") {
      const [bucket] = url.pathname.replace(/^\/+/, "").split("/");
      return bucket === bucketName;
    }
    if (host === `${bucketName.toLowerCase()}.storage.googleapis.com`) {
      return url.pathname.replace(/^\/+/, "").length > 0;
    }
  } catch {
    return false;
  }

  return false;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
