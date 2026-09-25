"use client";

import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { classRecordingSchema, type ClassRecordingInput } from "@/lib/validations";
import { wrapApiForm } from "@/lib/api-url-transport";
import {
  ACCEPTED_VIDEO_INPUT,
  MAX_VIDEO_UPLOAD_LABEL,
  formatFileSize,
  getVideoSizeError,
} from "@/lib/video-upload";
import {
  startResumableVideoUpload,
  uploadFileToResumableSession,
} from "@/lib/video-upload-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadCloud, Film, CheckCircle2, AlertCircle, Link as LinkIcon, X } from "lucide-react";

export type ClassRecordingEditRow = {
  id: string;
  weekName: string;
  topicName: string;
  videoUrl: string;
};

interface AddClassRecordingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  batchId: string;
  recording?: ClassRecordingEditRow | null;
}

export function AddClassRecordingModal({
  open,
  onOpenChange,
  courseId,
  batchId,
  recording = null,
}: AddClassRecordingModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEdit = !!recording;
  const [uploadMode, setUploadMode] = useState<"file" | "url">(recording ? "url" : "file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ClassRecordingInput>({
    resolver: zodResolver(classRecordingSchema),
    defaultValues: {
      courseId,
      batchId,
      weekName: recording?.weekName ?? "",
      topicName: recording?.topicName ?? "",
      videoUrl: recording?.videoUrl ?? "",
    },
  });

  const handleResetModal = () => {
    reset({
      courseId,
      batchId,
      weekName: recording?.weekName ?? "",
      topicName: recording?.topicName ?? "",
      videoUrl: recording?.videoUrl ?? "",
    });
    setSelectedFile(null);
    setUploadProgress(0);
    setUploadStatus("");
    setError("");
    setIsUploading(false);
    setUploadMode(recording ? "url" : "file");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    if (!open) return;
    reset({
      courseId,
      batchId,
      weekName: recording?.weekName ?? "",
      topicName: recording?.topicName ?? "",
      videoUrl: recording?.videoUrl ?? "",
    });
    setSelectedFile(null);
    setUploadProgress(0);
    setUploadStatus("");
    setError("");
    setIsUploading(false);
    setUploadMode(recording ? "url" : "file");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [open, recording, courseId, batchId, reset]);

  const uploadFileToGcs = async (file: File): Promise<string> => {
    setUploadStatus("Starting upload session...");
    setUploadProgress(2);

    // Step 1: server opens a GCS resumable session (enforces the 5 GB cap and IAM).
    const session = await startResumableVideoUpload({ batchId, file });
    setUploadStatus(`Uploading to folder: ${session.folderName}...`);
    setUploadProgress(5);

    // Step 2: browser streams the bytes to GCS in retryable chunks; nothing goes through Next.js.
    const totalLabel = formatFileSize(file.size);
    try {
      await uploadFileToResumableSession(file, session, {
        onProgress: (uploaded) => {
          const percent = 5 + Math.round((uploaded / file.size) * 90);
          setUploadProgress(Math.min(95, Math.max(5, percent)));
          setUploadStatus(`Uploading ${formatFileSize(uploaded)} of ${totalLabel}...`);
        },
      });
    } catch (uploadErr) {
      console.error("[GCS resumable upload failed]", uploadErr);
      throw uploadErr instanceof Error ? uploadErr : new Error("Upload to storage failed.");
    }

    setUploadProgress(95);
    return session.objectKey;
  };

  const saveRecordingMutation = useMutation({
    mutationFn: async (data: ClassRecordingInput) => {
      setIsUploading(true);
      setError("");

      let finalVideoUrl = data.videoUrl;

      if (uploadMode === "file") {
        if (selectedFile) {
          finalVideoUrl = await uploadFileToGcs(selectedFile);
        } else if (isEdit && recording?.videoUrl) {
          finalVideoUrl = recording.videoUrl;
        } else {
          throw new Error("Please select a video file to upload.");
        }
      }

      if (!finalVideoUrl || !finalVideoUrl.trim()) {
        throw new Error("A valid video path or URL is required.");
      }

      setUploadStatus("Finalizing class recording...");
      setUploadProgress(98);

      const parsed = classRecordingSchema.safeParse({
        ...data,
        courseId,
        batchId,
        videoUrl: finalVideoUrl,
      });

      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid recording data");
      }

      const res = await fetch(isEdit ? `/api/media/${recording.id}` : "/api/media/save", {
        method: isEdit ? "PATCH" : "POST",
        body: wrapApiForm(parsed.data),
        credentials: "same-origin",
      });

      const raw = await res.text();
      let json: { error?: unknown } = {};
      if (raw) {
        try {
          json = JSON.parse(raw) as { error?: unknown };
        } catch {
          if (!res.ok) {
            throw new Error(
              res.status === 403
                ? "Save blocked by the host firewall. Retry after this update, or use a simpler week/topic name."
                : `Failed to save class recording (${res.status})`
            );
          }
        }
      }

      if (!res.ok) {
        const message =
          typeof json.error === "string" && json.error
            ? json.error
            : res.status === 403
              ? "Save blocked by the host firewall. Retry after this update."
              : "Failed to save class recording";
        throw new Error(message);
      }

      setUploadProgress(100);
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-recordings", batchId] });
      handleResetModal();
      onOpenChange(false);
    },
    onError: (err: any) => {
      setError(err?.message || "Upload failed. Please try again.");
      setIsUploading(false);
    },
  });

  const onSubmit = (formData: ClassRecordingInput) => {
    saveRecordingMutation.mutate(formData);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeError = getVideoSizeError(file.size);
    if (sizeError) {
      setSelectedFile(null);
      setValue("videoUrl", "");
      setError(sizeError);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
    setValue("videoUrl", file.name, { shouldValidate: true });
    setError("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!isUploading) {
          if (!v) handleResetModal();
          onOpenChange(v);
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Recorded Class" : "Upload Recorded Class"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update week, topic, or replace the current video. The existing URL is filled in below."
              : "Upload a video file or paste a GCS key / video URL for this batch."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Week Name *</Label>
            <Input
              {...register("weekName")}
              placeholder="e.g. Week 1"
              disabled={isUploading}
            />
            {errors.weekName && (
              <p className="text-sm text-destructive">{errors.weekName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Topic Name *</Label>
            <Input
              {...register("topicName")}
              placeholder="e.g. Introduction to React and State"
              disabled={isUploading}
            />
            {errors.topicName && (
              <p className="text-sm text-destructive">{errors.topicName.message}</p>
            )}
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center justify-between border-b pb-2 pt-1">
            <Label className="text-sm font-semibold">Video Source</Label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isUploading}
                onClick={() => setUploadMode("file")}
                className={`text-xs px-2.5 py-1 rounded transition-colors ${
                  uploadMode === "file"
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Direct File Upload
              </button>
              <button
                type="button"
                disabled={isUploading}
                onClick={() => setUploadMode("url")}
                className={`text-xs px-2.5 py-1 rounded transition-colors ${
                  uploadMode === "url"
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Paste URL / Key
              </button>
            </div>
          </div>

          {uploadMode === "file" ? (
            <div className="space-y-2">
              <Label>Video File *</Label>
              <input
                type="file"
                ref={fileInputRef}
                accept={ACCEPTED_VIDEO_INPUT}
                className="hidden"
                onChange={handleFileChange}
                disabled={isUploading}
              />

              {!selectedFile ? (
                <div
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  className="border-2 border-dashed border-muted-foreground/30 hover:border-primary/60 rounded-lg p-6 text-center cursor-pointer transition-colors bg-muted/20 hover:bg-muted/40"
                >
                  <UploadCloud className="h-10 w-10 text-primary mx-auto mb-2" />
                  <p className="text-sm font-medium">Click to select video file</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Directly uploads into the <strong>lmsclasses</strong> bucket under this batch's folder
                  </p>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                    Supports MP4, WebM, MOV, MKV · up to {MAX_VIDEO_UPLOAD_LABEL}
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/40">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Film className="h-5 w-5 text-primary" />
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  </div>
                  {!isUploading && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedFile(null);
                        setValue("videoUrl", "");
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Video Path or External URL *</Label>
              <Input
                {...register("videoUrl")}
                placeholder="batch-folder/video.mp4 or YouTube / Vimeo URL"
                disabled={isUploading}
              />
              {errors.videoUrl && (
                <p className="text-sm text-destructive">{errors.videoUrl.message}</p>
              )}
              {isEdit && recording?.videoUrl ? (
                <p className="text-xs text-muted-foreground break-all">
                  Current URL: {recording.videoUrl}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Paste an existing GCS object key or a video URL.
              </p>
            </div>
          )}

          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-primary">{uploadStatus}</span>
                <span className="font-bold">{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isUploading ||
                (uploadMode === "file" && !selectedFile && !recording?.videoUrl)
              }
            >
              {isUploading ? "Saving..." : isEdit ? "Save Changes" : "Upload Recording"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
