"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { liveClassSchema, type LiveClassInput } from "@/lib/validations";
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
  courseId: string;
  courseTitle: string;
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
}: AddMentorLiveClassModalProps) {
  const queryClient = useQueryClient();

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
      courseId,
      mentorId,
      title: "",
      meetingLink: "",
      scheduledAt: "",
      duration: 60,
    },
  });

  const selectedBatchId = watch("batchId");

  const { data: batches = [] } = useQuery<BatchOption[]>({
    queryKey: ["batches", courseId],
    queryFn: () => fetch(`/api/batches?courseId=${courseId}`).then((r) => r.json()),
    enabled: open && !!courseId,
  });

  useEffect(() => {
    if (open) {
      reset({
        courseId,
        mentorId,
        batchId: undefined,
        title: "",
        meetingLink: "",
        scheduledAt: "",
        duration: 60,
      });
    }
  }, [open, courseId, mentorId, reset]);

  const mutation = useMutation({
    mutationFn: async (data: LiveClassInput) => {
      const res = await fetch("/api/live-classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          courseId,
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
          {/* Auto-selected Course */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">Course (Auto-Selected)</Label>
            <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-muted/50 text-sm font-medium">
              <BookOpen className="h-4 w-4 text-primary" />
              <span>{courseTitle}</span>
            </div>
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
            <Label>Scheduled Date & Time *</Label>
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
