import { getAppUrl } from "@/lib/app-url";
import { getYouTubeThumbnailUrl, isYouTubeUrl } from "@/lib/video-embed";

/** Resolve course card image: uploaded URL first, then YouTube demo poster as fallback. */
export function resolveCourseThumbnailUrl(
  thumbnailUrl?: string | null,
  demoVideoUrl?: string | null
): string | null {
  const trimmed = thumbnailUrl?.trim();
  if (trimmed) {
    if (trimmed.startsWith("/")) {
      return `${getAppUrl()}${trimmed}`;
    }
    return trimmed;
  }

  const demo = demoVideoUrl?.trim();
  if (demo && isYouTubeUrl(demo)) {
    return getYouTubeThumbnailUrl(demo);
  }

  return null;
}
