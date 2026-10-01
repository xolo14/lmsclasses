"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarCheck, Link2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { MeetMode } from "@/lib/validations";
import { useGoogleStatus } from "@/lib/hooks/useGoogle";
import { parseApiJson } from "@/lib/utils";

export type MeetModeValue = {
  meetMode: MeetMode;
  /** Explicit host. Undefined → server derives from meetMode (mentor or scheduler). */
  hostUserId?: string;
  manualMeetLink: string;
};

export type ConflictInfo = {
  conflicts: Array<{ id: string; title: string; scheduledAt: string; duration: number | null; source: "lms" | "google" }>;
  attendeeCount: number;
};

type Props = {
  value: MeetModeValue;
  onChange: (next: MeetModeValue) => void;
  /** The class mentor (default host). */
  mentor: { id: string; name: string } | null;
  /** Editing an existing class: its current host + Meet status. */
  existing?: {
    hostUserId: string | null;
    hostName?: string | null;
    meetStatus: string | null;
    meetingLink: string | null;
  } | null;
  /** For conflict + Gmail-limit checks. */
  scheduledAt?: string;
  durationMinutes?: number;
  courseId?: string;
  batchId?: string;
  excludeClassId?: string;
  manualLinkError?: string;
};

const GMAIL_MAX_MINUTES = 60;
const GMAIL_MAX_PARTICIPANTS = 100;
const HIDDEN_MEET_MODES: MeetMode[] = ["google_host", "google_scheduler", "none"];

