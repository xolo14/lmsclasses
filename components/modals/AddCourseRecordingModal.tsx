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
import type { CourseRecording } from "@/lib/db/schema";
import { z } from "zod";

type FormValues = z.infer<typeof courseRecordingSchema>;

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
      setPreviewUrl(existingRecording.videoUrl);
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
      setPreviewUrl("");
    }
  }, [existingRecording, courseId, nextSortOrder, form, isOpen]);

  const videoUrl = form.watch("videoUrl");

  useEffect(() => {
    const url = videoUrl || "";
    setPreviewUrl(url);
    setPreviewEmbed(url ? resolveVideoEmbed(url) : null);
  }, [videoUrl]);

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    setError(undefined);
    try {
      const url = existingRecording
        ? `/api/super-admin/recordings/${existingRecording.id}`
        : "/api/super-admin/recordings";
      const res = await fetch(url, {
        method: existingRecording ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save recording");
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existingRecording ? "Edit Recording" : "Add Recording"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...form.register("title")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="videoUrl">Video URL</Label>
            <Input id="videoUrl" {...form.register("videoUrl")} placeholder="https://..." />
            {previewUrl && (
              <div className="aspect-video overflow-hidden rounded-lg border bg-black">
                <EmbeddedVideoPlayer
                  embed={previewEmbed}
                  videoUrl={previewUrl}
                  title="Recording preview"
                />
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
              checked={form.watch("isPublished")}
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
