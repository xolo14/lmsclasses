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
  focusMeetPopup,
  formatElapsed,
  meetPopupIsOpen,
  openMeetPopup,
  pickRecorderMimeType,
  recordingFilename,
  stopMediaStream,
} from "@/lib/live-class-recorder";
import {
  deleteLiveTake,
  getLiveTake,
  listLiveTakes,
  saveLiveTake,
  type LocalLiveTakeMeta,
} from "@/lib/live-class-take-store";

type Phase = "idle" | "recording" | "preview" | "uploading";

type LiveClassDetail = {
  id: string;
  title: string;
  courseTitle: string | null;
  batchName: string | null;
  meetingLink: string | null;
  scheduledAt: string;
  duration: number | null;
  recordingUrl: string | null;
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
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const previewUrlRef = useRef("");
  const historyPlayUrlRef = useRef("");
  const currentTakeIdRef = useRef<string | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [meetOpen, setMeetOpen] = useState(false);
  const [watchOpen, setWatchOpen] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [savedKey, setSavedKey] = useState("");
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

  const busy = phase === "recording" || phase === "uploading";

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
    setPreviewUrl("");
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
    if (phase !== "recording" && phase !== "uploading") return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [phase]);

  useEffect(() => {
    if (phase === "recording" && streamRef.current && livePreviewRef.current) {
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
    previewUrlRef.current = url;
    currentTakeIdRef.current = takeId;
    setPreviewFile(file);
    setPreviewUrl(url);
    setPhase("preview");
  };

  const finalizeRecording = (blobType: string) => {
    captureStopRef.current?.();
    captureStopRef.current = null;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (livePreviewRef.current) livePreviewRef.current.srcObject = null;
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const blob = new Blob(chunksRef.current, { type: blobType || "video/webm" });
    chunksRef.current = [];
    if (blob.size < 1024) {
      setError("The recording is empty. Share the Google Meet Chrome tab and try again.");
      setPhase("idle");
      return;
    }

    const title = liveClass?.title || "live-class";
    const file = new File([blob], recordingFilename(title), {
      type: blob.type || "video/webm",
    });
    showPreview(file, null);

    void (async () => {
      try {
        const meta = await saveLiveTake({
          liveClassId,
          title,
          blob,
          durationSeconds: Math.floor((Date.now() - startedAtRef.current) / 1000),
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
  };

  const startRecording = async () => {
    setError("");
    setWarning("");
    setSavedMessage("");
    setSavedKey("");
    let capture: Awaited<ReturnType<typeof captureMeetTab>>;
    try {
      capture = await captureMeetTab();
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError") {
        setError(
          "Permission denied. Click Start recording again, pick the Google Meet Chrome tab, and enable “Also share tab audio”."
        );
      } else {
        setError(err instanceof Error ? err.message : "Could not start screen capture.");
      }
      return;
    }

    const { stream, stop, hasTabAudio, hasMicAudio } = capture;
    const videoTrack = stream.getVideoTracks()[0];
    const surface = videoTrack?.getSettings().displaySurface;

    if (surface === "monitor") {
      stop();
      setError(
        "You shared the whole screen. Click Start recording and pick the Google Meet Chrome tab instead."
      );
      return;
    }

    if (!hasTabAudio && !hasMicAudio) {
      stop();
      setError(
        "No audio was captured. Pick Chrome Tab → Google Meet, turn on “Also share tab audio”, and allow the microphone when asked."
      );
      return;
    }

    if (!hasTabAudio) {
      setWarning(
        "Meet tab audio was not shared, so only your microphone is in this recording. Stop and share the Google Meet Chrome tab with “Also share tab audio” to include students."
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
      recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128_000,
      });
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
      setError("The recorder stopped unexpectedly. Try again.");
      captureStopRef.current?.();
      captureStopRef.current = null;
      stopMediaStream(streamRef.current);
      streamRef.current = null;
      setPhase("idle");
    };
    recorder.onstop = () => finalizeRecording(recorder.mimeType || mimeType);

    if (videoTrack) {
      videoTrack.addEventListener("ended", () => {
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      });
    }

    recorder.start(1000);
    startedAtRef.current = Date.now();
    setElapsed(0);
    timerRef.current = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 250);
    setPhase("recording");
    focusMeetPopup(liveClassId);
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
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
        body: wrapApiForm({ liveClassId: liveClass.id, recordingUrl: session.objectKey }),
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
      setSavedMessage("Recording saved. Students can watch it in the course.");
      setSavedKey(session.objectKey);
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

  const playbackUrl = savedKey || liveClass.recordingUrl;

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
            <Button type="button" onClick={openMeet} disabled={!liveClass.meetingLink || busy}>
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
          <ol className="list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
            <li>Open Google Meet (it opens as a browser tab).</li>
            <li>
              Click Start recording. In Chrome pick <strong>Chrome Tab</strong> → the{" "}
              <strong>Google Meet</strong> tab (not this LMS page).
            </li>
            <li>
              Turn on <strong>Also share tab audio</strong>, then Share. Allow the microphone
              when asked (your voice is mixed in).
            </li>
            <li>Stop → preview → upload. A copy stays in History for 7 days until you upload or delete it.</li>
          </ol>

          {phase === "recording" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2 font-semibold text-red-500">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                  Recording
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

          {phase === "preview" && previewUrl && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Preview</p>
              <video
                className="aspect-video w-full rounded-md bg-black"
                src={previewUrl}
                controls
                playsInline
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

          {(savedMessage || playbackUrl) && phase === "idle" && (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              {savedMessage || "A recording is already saved. Uploading again replaces the student playback link."}
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
                  <Circle className="mr-2 h-4 w-4 fill-red-500 text-red-500" /> Start recording
                </Button>
                {playbackUrl && (
                  <Button type="button" variant="outline" onClick={() => setWatchOpen(true)}>
                    <Play className="mr-2 h-4 w-4" /> Watch recording
                  </Button>
                )}
              </>
            )}
            {phase === "recording" && (
              <Button type="button" variant="destructive" onClick={stopRecording}>
                <Square className="mr-2 h-4 w-4" /> Stop
              </Button>
            )}
            {phase === "preview" && (
              <>
                <Button type="button" variant="outline" onClick={discardPreview}>
                  Discard
                </Button>
                <Button type="button" onClick={() => void uploadRecording()}>
                  <UploadCloud className="mr-2 h-4 w-4" /> Upload
                </Button>
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
        videoUrl={playbackUrl ?? ""}
        title={liveClass.title}
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
