import { z } from "zod";
import { videoUrlFromApiInput } from "@/lib/api-url-transport";

const VIDEO_EXT = /\.(mp4|webm|ogg|mov|m4v)(?:\?.*)?$/i;

/**
 * Accepts:
 * - GCS object key: course-1/lesson-1-intro.mp4
 * - gs://lmsclasses-videos/...
 * - https://storage.googleapis.com/lmsclasses-videos/...
 * - YouTube / Vimeo / other https URLs
 */
export function isValidVideoReference(value: string): boolean {
  const v = value.trim();
  if (!v) return false;

  if (v.startsWith("gs://")) {
    return /^gs:\/\/[^/]+\/.+/i.test(v) && VIDEO_EXT.test(v);
  }

  // Bare object key (no scheme)
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v) && !v.includes("://")) {
    return VIDEO_EXT.test(v) && !v.includes("..") && !v.startsWith("/");
  }

  try {
    const url = new URL(v);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return true;
  } catch {
    return false;
  }
}

export const videoReferenceSchema = z.preprocess(
  videoUrlFromApiInput,
  z
    .string()
    .min(1, "Video path or URL is required")
    .refine(isValidVideoReference, {
      message:
        "Use a GCS key (e.g. course-1/lesson-1.mp4), gs:// URI, storage.googleapis.com URL, or YouTube/Vimeo link",
    })
);
