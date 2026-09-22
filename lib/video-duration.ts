/**
 * MediaRecorder WebM and many phone/export MP4s have no duration in the first
 * bytes. The browser then shows 0:00 / live and only lets you rewind into
 * already-buffered data. Seeking to a huge timestamp forces it to read the
 * end of the file (via HTTP Range) and learn the real length.
 */
export function recoverVideoDuration(video: HTMLVideoElement) {
  if (video.dataset.lmsDurationFix === "1") return;
  if (Number.isFinite(video.duration) && video.duration > 0) return;

  video.dataset.lmsDurationFix = "1";
  const wasPaused = video.paused;

  const finish = () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    video.removeEventListener("timeupdate", finish);
    video.removeEventListener("seeked", finish);
    video.removeEventListener("durationchange", finish);
    if (video.currentTime > 0.25) {
      try {
        video.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    if (wasPaused) video.pause();
  };

  video.addEventListener("timeupdate", finish);
  video.addEventListener("seeked", finish);
  video.addEventListener("durationchange", finish);
  try {
    video.currentTime = 1e10;
  } catch {
    delete video.dataset.lmsDurationFix;
  }
}

export function contentTypeForVideoKey(key: string): string | undefined {
  const lower = key.split("?")[0]?.toLowerCase() ?? "";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mp4") || lower.endsWith(".m4v")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".ogg") || lower.endsWith(".ogv")) return "video/ogg";
  if (lower.endsWith(".mkv")) return "video/x-matroska";
  return undefined;
}
