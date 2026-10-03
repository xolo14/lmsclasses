"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { liveClassSchema, type LiveClassInput } from "@/lib/validations";
import { wrapApiForm } from "@/lib/api-url-transport";
import { MeetModeSelector, type MeetModeValue } from "@/components/live-classes/MeetModeSelector";
import { DEFAULT_MEET_VALUE, isValidManualLink, MANUAL_LINK_ERROR, meetFieldsForSubmit } from "@/lib/live-class-meet-form";
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

interface AddLiveClassModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddLiveClassModal({ open, onOpenChange }: AddLiveClassModalProps) {
  const queryClient = useQueryClient();

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: () => fetch("/api/live-courses").then((r) => r.json()),
    enabled: open,
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<LiveClassInput>({
    resolver: zodResolver(liveClassSchema),
    defaultValues: {
      title: "",
      meetingLink: "",
      scheduledAt: "",
      recordingUrl: "",
    },
  });

  const [meet, setMeet] = useState<MeetModeValue>(DEFAULT_MEET_VALUE);
  const [meetError, setMeetError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      reset({
        title: "",
        courseId: undefined,
        batchId: undefined,
        mentorId: undefined,
        meetingLink: "",
        scheduledAt: "",
        duration: undefined,
        recordingUrl: "",
      });
      setMeet({ ...DEFAULT_MEET_VALUE });
      setMeetError(null);
    }
  }, [open, reset]);

  const courseId = watch("courseId");
  const batchId = watch("batchId");
  const mentorId = watch("mentorId");
  const scheduledAt = watch("scheduledAt");
  const duration = watch("duration");

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

  const selectedMentor = (mentors as { id: string; name: string }[]).find((m) => m.id === mentorId) ?? null;

  const mutation = useMutation({
    mutationFn: async (data: LiveClassInput) => {
      const res = await fetch("/api/live-classes", {
        method: "POST",
        body: wrapApiForm({ ...data, ...meetFieldsForSubmit(meet) }),
      });
      const raw = await res.text();
      let json: { error?: unknown } = {};
      if (raw) {
        try {
          json = JSON.parse(raw) as { error?: unknown };
        } catch {
          /* empty / HTML gateway body */
        }
      }
      if (!res.ok) {
        const details = json as { error?: unknown; details?: { fieldErrors?: Record<string, string[] | undefined> } };
        const fieldFirst = Object.values(details.details?.fieldErrors ?? {})
          .flat()
          .find((m): m is string => typeof m === "string" && m.length > 0);
        throw new Error(
          typeof details.error === "string"
            ? details.error
            : fieldFirst
              ? fieldFirst
              : res.status === 504 || res.status === 502
                ? "The server timed out. Refresh Upcoming — the class may already be saved."
                : res.status === 403
                  ? "The host blocked the request. Try a simpler title, or create again."
                  : res.status === 500
                    ? "The server could not save the class. Refresh the page — it may already be there."
                    : "Failed to create live class"
        );
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-classes"] });
      reset();
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[min(90dvh,90vh)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Live Class</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((d) => {
            if (meet.meetMode === "manual" && !isValidManualLink(meet.manualMeetLink)) {
              setMeetError(MANUAL_LINK_ERROR);
              return;
            }
            setMeetError(null);
            mutation.mutate(d);
          })}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Title</Label>
            <Input {...register("title")} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Course</Label>
            <Select value={courseId || undefined} onValueChange={(v) => setValue("courseId", v, { shouldValidate: true })}>
              <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
              <SelectContent>
                {courses.map((c: { id: string; title: string }) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.courseId && <p className="text-sm text-destructive">{errors.courseId.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Batch</Label>
            <Select value={batchId || undefined} onValueChange={(v) => setValue("batchId", v)}>
              <SelectTrigger><SelectValue placeholder="Select batch (optional)" /></SelectTrigger>
              <SelectContent>
                {batches.map((b: { id: string; name: string }) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mentor</Label>
            <Select value={mentorId || undefined} onValueChange={(v) => setValue("mentorId", v, { shouldValidate: true })}>
              <SelectTrigger><SelectValue placeholder="Select mentor" /></SelectTrigger>
              <SelectContent>
                {mentors.map((m: { id: string; name: string }) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.mentorId && <p className="text-sm text-destructive">{errors.mentorId.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Scheduled At (IST)</Label>
            <Input type="datetime-local" {...register("scheduledAt")} />
            {errors.scheduledAt && <p className="text-sm text-destructive">{errors.scheduledAt.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Duration (minutes)</Label>
            <Input type="number" {...register("duration")} />
          </div>
          <MeetModeSelector
            value={meet}
            onChange={(next) => {
              setMeet(next);
              setMeetError(null);
            }}
            mentor={selectedMentor}
            scheduledAt={scheduledAt}
            durationMinutes={duration ? Number(duration) : undefined}
            courseId={courseId}
            batchId={batchId}
            manualLinkError={meetError ?? undefined}
          />
          {mutation.isError && (
            <p className="text-sm text-destructive">{(mutation.error as Error)?.message || "Failed to create live class"}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
