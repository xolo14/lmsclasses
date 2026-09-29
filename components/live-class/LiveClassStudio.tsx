"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Circle,
  ExternalLink,
  Pause,
  Play,
  Square,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WatchRecordingModal } from "@/components/modals/WatchRecordingModal";
import { formatDateTime } from "@/lib/utils";
import { formatFileSize } from "@/lib/video-upload";
import {
  startResumableVideoUpload,
  uploadFileToResumableSession,
} from "@/lib/video-upload-client";
import { wrapApiForm } from "@/lib/api-url-transport";
import {
  captureMeetTab,
  createLiveMediaRecorder,
  focusMeetPopup,
  formatElapsed,
  meetPopupIsOpen,
  openMeetPopup,
  pickRecorderMimeType,
  recordingFilename,
  stopMediaStream,
} from "@/lib/live-class-recorder";
import {
  firstEmptyLiveRecordingSlot,
  LIVE_RECORDING_SLOTS,
  liveRecordingDisplayTitle,
  liveRecordingSlotsFromRow,
  liveRecordingWatchLabel,
  type LiveRecordingSlot,
} from "@/lib/live-recording-slots";
import {
  deleteLiveTake,
  getLiveTake,
  listLiveTakes,
  saveLiveTake,
  type LocalLiveTakeMeta,
} from "@/lib/live-class-take-store";

type Phase = "idle" | "recording" | "paused" | "interrupted" | "preview" | "uploading";

type LiveClassDetail = {
  id: string;
  title: string;
  courseTitle: string | null;
  batchName: string | null;
  meetingLink: string | null;
  scheduledAt: string;
  duration: number | null;
  recordingUrl: string | null;
  recordingUrlB: string | null;
  recordingUrlC: string | null;
  status: string | null;
};

