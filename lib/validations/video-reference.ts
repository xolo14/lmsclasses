import { z } from "zod";
import { decodeUrlFromApiTransport } from "@/lib/api-url-transport";

const VIDEO_EXT = /\.(mp4|webm|ogg|mov|m4v)(?:\?.*)?$/i;

/**
 * Accepts:
 * - GCS object key: aiml/video1.mp4
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

  // Bare object key (no scheme) — preferred for private GCS
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

function decodeIfTransported(value: string): string {
  try {
    return decodeUrlFromApiTransport(value).trim();
  } catch {
    return value.trim();
  }
}

/**
 * Use transform (not preprocess) so react-hook-form / zodResolver accepts GCS keys.
 * Also unwraps b64: transport encoding used to bypass Hostinger WAF.
 */
export const videoReferenceSchema = z
  .string()
  .min(1, "Video path or URL is required")
  .transform(decodeIfTransported)
  .refine(isValidVideoReference, {
    message:
      "Use a GCS key (e.g. aiml/video1.mp4), gs:// URI, storage.googleapis.com URL, or YouTube/Vimeo link",
  });

/** Optional field: empty string, or a valid video reference. */
export const optionalVideoReferenceSchema = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v == null ? "" : decodeIfTransported(String(v))))
  .refine((v) => v === "" || isValidVideoReference(v), {
    message:
      "Use a GCS key (e.g. aiml/video1.mp4), YouTube/Vimeo link, or leave blank",
  });

/**
 * Public marketing demos may use private GCS keys (signed via /api/video when
 * the key matches an active course demo). Prefer YouTube for zero config.
 * @deprecated Use optionalVideoReferenceSchema — kept for any external imports.
 */
export const publicDemoVideoSchema = optionalVideoReferenceSchema;
