"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { classRecordingSchema, type ClassRecordingInput } from "@/lib/validations";
import { encodeUrlForApiTransport } from "@/lib/api-url-transport";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadCloud, Film, CheckCircle2, AlertCircle, Link as LinkIcon, X } from "lucide-react";

interface AddClassRecordingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  batchId: string;
}

export function AddClassRecordingModal({
  open,
  onOpenChange,
  courseId,
  batchId,
}: AddClassRecordingModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
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
    defaultValues: { courseId, batchId, videoUrl: "" },
  });

  const handleResetModal = () => {
    reset({ courseId, batchId, weekName: "", topicName: "", videoUrl: "" });
    setSelectedFile(null);
    setUploadProgress(0);
    setUploadStatus("");
    setError("");
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadFileToGcs = async (file: File): Promise<string> => {
    setUploadStatus("Requesting upload URL...");
    setUploadProgress(5);

    // Step 1: Request signed upload URL with batch folder organization
    const res = await fetch("/api/uploads/video-signed-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batchId,
        filename: file.name,
        contentType: file.type || "video/mp4",
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to generate storage upload URL");
    }

    const { signedUrl, objectKey, folderName } = await res.json();
    setUploadStatus(`Uploading to folder: ${folderName}...`);

    // Step 2: Upload directly to GCS bucket via XMLHttpRequest to monitor progress
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", signedUrl, true);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 90);
            setUploadProgress(Math.max(10, percent));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(95);
            resolve();
          } else {
            reject(new Error(`Direct storage upload returned status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Direct bucket upload network error"));
        xhr.send(file);
      });

      return objectKey;
    } catch (directUploadErr) {
      // Fallback: If browser direct PUT fails (e.g. CORS), upload through server fallback
      console.warn("[GCS Direct Upload failed, using server fallback]", directUploadErr);
      setUploadStatus("Using server upload fallback...");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("batchId", batchId);

      const fallbackRes = await fetch("/api/uploads/video", {
        method: "POST",
        body: formData,
      });

      if (!fallbackRes.ok) {
        const errJson = await fallbackRes.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to upload video to storage");
      }

      const fallbackData = await fallbackRes.json();
      return fallbackData.objectKey;
    }
  };

  const saveRecordingMutation = useMutation({
    mutationFn: async (data: ClassRecordingInput) => {
      setIsUploading(true);
      setError("");

      let finalVideoUrl = data.videoUrl;

      if (uploadMode === "file") {
        if (!selectedFile) {
          throw new Error("Please select a video file to upload.");
        }
        finalVideoUrl = await uploadFileToGcs(selectedFile);
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

      const res = await fetch("/api/class-recordings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...parsed.data,
          videoUrl: encodeUrlForApiTransport(parsed.data.videoUrl),
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to save class recording");
      }

      setUploadProgress(100);
      return res.json();
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
    if (file) {
      setSelectedFile(file);
      setValue("videoUrl", file.name, { shouldValidate: true });
      setError("");
    }
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
          <DialogTitle>Upload Recorded Class</DialogTitle>
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
                accept="video/*,.mp4,.mov,.mkv,.webm,.avi"
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
                    Supports MP4, WebM, MOV, MKV
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
                        {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
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
              disabled={isUploading || (uploadMode === "file" && !selectedFile)}
            >
              {isUploading ? "Uploading..." : "Upload Recording"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
