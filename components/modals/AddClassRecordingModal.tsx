"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { classRecordingSchema, type ClassRecordingInput } from "@/lib/validations";
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

export function AddClassRecordingModal({
  open,
  onOpenChange,
  courseId,
  batchId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  batchId: string;
}) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ClassRecordingInput>({
    resolver: zodResolver(classRecordingSchema),
    defaultValues: { courseId, batchId },
  });

  const mutation = useMutation({
    mutationFn: async (data: ClassRecordingInput) => {
      const res = await fetch("/api/class-recordings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, courseId, batchId }),
      });
      if (!res.ok) throw new Error("Failed to upload recording");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-recordings", batchId] });
      reset({ courseId, batchId, weekName: "", topicName: "", videoUrl: "" });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Recorded Class</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-2">
            <Label>Week Name</Label>
            <Input {...register("weekName")} placeholder="Week 1" />
            {errors.weekName && <p className="text-sm text-destructive">{errors.weekName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Topic Name</Label>
            <Input {...register("topicName")} placeholder="Introduction to React" />
            {errors.topicName && <p className="text-sm text-destructive">{errors.topicName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Video URL</Label>
            <Input {...register("videoUrl")} placeholder="https://youtube.com/... or storage URL" />
            {errors.videoUrl && <p className="text-sm text-destructive">{errors.videoUrl.message}</p>}
          </div>
          <p className="text-xs text-muted-foreground">
            Paste a link to your recorded video (YouTube, Vimeo, Google Drive, S3, etc.).
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
