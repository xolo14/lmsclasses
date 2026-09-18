/**
 * Shared (client + server) rules for recorded-class video uploads.
 * Keep this file free of Node-only imports — it is bundled into the browser.
 */

/** Hard cap for a single recorded-class video (5 GiB). */
export const MAX_VIDEO_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;
export const MAX_VIDEO_UPLOAD_LABEL = "5 GB";

/**
 * Chunk size for browser → GCS resumable uploads.
 * GCS requires every chunk except the last to be a multiple of 256 KiB.
 * 32 MiB keeps a 5 GB file to ~160 requests while still allowing granular retries.
 */
export const VIDEO_UPLOAD_CHUNK_BYTES = 32 * 1024 * 1024;

export const ACCEPTED_VIDEO_INPUT = "video/*,.mp4,.mov,.mkv,.webm,.avi";

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  const GB = 1024 ** 3;
  const MB = 1024 ** 2;
  if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** Returns a user-facing error when the size is unusable, otherwise null. */
export function getVideoSizeError(bytes: unknown): string | null {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) {
    return "The selected video file is empty or its size could not be read.";
  }
  if (bytes > MAX_VIDEO_UPLOAD_BYTES) {
    return `This video is ${formatFileSize(bytes)}. The maximum allowed size is ${MAX_VIDEO_UPLOAD_LABEL}.`;
  }
  return null;
}

/** Strip characters that are unsafe in GCS object paths / hPanel file listings. */
export function sanitizeStorageSegment(value: string, fallback: string): string {
  const cleaned = value
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "_");
  return cleaned || fallback;
}

/** `{batchFolder}/{timestamp}_{filename}` — the object key layout used in the bucket. */
export function buildVideoObjectKey(
  batchName: string | null | undefined,
  filename: string
): { folderName: string; safeFilename: string; objectKey: string } {
  const folderName = sanitizeStorageSegment(batchName ?? "", "batch");
  const safeFilename = `${Date.now()}_${sanitizeStorageSegment(filename, "video.mp4")}`;
  return { folderName, safeFilename, objectKey: `${folderName}/${safeFilename}` };
}
