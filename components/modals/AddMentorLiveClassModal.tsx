"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { liveClassSchema, type LiveClassInput } from "@/lib/validations";
import { wrapApiForm } from "@/lib/api-url-transport";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookOpen, UserCheck } from "lucide-react";

interface AddMentorLiveClassModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mentorId: string;
  mentorName: string;
  courseId?: string;
  courseTitle?: string;
  courses?: { id: string; title: string }[];
}

type BatchOption = {
  id: string;
  name: string;
};

export function AddMentorLiveClassModal({
  open,
  onOpenChange,
  mentorId,
  mentorName,
  courseId,
  courseTitle,
  courses = [],
}: AddMentorLiveClassModalProps) {
  const queryClient = useQueryClient();
  const courseOptions = courses.length
    ? courses
    : courseId
      ? [{ id: courseId, title: courseTitle || "Assigned course" }]
      : [];
  const defaultCourseId = courseOptions[0]?.id || courseId || "";

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LiveClassInput>({
    resolver: zodResolver(liveClassSchema),
    defaultValues: {
      courseId: defaultCourseId,
      mentorId,
      title: "",
      meetingLink: "",
      scheduledAt: "",
      duration: 60,
    },
  });

  const selectedBatchId = watch("batchId");
  const selectedCourseId = watch("courseId") || defaultCourseId;

  const { data: batches = [] } = useQuery<BatchOption[]>({
    queryKey: ["batches", selectedCourseId],
    queryFn: () => fetch(`/api/batches?courseId=${selectedCourseId}`).then((r) => r.json()),
    enabled: open && !!selectedCourseId,
  });

  useEffect(() => {
    if (open) {
      reset({
        courseId: defaultCourseId,
        mentorId,
        batchId: undefined,
        title: "",
        meetingLink: "",
        scheduledAt: "",
        duration: 60,
      });
    }
  }, [open, defaultCourseId, mentorId, reset]);

  const mutation = useMutation({
    mutationFn: async (data: LiveClassInput) => {
      const res = await fetch("/api/live-classes", {
        method: "POST",
        body: wrapApiForm({
          ...data,
          courseId: data.courseId || selectedCourseId,
          mentorId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to schedule live class");
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-classes"] });
      queryClient.invalidateQueries({ queryKey: ["live-classes", "mentor", "active"] });
      reset();
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Live Class</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-2">
            <Label className={courseOptions.length > 1 ? undefined : "text-muted-foreground"}>
              {courseOptions.length > 1 ? "Course *" : "Course (Auto-Selected)"}
            </Label>
            {courseOptions.length > 1 ? (
              <Select
                value={selectedCourseId}
                onValueChange={(val) => {
                  setValue("courseId", val, { shouldValidate: true });
                  setValue("batchId", undefined);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  {courseOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-muted/50 text-sm font-medium">
                <BookOpen className="h-4 w-4 text-primary" />
                <span>{courseOptions[0]?.title || courseTitle}</span>
              </div>
            )}
          </div>

          {/* Auto-selected Mentor */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">Mentor (Auto-Selected)</Label>
            <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-muted/50 text-sm font-medium">
              <UserCheck className="h-4 w-4 text-primary" />
              <span>{mentorName}</span>
            </div>
          </div>

          {/* Batch Selector */}
          <div className="space-y-2">
            <Label>Select Batch *</Label>
            <Select
              value={selectedBatchId || "none"}
              onValueChange={(val) =>
                setValue("batchId", val === "none" ? undefined : val, { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select target batch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Select Batch --</SelectItem>
                {batches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.batchId && (
              <p className="text-sm text-destructive">{errors.batchId.message}</p>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label>Class Title / Topic *</Label>
            <Input
              {...register("title")}
              placeholder="e.g. Introduction to React & State"
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Scheduled At */}
          <div className="space-y-2">
            <Label>Scheduled Date & Time (IST) *</Label>
            <Input type="datetime-local" {...register("scheduledAt")} />
            {errors.scheduledAt && (
              <p className="text-sm text-destructive">{errors.scheduledAt.message}</p>
            )}
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Duration (minutes)</Label>
            <Input
              type="number"
              min={15}
              max={300}
              {...register("duration", { valueAsNumber: true })}
            />
            {errors.duration && (
              <p className="text-sm text-destructive">{errors.duration.message}</p>
            )}
          </div>

          {/* Meeting Link */}
          <div className="space-y-2">
            <Label>Meeting Link</Label>
            <Input
              type="url"
              placeholder="https://meet.google.com/... or Zoom link"
              {...register("meetingLink")}
            />
            {errors.meetingLink && (
              <p className="text-sm text-destructive">{errors.meetingLink.message}</p>
            )}
          </div>

          {mutation.isError && (
            <p className="text-sm text-destructive">
              {(mutation.error as Error)?.message || "Failed to schedule class"}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Scheduling..." : "Schedule Class"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
