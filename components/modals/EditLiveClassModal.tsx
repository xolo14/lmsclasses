"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { liveClassSchema, type LiveClassInput } from "@/lib/validations";
import { wrapApiForm } from "@/lib/api-url-transport";
import { toDatetimeLocalValue } from "@/lib/utils";
import { MeetModeSelector, type MeetModeValue } from "@/components/live-classes/MeetModeSelector";
import { isValidManualLink, meetFieldsForSubmit, meetValueFromExisting } from "@/lib/live-class-meet-form";
import { useGoogleStatus } from "@/lib/hooks/useGoogle";
import { MeetStatusBadge } from "@/components/live-classes/MeetStatusBadge";
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
  hostUserId?: string | null;
  hostName?: string | null;
  meetStatus?: string | null;
  meetError?: string | null;
  calendarHtmlLink?: string | null;
  googleOrganizerEmail?: string | null;
};

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
  const batchId = watch("batchId");
  const mentorId = watch("mentorId");
  const scheduledAt = watch("scheduledAt");
  const duration = watch("duration");

  const [meet, setMeet] = useState<MeetModeValue>({ meetMode: "none", manualMeetLink: "" });
  const [meetError, setMeetError] = useState<string | null>(null);
  const googleStatus = useGoogleStatus();

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
        scheduledAt: toDatetimeLocalValue(liveClass.scheduledAt),
        duration: liveClass.duration ?? undefined,
        status: (liveClass.status as LiveClassInput["status"]) || "scheduled",
        recordingUrl: liveClass.recordingUrl || "",
      });
      setMeet(meetValueFromExisting(liveClass, googleStatus.data?.platformEmail));
      setMeetError(null);
    }
  }, [liveClass, reset, googleStatus.data?.platformEmail]);

  const selectedMentor = (mentors as { id: string; name: string }[]).find((m) => m.id === mentorId) ?? null;

  const mutation = useMutation({
    mutationFn: async (data: LiveClassInput) => {
      const res = await fetch(`/api/live-classes/${liveClass!.id}`, {
        method: "PATCH",
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
        throw new Error(
          typeof json.error === "string"
            ? json.error
            : res.status === 504 || res.status === 502
              ? "The server timed out. Refresh the list — the update may already be saved."
              : "Failed to update live class"
        );
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-classes"] });
      onOpenChange(false);
    },
  });

  if (!liveClass) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[min(90dvh,90vh)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Live Class</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((d) => {
            if (meet.meetMode === "manual" && !isValidManualLink(meet.manualMeetLink)) {
              setMeetError("Paste a valid link starting with https:// or choose another option.");
              return;
            }
            setMeetError(null);
            mutation.mutate(d);
          })}
          className="space-y-4"
        >
          {liveClass.meetStatus && liveClass.meetStatus !== "not_requested" && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Google Meet:</span>
              <MeetStatusBadge status={liveClass.meetStatus} error={liveClass.meetError} />
              {liveClass.calendarHtmlLink && (
                <a href={liveClass.calendarHtmlLink} target="_blank" rel="noreferrer" className="underline">
                  Open in Google Calendar
                </a>
              )}
            </div>
          )}
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
          <MeetModeSelector
            value={meet}
            onChange={(next) => {
              setMeet(next);
              setMeetError(null);
            }}
            mentor={selectedMentor}
            existing={{
              hostUserId: liveClass.hostUserId ?? null,
              hostName: liveClass.hostName ?? null,
              meetStatus: liveClass.meetStatus ?? null,
              meetingLink: liveClass.meetingLink ?? null,
            }}
            scheduledAt={scheduledAt}
            durationMinutes={duration ? Number(duration) : undefined}
            courseId={courseId}
            batchId={batchId}
            excludeClassId={liveClass.id}
            manualLinkError={meetError ?? undefined}
          />
          <div className="space-y-2">
            <Label>Recording URL</Label>
            <Input {...register("recordingUrl")} placeholder="aiml/video1.mp4 or https://youtube.com/..." />
            <p className="text-xs text-muted-foreground">
              Prefer a GCS object key for private videos. YouTube/Vimeo also work.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Scheduled At (IST)</Label>
            <Input type="datetime-local" {...register("scheduledAt")} />
          </div>
          <div className="space-y-2">
            <Label>Duration (minutes)</Label>
            <Input type="number" {...register("duration")} />
          </div>
          {mutation.isError && (
            <p className="text-sm text-destructive">{(mutation.error as Error)?.message || "Failed to update live class"}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
