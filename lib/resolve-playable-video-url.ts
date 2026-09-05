/**
 * Client helper: resolve a stored video reference to a playable URL.
 * GCS keys / private GCS URLs go through /api/video for a short-lived signed URL.
 * YouTube, Vimeo, Google Drive, and other public URLs pass through unchanged.
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

  try {
    const res = await fetch(
      `/api/video?videoKey=${encodeURIComponent(raw)}`,
      { credentials: "same-origin" }
    );

    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");

    if (!res.ok) {
      let serverError = "";
      if (isJson) {
        try {
          const body = (await res.json()) as {
            error?: string;
            detail?: string;
            code?: string;
          };
          serverError = body.detail || body.error || "";
        } catch {
          // ignore
        }
      }

      // If raw is an http/https URL, fall back to playing raw URL directly
      if (/^https?:\/\//i.test(raw)) {
        return raw;
      }

      if (res.status === 401 || res.status === 403) {
        throw new PlayableVideoError(
          serverError || "You do not have permission to view this video.",
          res.status
        );
      }
      if (res.status === 400) {
        throw new PlayableVideoError(
          serverError || "Invalid video path for this bucket.",
          400
        );
      }
      throw new PlayableVideoError(
        serverError ||
          "Could not load video (GCS signing failed). Check GCP env vars in server configuration.",
        res.status
      );
    }

    if (!isJson) {
      if (/^https?:\/\//i.test(raw)) {
        return raw;
      }
      throw new PlayableVideoError(
        "Server returned invalid non-JSON response while resolving video.",
        500
      );
    }

    const data = (await res.json()) as { url?: string };
    if (!data.url) {
      if (/^https?:\/\//i.test(raw)) return raw;
      throw new PlayableVideoError("Missing signed URL in response", 500);
    }
    return data.url;
  } catch (err) {
    if (err instanceof PlayableVideoError) throw err;
    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }
    const msg =
      err instanceof Error
        ? err.message
        : "Failed to resolve playable video URL.";
    throw new PlayableVideoError(msg, 500);
  }
}
