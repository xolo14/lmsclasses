/**
 * Browser helpers for recording a Google Meet tab (getDisplayMedia + MediaRecorder).
 * No extra packages — Chrome/Edge desktop only in practice.
 */

export function pickRecorderMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm",
  ];
  if (typeof MediaRecorder === "undefined") return "";
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function stopMediaStream(stream: MediaStream | null | undefined) {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      /* already stopped */
    }
  }
}

export async function captureMeetTab(): Promise<MediaStream> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
    throw new Error(
      "Screen recording is not supported in this browser. Use Chrome or Edge on a computer."
    );
  }

  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      frameRate: { ideal: 30, max: 30 },
      width: { ideal: 1920, max: 1920 },
      height: { ideal: 1080, max: 1080 },
      // Hint Chrome to open the tab picker (Meet tab + “Also share tab audio”).
      displaySurface: "browser",
    },
    audio: true,
    preferCurrentTab: false,
    selfBrowserSurface: "exclude",
    systemAudio: "include",
    monitorTypeSurfaces: "exclude",
    surfaceSwitching: "include",
  } as DisplayMediaStreamOptions);

  if (!stream.getVideoTracks().length) {
    stopMediaStream(stream);
    throw new Error("No video track. Choose the Google Meet tab in the browser picker.");
  }

  return stream;
}

export function recordingFilename(title: string): string {
  const base = title.trim().replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "_") || "live-class";
  return `${base}.webm`;
}

const meetPopups = new Map<string, Window>();

/** Open (or focus) Google Meet in a named popup next to the LMS recorder. */
export function openMeetPopup(meetingLink: string, classId: string): Window | null {
  if (typeof window === "undefined") return null;
  const existing = meetPopups.get(classId);
  if (existing && !existing.closed) {
    existing.focus();
    return existing;
  }

  const width = Math.min(1280, Math.max(960, window.screen.availWidth - 100));
  const height = Math.min(800, Math.max(620, window.screen.availHeight - 80));
  const left = Math.max(0, window.screen.availWidth - width - 16);
  const top = 24;
  const popup = window.open(
    meetingLink,
    `lms-meet-${classId}`,
    `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
  if (!popup) return null;
  meetPopups.set(classId, popup);
  try {
    popup.focus();
  } catch {
    /* some browsers block focus */
  }
  return popup;
}

export function focusMeetPopup(classId: string): boolean {
  const popup = meetPopups.get(classId);
  if (!popup || popup.closed) return false;
  try {
    popup.focus();
    return true;
  } catch {
    return false;
  }
}

export function meetPopupIsOpen(classId: string): boolean {
  const popup = meetPopups.get(classId);
  return !!popup && !popup.closed;
}
