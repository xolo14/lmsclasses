"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";
import {
  courseSchema,
  recordCourseSchema,
  type CourseInput,
  type RecordCourseInput,
} from "@/lib/validations";
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

type CourseRow = {
  id: string;
  title: string;
  description?: string | null;
  price: string;
  demoUrl?: string | null;
  thumbnailUrl?: string | null;
  duration?: string | null;
};

interface AddCourseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "live" | "record";
  course?: CourseRow;
}

export function AddCourseModal({ open, onOpenChange, type, course }: AddCourseModalProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isRecord = type === "record";

  const liveFormValues = useMemo<CourseInput>(
    () =>
      course
        ? {
            title: course.title,
            description: course.description ?? "",
            price: Number(course.price),
            demoUrl: course.demoUrl ?? "",
            duration: course.duration ?? "",
            courseType: type,
          }
        : {
            title: "",
            description: "",
            price: 0,
            demoUrl: "",
            duration: "",
            courseType: type,
          },
    [course, type]
  );

  const recordFormValues = useMemo<RecordCourseInput>(
    () =>
      course
        ? {
            title: course.title,
            description: course.description ?? "",
            price: Number(course.price),
            demoUrl: course.demoUrl ?? "",
            thumbnailUrl: course.thumbnailUrl ?? "",
            duration: course.duration ?? "",
            courseType: "record",
          }
        : {
            title: "",
            description: "",
            price: 0,
            demoUrl: "",
            thumbnailUrl: "",
            duration: "",
            courseType: "record",
          },
    [course]
  );

  const liveForm = useForm<CourseInput>({
    resolver: zodResolver(courseSchema),
    values: liveFormValues,
  });

  const recordForm = useForm<RecordCourseInput>({
    resolver: zodResolver(recordCourseSchema),
    values: recordFormValues,
  });

  const register = (isRecord ? recordForm.register : liveForm.register) as typeof liveForm.register;
  const reset = isRecord ? recordForm.reset : liveForm.reset;
  const errors = isRecord ? recordForm.formState.errors : liveForm.formState.errors;

  const thumbnailUrl = isRecord ? recordForm.watch("thumbnailUrl") : "";

  useEffect(() => {
    if (open) {
      reset(isRecord ? recordFormValues : liveFormValues);
      setError("");
    }
  }, [open, isRecord, liveFormValues, recordFormValues, reset]);

  const handleThumbnailUpload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads/course-thumbnail", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "Upload failed");
      }
      recordForm.setValue("thumbnailUrl", json.url, { shouldValidate: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const mutation = useMutation({
    mutationFn: async (data: CourseInput | RecordCourseInput) => {
      const url = course ? `/api/${type}-courses/${course.id}` : `/api/${type}-courses`;
      const res = await fetch(url, {
        method: course ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "Failed to save course");
      }
      return json;
    },
    onSuccess: () => {
      const targetKey = type === "live" ? "live-courses" : "record-courses";
      queryClient.invalidateQueries({ queryKey: [targetKey] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["demos-courses"] });
      if (!course) {
        reset(
          isRecord
            ? {
                title: "",
                description: "",
                price: 0,
                demoUrl: "",
                thumbnailUrl: "",
                duration: "",
                courseType: "record",
              }
            : { title: "", description: "", price: 0, demoUrl: "", duration: "", courseType: type }
        );
      }
      onOpenChange(false);
    },
    onError: (err: Error) => setError(err.message || "Failed to save course"),
  });

  const onSubmit = (data: CourseInput | RecordCourseInput) => mutation.mutate(data);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{course ? "Edit Course" : `Add ${type === "live" ? "Live" : "Record"} Course`}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={
            isRecord
              ? recordForm.handleSubmit(onSubmit)
              : liveForm.handleSubmit(onSubmit)
          }
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Title</Label>
            <Input {...register("title")} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input {...register("description")} />
          </div>
          <div className="space-y-2">
            <Label>Price (₹)</Label>
            <Input type="number" {...register("price")} />
            {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Duration (e.g. 12 weeks, 40 hours)</Label>
            <Input {...register("duration")} placeholder="12 weeks" />
            {errors.duration && <p className="text-sm text-destructive">{errors.duration.message}</p>}
          </div>

          {isRecord && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div>
                <Label>Course Image</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Shown on the landing page and course listing cards.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="thumbnail-url" className="text-xs text-muted-foreground">
                  Image URL
                </Label>
                <Input
                  id="thumbnail-url"
                  placeholder="https://... or /uploads/course-thumbnails/..."
                  {...recordForm.register("thumbnailUrl")}
                />
                {isRecord && recordForm.formState.errors.thumbnailUrl && (
                  <p className="text-sm text-destructive">
                    {String(recordForm.formState.errors.thumbnailUrl.message)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">or</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleThumbnailUpload(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Upload image
                </Button>
              </div>
              {thumbnailUrl ? (
                <div className="aspect-video overflow-hidden rounded-md border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbnailUrl} alt="Course thumbnail preview" className="h-full w-full object-cover" />
                </div>
              ) : null}
            </div>
          )}

          <div className="space-y-2">
            <Label>{isRecord ? "Demo Video URL" : "Demo URL"}</Label>
            {isRecord && (
              <p className="text-xs text-muted-foreground">
                Shown only on the course detail page (not on listing cards).
              </p>
            )}
            <Input {...register("demoUrl")} placeholder="https://youtube.com/... or video URL" />
            {errors.demoUrl && <p className="text-sm text-destructive">{errors.demoUrl.message}</p>}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || uploading}>
              {mutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
