/**
 * Client helper: resolve a stored video reference to a playable URL.
 * GCS keys / private GCS URLs go through /api/video for a short-lived signed URL.
 * YouTube, Vimeo, and other public URLs pass through unchanged.
 */

import { looksLikeGcsVideoReference } from "@/lib/gcs-video-ref";

export class PlayableVideoError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PlayableVideoError";
    this.status = status;
  }
}

export async function resolvePlayableVideoUrl(
  videoKeyOrUrl: string
): Promise<string> {
  const raw = videoKeyOrUrl.trim();
  if (!raw) throw new PlayableVideoError("Missing video URL", 400);

  if (!looksLikeGcsVideoReference(raw)) {
    return raw;
  }

  const res = await fetch(
    `/api/video?videoKey=${encodeURIComponent(raw)}`,
    { credentials: "same-origin" }
  );

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new PlayableVideoError("You do not have permission to view this video.", res.status);
    }
    if (res.status === 400) {
      throw new PlayableVideoError("Invalid video path for this bucket.", 400);
    }
    throw new PlayableVideoError(
      "Could not load video (GCS signing failed). Check GCP env vars on the server.",
      res.status
    );
  }

  const data = (await res.json()) as { url?: string };
  if (!data.url) {
    throw new PlayableVideoError("Missing signed URL in response", 500);
  }
  return data.url;
}
