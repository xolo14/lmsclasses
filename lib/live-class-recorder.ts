/**
 * Browser helpers for recording a Google Meet tab (getDisplayMedia + MediaRecorder).
 * No extra packages — Chrome/Edge desktop only in practice.
 */

export function pickRecorderMimeType(opts?: { audio?: boolean }): string {
  const wantAudio = opts?.audio !== false;
  const candidates = wantAudio
    ? [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=avc1,opus",
        "video/webm",
      ]
    : [
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

function enableTracks(tracks: MediaStreamTrack[]) {
  for (const track of tracks) {
    try {
      track.enabled = true;
    } catch {
      /* ignore */
    }
  }
}

async function mixAudioTracks(tracks: MediaStreamTrack[]): Promise<{
  stream: MediaStream | null;
  stop: () => void;
}> {
  const live = tracks.filter((t) => t.readyState === "live");
  if (!live.length) return { stream: null, stop: () => undefined };
  if (live.length === 1) {
    return { stream: new MediaStream([live[0]!]), stop: () => undefined };
  }

  const context = new AudioContext();
  const dest = context.createMediaStreamDestination();
  const nodes: AudioNode[] = [];
  for (const track of live) {
    const src = context.createMediaStreamSource(new MediaStream([track]));
    src.connect(dest);
    nodes.push(src);
  }
  if (context.state === "suspended") {
    await context.resume().catch(() => undefined);
  }

  return {
    stream: dest.stream,
    stop: () => {
      for (const node of nodes) {
        try {
          node.disconnect();
        } catch {
          /* ignore */
        }
      }
      void context.close().catch(() => undefined);
    },
  };
}

export type MeetCapture = {
  stream: MediaStream;
  stop: () => void;
  hasTabAudio: boolean;
  hasMicAudio: boolean;
};

/**
 * Capture the Meet Chrome tab (with tab audio) and mix in the teacher's microphone
 * so the recording is not silent when they share a window instead of a tab.
 */
export async function captureMeetTab(): Promise<MeetCapture> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
    throw new Error(
      "Screen recording is not supported in this browser. Use Chrome or Edge on a computer."
    );
  }

  const display = await navigator.mediaDevices.getDisplayMedia({
    video: {
      frameRate: { ideal: 30, max: 30 },
      width: { ideal: 1920, max: 1920 },
      height: { ideal: 1080, max: 1080 },
      displaySurface: "browser",
    },
    audio: true,
    preferCurrentTab: false,
    selfBrowserSurface: "exclude",
    systemAudio: "include",
    monitorTypeSurfaces: "exclude",
    surfaceSwitching: "include",
    suppressLocalAudioPlayback: false,
  } as DisplayMediaStreamOptions);

  if (!display.getVideoTracks().length) {
    stopMediaStream(display);
    throw new Error("No video track. Choose the Google Meet tab in the browser picker.");
  }

  enableTracks(display.getAudioTracks());
  const tabAudio = display.getAudioTracks().filter((t) => t.readyState === "live");

  let mic: MediaStream | null = null;
  try {
    mic = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    enableTracks(mic.getAudioTracks());
  } catch {
    mic = null;
  }

  const micAudio = mic?.getAudioTracks().filter((t) => t.readyState === "live") ?? [];
  const mixed = await mixAudioTracks([...tabAudio, ...micAudio]);

  const stream = new MediaStream();
  for (const track of display.getVideoTracks()) stream.addTrack(track);
  const audioTracks = mixed.stream?.getAudioTracks() ?? [];
  for (const track of audioTracks) stream.addTrack(track);

  const stop = () => {
    mixed.stop();
    stopMediaStream(display);
    stopMediaStream(mic);
    stopMediaStream(stream);
  };

  return {
    stream,
    stop,
    hasTabAudio: tabAudio.length > 0,
    hasMicAudio: micAudio.length > 0,
  };
}

export function recordingFilename(title: string): string {
  const base = title.trim().replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "_") || "live-class";
  return `${base}.webm`;
}

const meetWindows = new Map<string, Window>();

/**
 * Open (or focus) Google Meet in a normal browser tab.
 * A popup window cannot share “tab audio”, so recordings would be silent.
 */
export function openMeetPopup(meetingLink: string, classId: string): Window | null {
  if (typeof window === "undefined") return null;
  const existing = meetWindows.get(classId);
  if (existing && !existing.closed) {
    existing.focus();
    return existing;
  }

  const tab = window.open(meetingLink, `lms-meet-${classId}`);
  if (!tab) return null;
  meetWindows.set(classId, tab);
  try {
    tab.focus();
  } catch {
    /* some browsers block focus */
  }
  return tab;
}

export function focusMeetPopup(classId: string): boolean {
  const tab = meetWindows.get(classId);
  if (!tab || tab.closed) return false;
  try {
    tab.focus();
    return true;
  } catch {
    return false;
  }
}

export function meetPopupIsOpen(classId: string): boolean {
  const tab = meetWindows.get(classId);
  return !!tab && !tab.closed;
}
