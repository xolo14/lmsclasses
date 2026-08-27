"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { EmbeddedVideoPlayer } from "@/components/ui/embedded-video-player";
import { courseRecordingSchema } from "@/lib/validations/course-recording";
import { resolveVideoEmbed, type ResolvedVideoEmbed } from "@/lib/video-embed";
import {
  PlayableVideoError,
  resolvePlayableVideoUrl,
} from "@/lib/resolve-playable-video-url";
import { encodeUrlForApiTransport } from "@/lib/api-url-transport";
import type { CourseRecording } from "@/lib/db/schema";
import { z } from "zod";

type FormValues = z.input<typeof courseRecordingSchema>;

interface AddCourseRecordingModalProps {
  courseId: string;
  existingRecording?: CourseRecording;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  nextSortOrder?: number;
}

export function AddCourseRecordingModal({
  courseId,
  existingRecording,
  isOpen,
  onClose,
  onSuccess,
  nextSortOrder = 0,
}: AddCourseRecordingModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewEmbed, setPreviewEmbed] = useState<ResolvedVideoEmbed | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(courseRecordingSchema),
    defaultValues: {
      courseId,
      title: "",
      videoUrl: "",
      description: "",
      duration: undefined,
      sortOrder: nextSortOrder,
      isPublished: false,
    },
  });

  useEffect(() => {
    if (existingRecording) {
      form.reset({
        courseId,
        title: existingRecording.title,
        videoUrl: existingRecording.videoUrl,
        description: existingRecording.description ?? "",
        duration: existingRecording.duration ?? undefined,
        sortOrder: existingRecording.sortOrder,
        isPublished: existingRecording.isPublished,
      });
    } else {
      form.reset({
        courseId,
        title: "",
        videoUrl: "",
        description: "",
        duration: undefined,
        sortOrder: nextSortOrder,
        isPublished: false,
      });
    }
  }, [existingRecording, courseId, nextSortOrder, form, isOpen]);

  const videoUrl = form.watch("videoUrl");

  useEffect(() => {
    const raw = (videoUrl || "").trim();
    if (!raw) {
      setPreviewUrl("");
      setPreviewEmbed(null);
      setPreviewLoading(false);
      setPreviewError(false);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(false);
    setPreviewUrl("");
    setPreviewEmbed(null);

    const timer = window.setTimeout(async () => {
      try {
        const playable = await resolvePlayableVideoUrl(raw);
        if (cancelled) return;
        setPreviewUrl(playable);
        setPreviewEmbed(resolveVideoEmbed(playable));
      } catch (err) {
        if (!cancelled) {
          setPreviewError(true);
          if (err instanceof PlayableVideoError && err.status >= 500) {
            // Keep previewError; save can still succeed once GCP is configured.
          }
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [videoUrl]);

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    setError(undefined);
    try {
      const parsed = courseRecordingSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid recording data");
      }
      const url = existingRecording
        ? `/api/super-admin/recordings/${existingRecording.id}`
        : "/api/super-admin/recordings";
      // Prefer POST for updates — Hostinger/WAF often returns plain-text 403 on PATCH.
      // Encode video URL so remote http(s) signatures in the body are not blocked.
      const payload = {
        ...parsed.data,
        videoUrl: encodeUrlForApiTransport(parsed.data.videoUrl),
      };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
                ? "Save blocked (403 Forbidden) by the host firewall. Retry after deploy, or whitelist /api/super-admin/recordings in Hostinger WAF."
                : `Save failed (${res.status}): ${raw.slice(0, 120)}`
            );
          }
          throw new Error("Invalid server response");
        }
      }
      if (!res.ok) {
        const msg =
          typeof json.error === "string"
            ? json.error
            : "Failed to save recording";
        throw new Error(msg);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const videoFieldError = form.formState.errors.videoUrl?.message;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[min(90dvh,90vh)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existingRecording ? "Edit Recording" : "Add Recording"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...form.register("title")} />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="videoUrl">Video path (GCS key)</Label>
            <Input
              id="videoUrl"
              {...form.register("videoUrl")}
              placeholder="aiml/video1.mp4"
            />
            <p className="text-xs text-muted-foreground">
              Paste the object key only — e.g. <code>aiml/video1.mp4</code>. Not a Console or signed URL.
              YouTube/Vimeo links also work.
            </p>
            {videoFieldError && (
              <p className="text-sm text-destructive">{String(videoFieldError)}</p>
            )}
            {(previewLoading || previewUrl || previewError) && (
              <div className="aspect-video overflow-hidden rounded-lg border bg-black">
                {previewLoading ? (
                  <div className="flex h-full items-center justify-center text-sm text-white/80">
                    Loading preview…
                  </div>
                ) : previewError ? (
                  <div className="flex h-full items-center justify-center p-4 text-center text-sm text-white/80">
                    Preview unavailable. You can still save if the key is correct and GCS env vars are set on the server.
                  </div>
                ) : (
                  <EmbeddedVideoPlayer
                    embed={previewEmbed}
                    videoUrl={previewUrl}
                    title="Recording preview"
                  />
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...form.register("description")} rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input id="duration" type="number" {...form.register("duration")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortOrder">Sort Order</Label>
              <Input id="sortOrder" type="number" {...form.register("sortOrder")} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form.watch("isPublished")}
              onChange={(e) => form.setValue("isPublished", e.target.checked)}
            />
            Publish immediately
          </label>
          <p className="text-xs text-muted-foreground">
            Unpublished recordings are invisible to students.
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              "Save Recording"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
