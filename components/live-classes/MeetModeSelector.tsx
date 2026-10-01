"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { AlertTriangle, CalendarCheck, Link2, RefreshCw, VideoOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { MeetMode } from "@/lib/validations";
import { connectGoogleHref, useGoogleStatus, useHostGoogleInfo } from "@/lib/hooks/useGoogle";
import { canHostLiveClass, parseApiJson } from "@/lib/utils";

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
  const { data: session } = useSession();
  const me = session?.user;
  const meCanHost = canHostLiveClass(me?.role);
  const schedulerIsMentor = !!me && !!mentor && me.id === mentor.id;

  const myStatus = useGoogleStatus({ enabled: meCanHost });
  const mentorInfo = useHostGoogleInfo(mentor && !schedulerIsMentor ? mentor.id : null);
  const keepHostId = existing?.hostUserId && existing.hostUserId !== mentor?.id && existing.hostUserId !== me?.id ? existing.hostUserId : null;
  const keepHostInfo = useHostGoogleInfo(keepHostId);
  const platformEmail = myStatus.data?.platformEmail ?? "info@lmsclasses.com";

  // Apply Super Admin default once when creating (not editing).
  useEffect(() => {
    if (existing || !myStatus.data?.defaultMeetMode) return;
    if (value.meetMode === "google_platform" && myStatus.data.defaultMeetMode === "google_host") {
      onChange({ ...value, meetMode: "google_host" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStatus.data?.defaultMeetMode]);

  // Resolve which user the current selection makes the host.
  const effectiveHostId =
    value.meetMode === "google_scheduler"
      ? me?.id ?? null
      : value.meetMode === "google_host"
        ? value.hostUserId ?? mentor?.id ?? null
        : value.meetMode === "google_platform"
          ? mentor?.id ?? null
          : null;

  const effectiveHost = useMemo(() => {
    if (!effectiveHostId) return null;
    if (me && effectiveHostId === me.id && myStatus.data) {
      return {
        name: me.name ?? "You",
        connected: myStatus.data.connected,
        status: myStatus.data.status,
        googleEmail: myStatus.data.googleEmail,
        isGmail: myStatus.data.isGmail,
      };
    }
    if (mentor && effectiveHostId === mentor.id && mentorInfo.data) {
      return { ...mentorInfo.data, name: mentor.name || mentorInfo.data.name };
    }
    if (keepHostId && effectiveHostId === keepHostId && keepHostInfo.data) {
      return { ...keepHostInfo.data };
    }
    return null;
  }, [effectiveHostId, me, myStatus.data, mentor, mentorInfo.data, keepHostId, keepHostInfo.data]);

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

  // Google not configured on the server → collapse to manual/none.
  const googleAvailable = myStatus.data ? myStatus.data.configured : true;
  useEffect(() => {
    if (
      myStatus.data &&
      !myStatus.data.configured &&
      (value.meetMode === "google_host" || value.meetMode === "google_scheduler" || value.meetMode === "google_platform")
    ) {
      onChange({ ...value, meetMode: value.manualMeetLink ? "manual" : "none", hostUserId: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStatus.data?.configured]);

  const select = (meetMode: MeetMode, hostUserId?: string) => onChange({ ...value, meetMode, hostUserId });

  const platformGmailWarning =
    value.meetMode === "google_platform" &&
    !!myStatus.data?.platformIsGmail &&
    ((durationMinutes ?? 0) > GMAIL_MAX_MINUTES || (conflictQuery.data?.attendeeCount ?? 0) > GMAIL_MAX_PARTICIPANTS);

  const gmailWarning =
    !platformGmailWarning &&
    effectiveHost?.isGmail &&
    ((durationMinutes ?? 0) > GMAIL_MAX_MINUTES || (conflictQuery.data?.attendeeCount ?? 0) > GMAIL_MAX_PARTICIPANTS);

  const existingHasGoogleMeet = existing && ["created", "pending", "failed"].includes(existing.meetStatus ?? "");

  return (
    <div className="space-y-3">
      <Label>Video link</Label>

      {googleAvailable && (
        <>
          <ModeOption
            checked={value.meetMode === "google_platform"}
            onSelect={() => select("google_platform", undefined)}
            icon={<CalendarCheck className="h-4 w-4 text-sky-600" />}
            title={`Google Meet — hosted by ${platformEmail}`}
            description={
              existingHasGoogleMeet && value.meetMode === "google_platform"
                ? "Keeps the existing Meet link on the platform calendar."
                : "Default. The LMS platform account creates the event. The assigned mentor is invited and stays the class owner."
            }
            status={
              myStatus.data ? (
                myStatus.data.platformConnected ? (
                  <span className="text-xs inline-flex items-center gap-1">
                    <Badge variant="success">Connected</Badge>
                    <span className="text-muted-foreground">{platformEmail}</span>
                  </span>
                ) : (
                  <span className="text-xs text-amber-700">
                    Platform account is not connected. The class is saved now; Super Admin must connect {platformEmail}{" "}
                    for the Meet link.
                  </span>
                )
              ) : null
            }
          />

          {/* Keep current host (edit only, when host is neither mentor nor me) */}
          {keepHostId && (
            <ModeOption
              checked={value.meetMode === "google_host" && value.hostUserId === keepHostId}
              onSelect={() => select("google_host", keepHostId)}
              icon={<CalendarCheck className="h-4 w-4 text-sky-600" />}
              title={`Google Meet — hosted by ${keepHostInfo.data?.name ?? "current host"}`}
              description="Keeps the existing calendar event and Meet link."
              status={<HostStatus info={keepHostInfo.data ?? null} />}
            />
          )}

          {/* Mentor's Google (or mine, when I am the mentor) */}
          {mentor && (
            <ModeOption
              checked={
                (value.meetMode === "google_host" &&
                  (value.hostUserId ?? mentor.id) === mentor.id &&
                  !(me && value.hostUserId === me.id && !schedulerIsMentor)) ||
                (schedulerIsMentor && value.meetMode === "google_scheduler")
              }
              onSelect={() => select("google_host", undefined)}
              icon={<CalendarCheck className="h-4 w-4 text-sky-600" />}
              title={schedulerIsMentor ? "Create Google Meet via my Google account" : `Create Google Meet via ${mentor.name}'s Google account`}
              description={
                existingHasGoogleMeet && existing?.hostUserId === mentor.id
                  ? "Keeps the existing Meet link; time/title changes update the invite."
                  : "Calendar event + Meet link on the host's calendar. Enrolled students receive the invite."
              }
              status={
                schedulerIsMentor ? (
                  <MyStatus
                    status={myStatus.data ?? null}
                    loading={myStatus.isLoading}
                    onRefresh={() => void myStatus.refetch()}
                  />
                ) : (
                  <HostStatus info={mentorInfo.data ?? null} loading={mentorInfo.isLoading} />
                )
              }
            />
          )}

          {/* My Google (scheduler ≠ mentor) */}
          {meCanHost && !schedulerIsMentor && (
            <ModeOption
              checked={
                value.meetMode === "google_scheduler" ||
                (value.meetMode === "google_host" && !!me && value.hostUserId === me.id)
              }
              onSelect={() => select("google_scheduler", undefined)}
              icon={<CalendarCheck className="h-4 w-4 text-sky-600" />}
              title="Create Google Meet via my Google account"
              description="You become the host; the event lives on your calendar."
              status={
                <MyStatus status={myStatus.data ?? null} loading={myStatus.isLoading} onRefresh={() => void myStatus.refetch()} />
              }
            />
          )}
        </>
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

      <ModeOption
        checked={value.meetMode === "none"}
        onSelect={() => select("none", undefined)}
        icon={<VideoOff className="h-4 w-4 text-muted-foreground" />}
        title="No video link"
        description={existing?.meetingLink && existingHasGoogleMeet ? "Removes the Google event and Meet link." : "Add one later."}
      />

      {/* Warnings */}
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
      {gmailWarning && (
        <Warning>
          {effectiveHost?.name}&apos;s Google account is a personal Gmail. Free Meet calls are limited to about{" "}
          {GMAIL_MAX_MINUTES} minutes and {GMAIL_MAX_PARTICIPANTS} participants
          {(durationMinutes ?? 0) > GMAIL_MAX_MINUTES ? ` — this class is ${durationMinutes} minutes` : ""}
          {(conflictQuery.data?.attendeeCount ?? 0) > GMAIL_MAX_PARTICIPANTS
            ? ` — ${conflictQuery.data?.attendeeCount} students would be invited`
            : ""}
          . Consider a Google Workspace account or a shorter class.
        </Warning>
      )}
      {conflictQuery.data && conflictQuery.data.conflicts.length > 0 && (
        <Warning>
          {effectiveHost?.name ?? "The host"} already has{" "}
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

/* ------------------------------------------------------------------ */

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

function HostStatus({
  info,
  loading,
}: {
  info: { connected: boolean; status: string | null; googleEmail: string | null; name?: string } | null;
  loading?: boolean;
}) {
  if (loading) return <span className="text-xs text-muted-foreground">Checking Google connection…</span>;
  if (!info) return null;
  if (info.connected) {
    return (
      <span className="text-xs inline-flex items-center gap-1">
        <Badge variant="success">Connected</Badge>
        <span className="text-muted-foreground">{info.googleEmail}</span>
      </span>
    );
  }
  if (info.status === "needs_reconnect") {
    return (
      <span className="text-xs text-amber-700">
        Google needs to be reconnected. The class is saved now; the Meet link is created once they reconnect (we email
        them).
      </span>
    );
  }
  return (
    <span className="text-xs text-amber-700">
      Not connected to Google. The class is saved now; the Meet link is created once they connect (we email them).
    </span>
  );
}

function MyStatus({
  status,
  loading,
  onRefresh,
}: {
  status: { connected: boolean; status: string | null; googleEmail: string | null; integrationsPath: string } | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  if (loading) return <span className="text-xs text-muted-foreground">Checking your Google connection…</span>;
  if (!status) return null;
  if (status.connected) {
    return (
      <span className="text-xs inline-flex items-center gap-1">
        <Badge variant="success">Connected</Badge>
        <span className="text-muted-foreground">{status.googleEmail}</span>
      </span>
    );
  }
  return (
    <span className="text-xs text-amber-700 inline-flex flex-wrap items-center gap-2">
      {status.status === "needs_reconnect" ? "Your Google connection needs a reconnect." : "You have not connected Google yet."}
      <a
        href={connectGoogleHref(status.integrationsPath)}
        target="_blank"
        rel="noreferrer"
        className="font-semibold underline text-swiss-red"
      >
        {status.status === "needs_reconnect" ? "Reconnect" : "Connect Google"}
      </a>
      <button type="button" className="inline-flex items-center gap-1 underline" onClick={onRefresh}>
        <RefreshCw className="h-3 w-3" /> Refresh
      </button>
    </span>
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
