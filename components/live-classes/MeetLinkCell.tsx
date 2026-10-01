"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MeetStatusBadge } from "@/components/live-classes/MeetStatusBadge";
import { parseApiJson } from "@/lib/utils";

type Row = {
  id: string;
  meetingLink?: string | null;
  meetStatus?: string | null;
  meetError?: string | null;
  calendarHtmlLink?: string | null;
  googleOrganizerEmail?: string | null;
};

/** Table cell: Meet status + copy link + retry (pending/failed) + Google Calendar link. */
export function MeetLinkCell({ row }: { row: Row }) {
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);

  const retry = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/live-classes/${row.id}/retry-meet`, { method: "POST" });
      const json = await parseApiJson<{ ok?: boolean; message?: string; error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? json.message ?? "Retry failed");
      return json;
    },
    onSuccess: (json) => {
      setMessage(json.ok ? null : json.message ?? "Still waiting.");
      qc.invalidateQueries({ queryKey: ["live-classes"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const status = row.meetStatus ?? (row.meetingLink ? "manual" : "not_requested");
  const canRetry = status === "pending" || status === "failed";

  return (
    <div className="flex flex-col gap-1 min-w-[9rem]">
      <div className="flex flex-wrap items-center gap-1">
        <MeetStatusBadge status={status} error={row.meetError} />
        {row.meetingLink && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            title="Copy meeting link"
            onClick={() => {
              void navigator.clipboard.writeText(row.meetingLink as string);
              setMessage("Copied.");
              setTimeout(() => setMessage(null), 1500);
            }}
          >
            <Copy className="h-3 w-3" />
          </Button>
        )}
        {row.calendarHtmlLink && (
          <Button variant="ghost" size="sm" className="h-7 px-2" asChild title="Open in Google Calendar">
            <a href={row.calendarHtmlLink} target="_blank" rel="noreferrer">
              <CalendarDays className="h-3 w-3" />
            </a>
          </Button>
        )}
        {canRetry && (
          <Button variant="outline" size="sm" className="h-7 px-2" disabled={retry.isPending} onClick={() => retry.mutate()}>
            <RefreshCw className={`h-3 w-3 mr-1 ${retry.isPending ? "animate-spin" : ""}`} /> Retry
          </Button>
        )}
      </div>
      {row.googleOrganizerEmail && (
        <p className="text-[11px] leading-tight text-muted-foreground max-w-[18rem]">
          Meet is hosted by {row.googleOrganizerEmail}. Ask admin to make you co-host if you need host controls.
        </p>
      )}
      {(message || (status !== "created" && row.meetError)) && (
        <p className="text-[11px] leading-tight text-muted-foreground max-w-[16rem]">{message ?? row.meetError}</p>
      )}
    </div>
  );
}
