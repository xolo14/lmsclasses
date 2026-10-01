"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, ExternalLink, Pencil, RefreshCw, Video } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MeetStatusBadge } from "@/components/live-classes/MeetStatusBadge";
import { useRetryMeet } from "@/lib/hooks/useGoogle";
import { formatDateTime } from "@/lib/utils";

export type CalendarEventProps = {
  courseId: string;
  courseTitle: string | null;
  batchName: string | null;
  mentorName: string | null;
  hostName: string | null;
  googleOrganizerEmail?: string | null;
  status: string | null;
  meetStatus: string | null;
  duration: number;
  scheduledAtIso: string;
  hasRecording: boolean;
  joinUrl: string;
  icsUrl: string;
  meetingLink: string | null;
  calendarHtmlLink: string | null;
  canEdit: boolean;
};

export type CalendarEventSummary = { id: string; title: string; props: CalendarEventProps };

const JOIN_OPENS_BEFORE_MS = 10 * 60_000;
const JOIN_CLOSES_AFTER_MS = 30 * 60_000;

function statusBadge(status: string | null) {
  if (status === "live") return <Badge variant="success">Live now</Badge>;
  if (status === "scheduled") return <Badge variant="warning">Scheduled</Badge>;
  if (status === "completed") return <Badge variant="outline">Completed</Badge>;
  if (status === "cancelled") return <Badge variant="destructive">Cancelled</Badge>;
  return null;
}

export function EventDetailDialog({
  event,
  onOpenChange,
  editHref,
  role,
}: {
  event: CalendarEventSummary | null;
  onOpenChange: (open: boolean) => void;
  /** Where "Edit" should go for staff/mentors (their live-classes list). */
  editHref?: string;
  role: string;
}) {
  const retryMeet = useRetryMeet();
  const [retryError, setRetryError] = useState<string | null>(null);
  if (!event) return null;
  const { props } = event;
  const start = new Date(props.scheduledAtIso).getTime();
  const end = start + props.duration * 60_000;
  const now = Date.now();
  const isStudent = role === "student";
  const joinOpen =
    props.status === "live" ||
    (props.status === "scheduled" && now >= start - JOIN_OPENS_BEFORE_MS && now <= end + JOIN_CLOSES_AFTER_MS);
  // Staff and mentors may open the link any time; students only inside the window.
  const canJoin = !isStudent || joinOpen;
  const activeClass = props.status === "scheduled" || props.status === "live";

  return (
    <Dialog open={!!event} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-8">{event.title}</DialogTitle>
          <DialogDescription>{formatDateTime(props.scheduledAtIso)} · {props.duration} min</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {statusBadge(props.status)}
          {props.meetStatus && props.meetStatus !== "not_requested" && <MeetStatusBadge status={props.meetStatus} />}
        </div>

        <dl className="grid gap-1.5 text-sm">
          {props.courseTitle && (
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">Course</dt>
              <dd>{props.courseTitle}</dd>
            </div>
          )}
          {props.batchName && (
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">Batch</dt>
              <dd>{props.batchName}</dd>
            </div>
          )}
          {props.mentorName && (
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">Mentor</dt>
              <dd>{props.mentorName}</dd>
            </div>
          )}
          {props.hostName && props.hostName !== props.mentorName && (
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">Host</dt>
              <dd>{props.hostName}</dd>
            </div>
          )}
          {props.googleOrganizerEmail && (
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">Meet</dt>
              <dd>Hosted by {props.googleOrganizerEmail}</dd>
            </div>
          )}
        </dl>

        <div className="flex flex-wrap gap-2 pt-1">
          {activeClass && (
            <Button size="sm" variant="outline" asChild>
              <a href={props.icsUrl}>
                <Calendar className="mr-1 h-3 w-3" /> Add to calendar
              </a>
            </Button>
          )}
          {activeClass &&
            (canJoin ? (
              <Button size="sm" asChild>
                <a href={isStudent || !props.meetingLink ? props.joinUrl : props.meetingLink} target="_blank" rel="noopener noreferrer">
                  <Video className="mr-1 h-3 w-3" /> Join
                </a>
              </Button>
            ) : (
              <Button size="sm" disabled title="Opens 10 minutes before the class">
                <Video className="mr-1 h-3 w-3" /> Join opens 10 min before
              </Button>
            ))}
          {props.calendarHtmlLink && (
            <Button size="sm" variant="ghost" asChild>
              <a href={props.calendarHtmlLink} target="_blank" rel="noreferrer">
                Google Calendar <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          )}
          {props.canEdit && (props.meetStatus === "failed" || props.meetStatus === "pending") && (
            <Button
              size="sm"
              variant="outline"
              disabled={retryMeet.isPending}
              onClick={() => {
                setRetryError(null);
                retryMeet.mutate(event.id, {
                  onError: (err) => setRetryError(err.message),
                });
              }}
            >
              <RefreshCw className="mr-1 h-3 w-3" /> {retryMeet.isPending ? "Retrying…" : "Retry Meet"}
            </Button>
          )}
          {props.canEdit && editHref && (
            <Button size="sm" variant="ghost" asChild>
              <Link href={editHref}>
                <Pencil className="mr-1 h-3 w-3" /> Manage
              </Link>
            </Button>
          )}
        </div>
        {retryError && <p className="text-sm text-destructive">{retryError}</p>}
        {isStudent && props.status === "completed" && props.hasRecording && (
          <p className="text-xs text-muted-foreground">The recording is available under My Classes → Live Recordings.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
