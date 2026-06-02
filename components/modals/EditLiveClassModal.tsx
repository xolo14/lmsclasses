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

type LiveClass = {
  id: string;
  title: string;
  courseId: string;
  batchId?: string | null;
  mentorId: string;
  meetingLink?: string | null;
  scheduledAt: string;
  duration?: number | null;
  status?: string;
  recordingUrl?: string | null;
};

function toDateTimeLocal(value: string) {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditLiveClassModal({
  open,
  onOpenChange,
  liveClass,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  liveClass?: LiveClass;
}) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<LiveClassInput>({
    resolver: zodResolver(liveClassSchema),
  });

  const courseId = watch("courseId");

  const { data: batches = [] } = useQuery({
    queryKey: ["batches", courseId],
    queryFn: () => fetch(`/api/batches?courseId=${courseId}`).then((r) => r.json()),
    enabled: open && !!courseId,
  });

  const { data: mentors = [] } = useQuery({
    queryKey: ["mentors"],
    queryFn: () => fetch("/api/mentors").then((r) => r.json()),
    enabled: open,
  });

  useEffect(() => {
    if (liveClass) {
      reset({
        title: liveClass.title,
        courseId: liveClass.courseId,
        batchId: liveClass.batchId || undefined,
        mentorId: liveClass.mentorId,
        meetingLink: liveClass.meetingLink || "",
        scheduledAt: toDateTimeLocal(liveClass.scheduledAt),
        duration: liveClass.duration ?? undefined,
        status: (liveClass.status as LiveClassInput["status"]) || "scheduled",
        recordingUrl: liveClass.recordingUrl || "",
      });
    }
  }, [liveClass, reset]);

  const mutation = useMutation({
    mutationFn: async (data: LiveClassInput) => {
      const res = await fetch(`/api/live-classes/${liveClass!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update live class");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-classes"] });
      onOpenChange(false);
    },
  });

  if (!liveClass) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Live Class</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input {...register("title")} />
          </div>
          <div className="space-y-2">
            <Label>Batch</Label>
            <Select onValueChange={(v) => setValue("batchId", v)} value={watch("batchId") || ""}>
              <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
              <SelectContent>
                {batches.map((b: { id: string; name: string }) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mentor</Label>
            <Select onValueChange={(v) => setValue("mentorId", v)} value={watch("mentorId")}>
              <SelectTrigger><SelectValue placeholder="Select mentor" /></SelectTrigger>
              <SelectContent>
                {mentors.map((m: { id: string; name: string }) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select onValueChange={(v) => setValue("status", v as LiveClassInput["status"])} value={watch("status")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Meeting Link</Label>
            <Input {...register("meetingLink")} />
          </div>
          <div className="space-y-2">
            <Label>Recording URL</Label>
            <Input {...register("recordingUrl")} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label>Scheduled At</Label>
            <Input type="datetime-local" {...register("scheduledAt")} />
          </div>
          <div className="space-y-2">
            <Label>Duration (minutes)</Label>
            <Input type="number" {...register("duration")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