function daysLeft(expiresAt: number) {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function LiveClassStudio({
  liveClassId,
  backHref,
}: {
  liveClassId: string;
  backHref: string;
}) {
  const queryClient = useQueryClient();
  const livePreviewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureStopRef = useRef<(() => void) | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const segmentsRef = useRef<Blob[]>([]);
  const stopReasonRef = useRef<"user" | "interrupt">("user");
  const accumulatedMsRef = useRef(0);
  const tickStartRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const previewUrlRef = useRef("");
  const previewPartUrlsRef = useRef<string[]>([]);
  const historyPlayUrlRef = useRef("");
  const currentTakeIdRef = useRef<string | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewParts, setPreviewParts] = useState<string[]>([]);
  const [previewPartIndex, setPreviewPartIndex] = useState(0);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [meetOpen, setMeetOpen] = useState(false);
  const [watchOpen, setWatchOpen] = useState(false);
  const [watchUrl, setWatchUrl] = useState("");
  const [watchTitle, setWatchTitle] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [savedKey, setSavedKey] = useState("");
  const [savedSlot, setSavedSlot] = useState<LiveRecordingSlot | null>(null);
  const [recordSlot, setRecordSlot] = useState<LiveRecordingSlot>("A");
  const [takes, setTakes] = useState<LocalLiveTakeMeta[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [historyPlayUrl, setHistoryPlayUrl] = useState("");
  const [historyPlayId, setHistoryPlayId] = useState("");
  const [uploadingTakeId, setUploadingTakeId] = useState<string | null>(null);

  const { data: liveClass, isLoading, isError } = useQuery<LiveClassDetail>({
    queryKey: ["live-class", liveClassId],
    queryFn: async () => {
      const res = await fetch(`/api/live-classes/${liveClassId}`);
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(typeof json?.error === "string" ? json.error : "Failed to load class");
      }
      return json as LiveClassDetail;
    },
  });

  const sessionActive =
    phase === "recording" || phase === "paused" || phase === "interrupted" || phase === "uploading";
  const busy = sessionActive;

  const refreshTakes = useCallback(async () => {
    try {
      const rows = await listLiveTakes(liveClassId);
      setTakes(rows);
      setHistoryError("");
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Could not read local history.");
    }
  }, [liveClassId]);

  useEffect(() => {
    void refreshTakes();
  }, [refreshTakes]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (liveClassId) setMeetOpen(meetPopupIsOpen(liveClassId));
    }, 800);
    return () => window.clearInterval(id);
  }, [liveClassId]);

  const resetMedia = () => {
    recorderRef.current = null;
    chunksRef.current = [];
    segmentsRef.current = [];
    stopReasonRef.current = "user";
    accumulatedMsRef.current = 0;
    captureStopRef.current?.();
    captureStopRef.current = null;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
    for (const url of previewPartUrlsRef.current) URL.revokeObjectURL(url);
    previewPartUrlsRef.current = [];
    setPreviewUrl("");
    setPreviewParts([]);
    setPreviewPartIndex(0);
    setPreviewFile(null);
    setElapsed(0);
    setUploadProgress(0);
    setUploadStatus("");
  };

  useEffect(() => {
    return () => {
      resetMedia();
      if (historyPlayUrlRef.current) URL.revokeObjectURL(historyPlayUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!liveClass) return;
    setRecordSlot(firstEmptyLiveRecordingSlot(liveClass));
    // First load only — after that the user picks A/B/C.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveClassId, !!liveClass]);

  useEffect(() => {
    if (phase !== "recording" && phase !== "uploading" && phase !== "paused" && phase !== "interrupted") return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [phase]);

  useEffect(() => {
    if ((phase === "recording" || phase === "paused") && streamRef.current && livePreviewRef.current) {
      livePreviewRef.current.srcObject = streamRef.current;
      livePreviewRef.current.muted = true;
      void livePreviewRef.current.play().catch(() => undefined);
    }
  }, [phase]);

  const openMeet = () => {
    setError("");
    const link = liveClass?.meetingLink?.trim();
    if (!link) {
      setError("This class has no Google Meet link. Add one to the live class first.");
      return;
    }
    const popup = openMeetPopup(link, liveClassId);
    if (!popup) {
      setError("The browser blocked the Meet tab. Allow popups for this site and try again.");
      return;
    }
    setMeetOpen(true);
  };

  const showPreview = (file: File, takeId: string | null) => {
    const url = URL.createObjectURL(file);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    for (const partUrl of previewPartUrlsRef.current) URL.revokeObjectURL(partUrl);
    previewPartUrlsRef.current = [];
    previewUrlRef.current = url;
    currentTakeIdRef.current = takeId;
    setPreviewParts([]);
    setPreviewPartIndex(0);
    setPreviewFile(file);
    setPreviewUrl(url);
    setPhase("preview");
  };

  const stopTick = () => {
    if (tickStartRef.current) {
      accumulatedMsRef.current += Date.now() - tickStartRef.current;
      tickStartRef.current = 0;
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setElapsed(Math.floor(accumulatedMsRef.current / 1000));
  };

  const startTick = () => {
    tickStartRef.current = Date.now();
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setElapsed(Math.floor((accumulatedMsRef.current + Date.now() - tickStartRef.current) / 1000));
    }, 250);
  };

  const clearCapture = () => {
    captureStopRef.current?.();
    captureStopRef.current = null;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (livePreviewRef.current) livePreviewRef.current.srcObject = null;
    recorderRef.current = null;
  };

  const presentBlob = (blob: Blob) => {
    const existingSlots = liveClass ? liveRecordingSlotsFromRow(liveClass) : [];
    const replacing = existingSlots.some((s) => s.slot === recordSlot);
    const slotCount = replacing ? existingSlots.length : existingSlots.length + 1;
    const title = liveRecordingDisplayTitle(liveClass?.title || "live-class", recordSlot, slotCount);
    const file = new File([blob], recordingFilename(title), {
      type: blob.type || "video/webm",
    });
    showPreview(file, null);
    if (blob.size > 200 * 1024 * 1024) {
      setWarning(
        "This take is too large to keep in History on this computer. Upload it now or it will be lost if you leave."
      );
      return;
    }
    window.setTimeout(() => {
      void (async () => {
        try {
          const meta = await saveLiveTake({
            liveClassId,
            title,
            blob,
            durationSeconds: Math.floor(accumulatedMsRef.current / 1000),
          });
          currentTakeIdRef.current = meta.id;
          await refreshTakes();
        } catch (err) {
          setWarning(
            err instanceof Error && /quota|Quota/i.test(err.message)
              ? "This computer is out of space for local drafts. Upload now or delete old History items."
              : "Could not keep this take in History. Upload it now or it will be lost if you leave."
          );
        }
      })();
    }, 0);
  };

  const finishToPreview = async (blobType: string) => {
    stopTick();
    const part = new Blob(chunksRef.current, { type: blobType || "video/webm" });
    chunksRef.current = [];
    if (part.size >= 1024) segmentsRef.current.push(part);
    clearCapture();

    if (segmentsRef.current.length === 0) {
      setError("The recording is empty. Share the Google Meet Chrome tab and try again.");
      setPhase("idle");
      return;
    }

    const parts = segmentsRef.current.filter((part) => part.size >= 1024);
    segmentsRef.current = [];
    if (parts.length === 0) {
      setError("The recording is empty. Share the Google Meet Chrome tab and try again.");
      setPhase("idle");
      return;
    }
    if (parts.length === 1) {
      setWarning("");
      presentBlob(parts[0]!);
      return;
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
    for (const url of previewPartUrlsRef.current) URL.revokeObjectURL(url);
    const urls = parts.map((part) => URL.createObjectURL(part));
    previewPartUrlsRef.current = urls;
    currentTakeIdRef.current = null;
    setPreviewFile(null);
    setPreviewUrl("");
    setPreviewParts(urls);
    setPreviewPartIndex(0);
    setWarning(
      "Sharing stopped in the middle, so this preview plays each part in order. Upload stays off because those parts are not one file. Record the class again in one take to upload it."
    );
    setPhase("preview");
  };

  const handleRecorderStop = (blobType: string) => {
    const reason = stopReasonRef.current;
    stopReasonRef.current = "user";
    if (reason === "interrupt") {
      stopTick();
      const part = new Blob(chunksRef.current, { type: blobType || "video/webm" });
      chunksRef.current = [];
      if (part.size >= 1024) segmentsRef.current.push(part);
      clearCapture();
      if (segmentsRef.current.length === 0) {
        setError("Sharing stopped before any video was captured. Start again.");
        setPhase("idle");
        return;
      }
      setWarning(
        "Sharing was interrupted. Click Continue to keep recording this video, or Finish to preview what you have."
      );
      setPhase("interrupted");
      return;
    }
    void finishToPreview(blobType);
  };

  const attachCapture = async (mode: "start" | "continue") => {
    setError("");
    if (mode === "start") {
      setWarning("");
      setSavedMessage("");
      segmentsRef.current = [];
      chunksRef.current = [];
      accumulatedMsRef.current = 0;
      setElapsed(0);
    }

    let capture: Awaited<ReturnType<typeof captureMeetTab>>;
    try {
      capture = await captureMeetTab();
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError") {
        setError(
          "Permission denied. Click Continue or Start recording again and pick a Chrome tab, a window, or the entire screen."
        );
      } else {
        setError(err instanceof Error ? err.message : "Could not start screen capture.");
      }
      return;
    }

    const { stream, stop, hasTabAudio, hasMicAudio, displaySurface, sourceVideoTrack } = capture;
    const surface = displaySurface;

    if (!hasTabAudio && !hasMicAudio) {
      stop();
      setError(
        "No audio was captured. Allow the microphone, or pick Chrome Tab → Google Meet and turn on “Also share tab audio”."
      );
      return;
    }

    if (!hasTabAudio) {
      setWarning(
        surface === "monitor"
          ? "You shared the entire screen. Student voices are included only if system audio is on; otherwise this recording has your microphone. Share the Google Meet Chrome tab with “Also share tab audio” for the clearest class audio."
          : surface === "window"
            ? "You shared a window, so only your microphone is in this recording. Share the Google Meet Chrome tab with “Also share tab audio” if you need student voices."
            : "Meet tab audio was not shared, so only your microphone is in this recording. Stop and share the Google Meet Chrome tab with “Also share tab audio” to include students."
      );
    }

    const mimeType = pickRecorderMimeType({ audio: true });
    if (!mimeType) {
      stop();
      setError("This browser cannot record audio and video together. Use Chrome or Edge on a computer.");
      return;
    }

    captureStopRef.current = stop;
    streamRef.current = stream;
    chunksRef.current = [];

    let recorder: MediaRecorder;
    try {
      recorder = createLiveMediaRecorder(stream, mimeType);
    } catch {
      stop();
      captureStopRef.current = null;
      streamRef.current = null;
      setError("This browser could not start the recorder. Use Chrome or Edge on a computer.");
      return;
    }
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onerror = () => {
      stopReasonRef.current = "interrupt";
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      } else {
        handleRecorderStop(recorder.mimeType || mimeType);
      }
    };
    recorder.onstop = () => handleRecorderStop(recorder.mimeType || mimeType);

    if (sourceVideoTrack) {
      sourceVideoTrack.addEventListener("ended", () => {
        const current = recorderRef.current;
        if (!current || current.state === "inactive") return;
        stopReasonRef.current = "interrupt";
        current.stop();
      });
    }

    recorder.start(5000);
    startedAtRef.current = Date.now();
    startTick();
    setPhase("recording");
    focusMeetPopup(liveClassId);
  };

  const startRecording = async () => {
    await attachCapture("start");
  };

  const continueRecording = async () => {
    const recorder = recorderRef.current;
    if (phase === "paused" && recorder?.state === "paused") {
      setError("");
      recorder.resume();
      startTick();
      setPhase("recording");
      return;
    }
    await attachCapture("continue");
  };

  const pauseRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    if (typeof recorder.pause !== "function") {
      setError("Pause is not available in this browser. Use Stop, or Continue after an interrupt.");
      return;
    }
    recorder.pause();
    stopTick();
    setPhase("paused");
  };

  const stopRecording = () => {
    stopReasonRef.current = "user";
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      return;
    }
    void finishToPreview("video/webm");
  };

  const discardPreview = () => {
    resetMedia();
    currentTakeIdRef.current = null;
    setPhase("idle");
    setError("");
  };

  const uploadFile = async (file: File, takeId: string | null) => {
    if (!liveClass) return;
    setError("");
    setPhase("uploading");
    setUploadingTakeId(takeId);
    setUploadProgress(2);
    setUploadStatus("Starting upload session...");

    try {
      const session = await startResumableVideoUpload({
        liveClassId: liveClass.id,
        file,
      });
      setUploadStatus("Uploading recording...");
      await uploadFileToResumableSession(file, session, {
        onProgress: (uploaded) => {
          const percent = 5 + Math.round((uploaded / file.size) * 90);
          setUploadProgress(Math.min(95, Math.max(5, percent)));
          setUploadStatus(`Uploading ${formatFileSize(uploaded)} of ${formatFileSize(file.size)}...`);
        },
      });

      setUploadProgress(98);
      setUploadStatus("Saving private link...");

      const res = await fetch("/api/media/save-live", {
        method: "POST",
        body: wrapApiForm({ liveClassId: liveClass.id, recordingUrl: session.objectKey, slot: recordSlot }),
        credentials: "same-origin",
      });
      const raw = await res.text();
      let json: { error?: unknown } = {};
      if (raw) {
        try {
          json = JSON.parse(raw) as { error?: unknown };
        } catch {
          /* WAF */
        }
      }
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string" && json.error
            ? json.error
            : "Failed to save the recording."
        );
      }

      if (takeId) await deleteLiveTake(takeId).catch(() => undefined);
      currentTakeIdRef.current = null;
      await refreshTakes();
      setUploadProgress(100);
      resetMedia();
      setPhase("idle");
      const filled = liveRecordingSlotsFromRow({
        ...liveClass,
        [recordSlot === "B" ? "recordingUrlB" : recordSlot === "C" ? "recordingUrlC" : "recordingUrl"]:
          session.objectKey,
      }).length;
      setSavedMessage(
        `Video ${recordSlot} saved (${filled} of 3). Students can watch it in the course.`
      );
      setSavedKey(session.objectKey);
      setSavedSlot(recordSlot);
      const nextRow = {
        ...liveClass,
        [recordSlot === "B" ? "recordingUrlB" : recordSlot === "C" ? "recordingUrlC" : "recordingUrl"]:
          session.objectKey,
      };
      setRecordSlot(firstEmptyLiveRecordingSlot(nextRow));
      queryClient.invalidateQueries({ queryKey: ["live-class", liveClassId] });
      queryClient.invalidateQueries({ queryKey: ["live-classes"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      setPhase(previewFile ? "preview" : "idle");
      setUploadProgress(0);
      setUploadStatus("");
    } finally {
      setUploadingTakeId(null);
    }
  };

  const uploadRecording = async () => {
    if (!previewFile) return;
    await uploadFile(previewFile, currentTakeIdRef.current);
  };

  const playHistoryTake = async (id: string) => {
    setHistoryError("");
    try {
      const take = await getLiveTake(id);
      if (!take) {
        setHistoryError("That take expired or was deleted.");
        await refreshTakes();
        return;
      }
      if (historyPlayUrlRef.current) URL.revokeObjectURL(historyPlayUrlRef.current);
      const url = URL.createObjectURL(take.blob);
      historyPlayUrlRef.current = url;
      setHistoryPlayUrl(url);
      setHistoryPlayId(id);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Could not play this take.");
    }
  };

  const uploadHistoryTake = async (id: string) => {
    setHistoryError("");
    setError("");
    try {
      const take = await getLiveTake(id);
      if (!take) {
        setHistoryError("That take expired or was deleted.");
        await refreshTakes();
        return;
      }
      const file = new File([take.blob], recordingFilename(take.title), {
        type: take.mimeType || "video/webm",
      });
      showPreview(file, take.id);
      await uploadFile(file, take.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload this take.");
    }
  };

  const deleteHistoryTake = async (id: string) => {
    try {
      await deleteLiveTake(id);
      if (historyPlayId === id) {
        if (historyPlayUrlRef.current) URL.revokeObjectURL(historyPlayUrlRef.current);
        historyPlayUrlRef.current = "";
        setHistoryPlayUrl("");
        setHistoryPlayId("");
      }
      if (currentTakeIdRef.current === id) currentTakeIdRef.current = null;
      await refreshTakes();
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Could not delete this take.");
    }
  };

  if (isLoading) {
    return <div className="text-muted-foreground">Loading live class studio...</div>;
  }

  if (isError || !liveClass) {
    return (
      <div className="space-y-3">
        <p className="text-destructive">Could not load this live class.</p>
        <Button variant="outline" asChild>
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to live classes
          </Link>
        </Button>
      </div>
    );
  }

  const filledSlots = liveRecordingSlotsFromRow({
    ...liveClass,
    ...(savedSlot === "A" && savedKey ? { recordingUrl: savedKey } : {}),
    ...(savedSlot === "B" && savedKey ? { recordingUrlB: savedKey } : {}),
    ...(savedSlot === "C" && savedKey ? { recordingUrlC: savedKey } : {}),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" asChild>
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Live classes
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{liveClass.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[liveClass.courseTitle, liveClass.batchName].filter(Boolean).join(" · ") || "Live class"}
            {" · "}
            {formatDateTime(liveClass.scheduledAt)}
          </p>
        </div>
        <Badge variant={liveClass.status === "live" ? "success" : liveClass.status === "completed" ? "outline" : "warning"}>
          {liveClass.status || "scheduled"}
        </Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="space-y-4 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Google Meet</h2>
            <span className="text-xs text-muted-foreground">
              {meetOpen ? "Meet tab is open" : "Meet tab closed"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Meet cannot run inside this page (Google blocks embedding). It opens in a browser tab so
            Chrome can share that tab’s audio into the recording.
          </p>
          <div className="flex aspect-video flex-col items-center justify-center rounded-md border border-dashed bg-muted/30 p-6 text-center">
            <ExternalLink className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">
              {meetOpen ? "The live class is running in the Meet tab." : "Open Meet to start the class."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Keep this LMS tab open. Teach in the Meet tab (camera, mic, students).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={openMeet}
              disabled={!liveClass.meetingLink || phase === "recording" || phase === "uploading"}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {meetOpen ? "Focus Google Meet" : "Open Google Meet"}
            </Button>
            {!liveClass.meetingLink && (
              <p className="self-center text-xs text-destructive">No meeting link on this class.</p>
            )}
          </div>
        </section>

        <section className="space-y-4 rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Record</h2>
          <p className="text-sm text-muted-foreground">
            This Meet link can have 3 student videos: A, B, and C. Pick a letter, then record.
            Recording again on a letter that is already filled replaces that video only.
          </p>
          <div className="flex flex-wrap gap-2">
            {LIVE_RECORDING_SLOTS.map((letter) => {
              const filled = filledSlots.some((s) => s.slot === letter);
              return (
                <Button
                  key={letter}
                  type="button"
                  size="sm"
                  variant={recordSlot === letter ? "default" : "outline"}
                  disabled={phase !== "idle" && phase !== "preview"}
                  onClick={() => setRecordSlot(letter)}
                >
                  {letter}
                  {filled ? " · saved" : ""}
                </Button>
              );
            })}
          </div>
          <ol className="list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
            <li>Open Google Meet (it opens as a browser tab).</li>
            <li>
              Click Start recording. In Chrome pick <strong>Chrome Tab</strong> → the{" "}
              <strong>Google Meet</strong> tab, <strong>Window</strong>, or{" "}
              <strong>Entire screen</strong>. Do not pick this LMS page.
            </li>
            <li>
              For a tab, turn on <strong>Also share tab audio</strong>. For a window or entire
              screen, allow the microphone (and system audio if Chrome offers it).
            </li>
            <li>
              Use Pause and Continue if you need a break. If sharing stops suddenly, Continue keeps
              the same video. Stop → preview → upload to video {recordSlot}.
            </li>
          </ol>

          {(phase === "recording" || phase === "paused") && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span
                  className={`inline-flex items-center gap-2 font-semibold ${
                    phase === "paused" ? "text-amber-600" : "text-red-500"
                  }`}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      phase === "paused" ? "bg-amber-500" : "animate-pulse bg-red-500"
                    }`}
                  />
                  {phase === "paused" ? `Paused · video ${recordSlot}` : `Recording video ${recordSlot}`}
                </span>
                <span className="font-mono tabular-nums">{formatElapsed(elapsed)}</span>
              </div>
              <video
                ref={livePreviewRef}
                className="aspect-video w-full rounded-md bg-black"
                muted
                playsInline
                autoPlay
              />
            </div>
          )}

          {phase === "interrupted" && (
            <p className="text-sm font-medium">
              Video {recordSlot} paused at {formatElapsed(elapsed)}. Continue to share again, or
              Finish to preview.
            </p>
          )}

          {phase === "preview" && (previewUrl || previewParts.length > 0) && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Preview · video {recordSlot}
                {previewParts.length > 1 ? ` · part ${previewPartIndex + 1} of ${previewParts.length}` : ""}
              </p>
              <video
                key={previewParts.length > 0 ? previewParts[previewPartIndex] : previewUrl}
                className="aspect-video w-full rounded-md bg-black"
                src={previewParts.length > 0 ? previewParts[previewPartIndex] : previewUrl}
                controls
                playsInline
                autoPlay={previewParts.length > 1}
                onEnded={() => {
                  if (previewPartIndex < previewParts.length - 1) {
                    setPreviewPartIndex((index) => index + 1);
                  }
                }}
              />
              {previewFile && (
                <p className="text-xs text-muted-foreground">
                  {previewFile.name} · {formatFileSize(previewFile.size)}
                </p>
              )}
            </div>
          )}

          {phase === "uploading" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-primary">{uploadStatus}</span>
                <span className="font-bold">{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {(savedMessage || filledSlots.length > 0) && phase === "idle" && (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              {savedMessage ||
                `${filledSlots.length} of 3 videos saved (${filledSlots.map((s) => s.slot).join(", ")}). Pick a letter to record or replace.`}
            </p>
          )}

          {warning && !error && (
            <div className="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{warning}</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {phase === "idle" && (
              <>
                <Button type="button" onClick={() => void startRecording()}>
                  <Circle className="mr-2 h-4 w-4 fill-red-500 text-red-500" /> Start recording {recordSlot}
                </Button>
                {filledSlots.map((slot) => (
                  <Button
                    key={slot.slot}
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setWatchUrl(slot.url);
                      setWatchTitle(
                        liveRecordingDisplayTitle(liveClass.title, slot.slot, filledSlots.length)
                      );
                      setWatchOpen(true);
                    }}
                  >
                    <Play className="mr-2 h-4 w-4" /> {liveRecordingWatchLabel(slot.slot, filledSlots.length)}
                  </Button>
                ))}
              </>
            )}
            {phase === "recording" && (
              <>
                <Button type="button" variant="outline" onClick={pauseRecording}>
                  <Pause className="mr-2 h-4 w-4" /> Pause
                </Button>
                <Button type="button" variant="destructive" onClick={stopRecording}>
                  <Square className="mr-2 h-4 w-4" /> Stop
                </Button>
              </>
            )}
            {phase === "paused" && (
              <>
                <Button type="button" onClick={() => void continueRecording()}>
                  <Play className="mr-2 h-4 w-4" /> Continue
                </Button>
                <Button type="button" variant="destructive" onClick={stopRecording}>
                  <Square className="mr-2 h-4 w-4" /> Stop
                </Button>
              </>
            )}
            {phase === "interrupted" && (
              <>
                <Button type="button" onClick={() => void continueRecording()}>
                  <Play className="mr-2 h-4 w-4" /> Continue
                </Button>
                <Button type="button" variant="outline" onClick={stopRecording}>
                  Finish
                </Button>
              </>
            )}
            {phase === "preview" && (
              <>
                <Button type="button" variant="outline" onClick={discardPreview}>
                  Discard
                </Button>
                {previewFile ? (
                  <Button type="button" onClick={() => void uploadRecording()}>
                    <UploadCloud className="mr-2 h-4 w-4" /> Upload {recordSlot}
                  </Button>
                ) : (
                  <Button type="button" disabled>
                    <UploadCloud className="mr-2 h-4 w-4" /> Upload unavailable
                  </Button>
                )}
              </>
            )}
          </div>
        </section>

        <section className="space-y-4 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">History</h2>
            <span className="text-xs text-muted-foreground">This browser · 7 days</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Takes you have not uploaded stay on this computer for seven days. They are not on the
            server and students cannot see them until you upload.
          </p>

          {historyPlayUrl && (
            <video
              key={historyPlayUrl}
              className="aspect-video w-full rounded-md bg-black"
              src={historyPlayUrl}
              controls
              playsInline
            />
          )}

          {historyError && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{historyError}</span>
            </div>
          )}

          {takes.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No local takes yet. Stop a recording to save a draft here.
            </p>
          ) : (
            <ul className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
              {takes.map((take) => (
                <li key={take.id} className="rounded-md border p-3 text-sm">
                  <p className="font-medium">{take.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(new Date(take.createdAt).toISOString())}
                    {" · "}
                    {formatElapsed(take.durationSeconds)}
                    {" · "}
                    {formatFileSize(take.size)}
                    {" · "}
                    {daysLeft(take.expiresAt)}d left
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void playHistoryTake(take.id)}
                    >
                      <Play className="mr-1 h-3 w-3" /> Play
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy}
                      onClick={() => void uploadHistoryTake(take.id)}
                    >
                      <UploadCloud className="mr-1 h-3 w-3" />
                      {uploadingTakeId === take.id ? "Uploading..." : "Upload"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => void deleteHistoryTake(take.id)}
                    >
                      <Trash2 className="mr-1 h-3 w-3" /> Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <WatchRecordingModal
        open={watchOpen}
        onOpenChange={setWatchOpen}
        videoUrl={watchUrl}
        title={watchTitle || liveClass.title}
      />
    </div>
  );
}

export function LiveClassStudioRoute() {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const backHref = pathname.startsWith("/mentor")
    ? "/mentor/live-classes"
    : pathname.startsWith("/manager")
      ? "/manager/live-classes"
      : "/super-admin/live-classes";

  return <LiveClassStudio liveClassId={String(params.id)} backHref={backHref} />;
}