export function MeetModeSelector({
  value,
  onChange,
  mentor,
  existing,
  scheduledAt,
  durationMinutes,
  courseId,
  batchId,
  excludeClassId,
  manualLinkError,
}: Props) {
  const myStatus = useGoogleStatus();
  const platformEmail = myStatus.data?.platformEmail ?? "info@lmsclasses.com";
  const googleAvailable = myStatus.data ? myStatus.data.configured : true;

  useEffect(() => {
    if (!HIDDEN_MEET_MODES.includes(value.meetMode)) return;
    onChange({
      ...value,
      meetMode: "manual",
      hostUserId: undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.meetMode, value.manualMeetLink]);

  useEffect(() => {
    if (myStatus.data && !myStatus.data.configured && value.meetMode === "google_platform") {
      onChange({ ...value, meetMode: "manual", hostUserId: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStatus.data?.configured]);

  const effectiveHostId = value.meetMode === "google_platform" ? mentor?.id ?? null : null;

  const canCheckConflicts = !!effectiveHostId && !!scheduledAt && scheduledAt.length >= 16;
  const conflictQuery = useQuery<ConflictInfo>({
    queryKey: ["live-class-conflicts", effectiveHostId, scheduledAt, durationMinutes, courseId, batchId, excludeClassId],
    queryFn: async () => {
      const params = new URLSearchParams({
        hostUserId: effectiveHostId as string,
        scheduledAt: scheduledAt as string,
        duration: String(durationMinutes ?? 60),
      });
      if (courseId) params.set("courseId", courseId);
      if (batchId) params.set("batchId", batchId);
      if (excludeClassId) params.set("excludeClassId", excludeClassId);
      const res = await fetch(`/api/live-classes/conflicts?${params}`, { cache: "no-store" });
      const json = await parseApiJson<ConflictInfo & { error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Conflict check failed");
      return json;
    },
    enabled: canCheckConflicts,
    staleTime: 15_000,
    retry: false,
  });

  const select = (meetMode: MeetMode, hostUserId?: string) => onChange({ ...value, meetMode, hostUserId });

  const platformGmailWarning =
    value.meetMode === "google_platform" &&
    !!myStatus.data?.platformIsGmail &&
    ((durationMinutes ?? 0) > GMAIL_MAX_MINUTES || (conflictQuery.data?.attendeeCount ?? 0) > GMAIL_MAX_PARTICIPANTS);

  const existingHasGoogleMeet = existing && ["created", "pending", "failed"].includes(existing.meetStatus ?? "");

  const mentorName = useMemo(() => mentor?.name ?? "The assigned mentor", [mentor?.name]);

  return (
    <div className="space-y-3">
      <Label>Video link</Label>

      {googleAvailable && (
        <ModeOption
          checked={value.meetMode === "google_platform"}
          onSelect={() => select("google_platform", undefined)}
          icon={<CalendarCheck className="h-4 w-4 text-sky-600" />}
          title={`Google Meet — hosted by ${platformEmail}`}
          description={
            existingHasGoogleMeet && value.meetMode === "google_platform"
              ? "Keeps the existing Meet link on the platform calendar."
              : "The LMS platform account creates the event. The assigned mentor is invited and stays the class owner."
          }
          status={
            <span className="space-y-1">
              <span className="block text-xs text-amber-700">
                Auto-create may not work until Google OAuth verification is approved. Paste a meeting link if you need
                the class now — that does not use Google.
              </span>
              {myStatus.data ? (
                myStatus.data.platformConnected ? (
                  <span className="text-xs inline-flex items-center gap-1">
                    <Badge variant="success">Connected</Badge>
                    <span className="text-muted-foreground">{platformEmail}</span>
                  </span>
                ) : (
                  <span className="block text-xs text-amber-700">
                    Platform account is not connected. Super Admin must connect {platformEmail} for the Meet link.
                  </span>
                )
              ) : null}
            </span>
          }
        />
      )}

      <ModeOption
        checked={value.meetMode === "manual"}
        onSelect={() => select("manual", undefined)}
        icon={<Link2 className="h-4 w-4 text-primary" />}
        title="Paste a meeting link"
        description="Zoom, Teams, or an existing Meet link. No calendar invite is sent by Google."
      >
        {value.meetMode === "manual" && (
          <div className="space-y-1 pt-2">
            <Input
              type="url"
              placeholder="https://meet.google.com/… or Zoom link"
              value={value.manualMeetLink}
              onChange={(e) => onChange({ ...value, manualMeetLink: e.target.value })}
            />
            {manualLinkError && <p className="text-sm text-destructive">{manualLinkError}</p>}
          </div>
        )}
      </ModeOption>

      {platformGmailWarning && (
        <Warning>
          The platform account ({platformEmail}) is a personal Gmail. Free Meet calls are limited to about{" "}
          {GMAIL_MAX_MINUTES} minutes and {GMAIL_MAX_PARTICIPANTS} participants
          {(durationMinutes ?? 0) > GMAIL_MAX_MINUTES ? ` — this class is ${durationMinutes} minutes` : ""}
          {(conflictQuery.data?.attendeeCount ?? 0) > GMAIL_MAX_PARTICIPANTS
            ? ` — ${conflictQuery.data?.attendeeCount} students would be invited`
            : ""}
          . Prefer a Google Workspace account or a shorter class.
        </Warning>
      )}
      {conflictQuery.data && conflictQuery.data.conflicts.length > 0 && (
        <Warning>
          {mentorName} already has{" "}
          {conflictQuery.data.conflicts.length === 1 ? "a class" : `${conflictQuery.data.conflicts.length} classes`} in this
          time slot:
          <ul className="list-disc pl-5 mt-1">
            {conflictQuery.data.conflicts.slice(0, 3).map((c) => (
              <li key={c.id}>
                {c.title} ({formatSlot(c.scheduledAt, c.duration)}){c.source === "google" ? " — Google Calendar" : ""}
              </li>
            ))}
          </ul>
          You can still save; this is only a warning.
        </Warning>
      )}
    </div>
  );
}

function ModeOption({
  checked,
  onSelect,
  icon,
  title,
  description,
  status,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  status?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-md border px-3 py-2.5 transition-colors ${checked ? "border-swiss-red/60 bg-swiss-red/5" : "border-border hover:bg-muted/40"}`}
    >
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="radio" className="mt-1 h-4 w-4 accent-swiss-red" checked={checked} onChange={onSelect} />
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 text-sm font-medium">
            {icon}
            {title}
          </span>
          <span className="block text-xs text-muted-foreground mt-0.5">{description}</span>
          {status && <span className="block mt-1">{status}</span>}
        </span>
      </label>
      {children}
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900">
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
      <div>{children}</div>
    </div>
  );
}

function formatSlot(iso: string, duration: number | null): string {
  const start = new Date(iso);
  const end = new Date(start.getTime() + (duration ?? 60) * 60_000);
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });
  return `${fmt(start)} – ${fmt(end)}`;
}
