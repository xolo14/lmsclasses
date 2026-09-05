const DIRECT_VIDEO_REGEX = /\.(mp4|webm|ogg|mov|m4v)(?:\?.*)?$/i;

function extractUrlIfIframe(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("<iframe") && trimmed.includes("src=")) {
    const match = trimmed.match(/src=["']([^"']+)["']/i);
    if (match?.[1]) return match[1];
  }
  return trimmed;
}

function youtubeVideoId(url: string): string | null {
  const clean = extractUrlIfIframe(url);
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /^.*[?&]v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = clean.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function vimeoVideoId(url: string): string | null {
  const clean = extractUrlIfIframe(url);
  const match = clean.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match?.[1] ?? null;
}

function googleDriveFileId(url: string): string | null {
  const clean = extractUrlIfIframe(url);
  const patterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/file\/u\/\d+\/d\/([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = clean.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function isYouTubeUrl(url: string): boolean {
  return youtubeVideoId(url) !== null;
}

/** Static poster image for a YouTube watch/embed URL (card thumbnails). */
export function getYouTubeThumbnailUrl(url: string): string | null {
  const id = youtubeVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

export function isVimeoUrl(url: string): boolean {
  return vimeoVideoId(url) !== null;
}

export function isGoogleDriveUrl(url: string): boolean {
  return googleDriveFileId(url) !== null;
}

export function isDirectVideoUrl(url: string): boolean {
  const clean = extractUrlIfIframe(url);
  return DIRECT_VIDEO_REGEX.test(clean);
}

export function getYouTubeEmbedUrl(url: string, autoplay = false): string | null {
  const id = youtubeVideoId(url);
  if (!id) return null;
  const params = new URLSearchParams();
  if (autoplay) params.set("autoplay", "1");
  params.set("modestbranding", "1");
  params.set("rel", "0");
  params.set("disablekb", "1");
  // youtube-nocookie + disablekb reduces download/share chrome vs watch pages
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
}

export function getVimeoEmbedUrl(url: string, autoplay = false): string | null {
  const id = vimeoVideoId(url);
  if (!id) return null;
  const params = new URLSearchParams();
  if (autoplay) params.set("autoplay", "1");
  params.set("dnt", "1");
  params.set("download", "0");
  params.set("title", "0");
  params.set("byline", "0");
  params.set("portrait", "0");
  return `https://player.vimeo.com/video/${id}?${params}`;
}

export function getGoogleDriveEmbedUrl(url: string): string | null {
  const id = googleDriveFileId(url);
  if (!id) return null;
  return `https://drive.google.com/file/d/${id}/preview`;
}

export type ResolvedVideoEmbed =
  | { type: "youtube"; embedUrl: string }
  | { type: "vimeo"; embedUrl: string }
  | { type: "google-drive"; embedUrl: string }
  | { type: "direct"; embedUrl: string }
  | { type: "external" };

export function resolveVideoEmbed(url: string, autoplay = false): ResolvedVideoEmbed {
  const trimmed = extractUrlIfIframe(url);
  const youtube = getYouTubeEmbedUrl(trimmed, autoplay);
  if (youtube) return { type: "youtube", embedUrl: youtube };
  const vimeo = getVimeoEmbedUrl(trimmed, autoplay);
  if (vimeo) return { type: "vimeo", embedUrl: vimeo };
  const drive = getGoogleDriveEmbedUrl(trimmed);
  if (drive) return { type: "google-drive", embedUrl: drive };
  if (isDirectVideoUrl(trimmed)) return { type: "direct", embedUrl: trimmed };
  return { type: "external" };
}

/** Props applied to native `<video>` elements to hide browser download controls. */
export const protectedVideoProps = {
  controlsList: "nodownload noremoteplayback",
  disablePictureInPicture: true,
  playsInline: true,
} as const;

/** `allow` attribute for embedded YouTube/Vimeo players. */
export const protectedIframeAllow =
  "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture";
