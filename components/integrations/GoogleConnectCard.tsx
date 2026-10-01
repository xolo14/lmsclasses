"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, ExternalLink, RefreshCw, Unplug } from "lucide-react";
import { connectGoogleHref, useDisconnectGoogle, useGoogleStatus } from "@/lib/hooks/useGoogle";
import { formatDateTime } from "@/lib/utils";

/** Messages for the `?google=` code the OAuth callback appends to returnTo. */
const CALLBACK_MESSAGES: Record<string, { tone: "ok" | "error" | "info"; text: string }> = {
  connected: { tone: "ok", text: "Google Calendar connected. New live classes will get a Meet link automatically." },
  denied: { tone: "info", text: "You cancelled the Google sign-in. Nothing was changed." },
  scope: { tone: "error", text: "Calendar permission was not granted. Reconnect and tick the Calendar checkbox on the Google consent screen." },
  platform_connected: { tone: "ok", text: "Platform Google account connected." },
  wrong_account: { tone: "error", text: "That Google account is not the platform host. Use Connect platform account." },
  reserved: { tone: "error", text: "That Google account is reserved for the platform host. Use Connect platform account." },
  in_use: { tone: "error", text: "That Google account is already connected to a different LMS user. Use another Google account." },
  no_refresh: {
    tone: "error",
    text: "Google did not return a long-lived token. Remove this app at myaccount.google.com → Security → Third-party access, then connect again.",
  },
  state: { tone: "error", text: "The sign-in link expired or was tampered with. Please try connecting again." },
  not_configured: { tone: "error", text: "Google integration is not configured on this server yet." },
  rate_limited: { tone: "error", text: "Too many connection attempts. Please wait a few minutes and try again." },
  error: { tone: "error", text: "Google sign-in failed. Please try again." },
};

export function GoogleConnectCard({ returnTo }: { returnTo?: string }) {
  const searchParams = useSearchParams();
  const callbackCode = searchParams.get("google");
  const { data, isLoading, refetch } = useGoogleStatus();
  const disconnect = useDisconnectGoogle();
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error" | "info"; text: string } | null>(null);

  useEffect(() => {
    if (callbackCode && CALLBACK_MESSAGES[callbackCode]) {
      setNotice(CALLBACK_MESSAGES[callbackCode]);
      // Drop the query param without a navigation so a refresh does not replay the message.
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("google");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, [callbackCode]);

  useEffect(() => {
    if (disconnect.isSuccess && disconnect.data) {
      const n = disconnect.data.affectedUpcomingClasses;
      setNotice({
        tone: "info",
        text:
          n > 0
            ? `Google disconnected. ${n} upcoming class${n === 1 ? "" : "es"} will keep ${n === 1 ? "its" : "their"} existing Meet link but will no longer update automatically.`
            : "Google disconnected.",
      });
      setConfirming(false);
    }
  }, [disconnect.isSuccess, disconnect.data]);

  const status = data?.status;
  const badge = !data
    ? null
    : !data.configured
      ? { variant: "secondary" as const, label: "Not configured" }
      : status === "active"
        ? { variant: "success" as const, label: "Connected" }
        : status === "needs_reconnect"
          ? { variant: "warning" as const, label: "Reconnect required" }
          : { variant: "secondary" as const, label: "Not connected" };

  const href = connectGoogleHref(returnTo);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-sky-600" />
            Google Calendar &amp; Meet
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {data?.canHost
              ? "Connect your own Google account. Live classes you host get a Google Meet link and a calendar invite for enrolled students automatically."
              : "Connect your Google Calendar so live class times you are enrolled in appear there."}
          </p>
        </div>
        {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
      </CardHeader>
      <CardContent className="space-y-4">
        {notice && (
          <p
            className={
              notice.tone === "ok"
                ? "text-sm text-emerald-600"
                : notice.tone === "error"
                  ? "text-sm text-destructive"
                  : "text-sm text-muted-foreground"
            }
          >
            {notice.text}
          </p>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !data ? (
          <p className="text-sm text-destructive">Could not load Google status.</p>
        ) : !data.canConnect ? (
          <p className="text-sm text-muted-foreground">Google Calendar is not available for this account type.</p>
        ) : !data.configured ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Google Calendar/Meet OAuth is not ready. Video uploads use GCS and are configured separately.
            </p>
            <p className="text-sm text-muted-foreground">
              {data.oauth?.reason ??
                "The Super Admin must set the GOOGLE_* OAuth variables (not GCP_* / GCS_*) and Restart Node."}
            </p>
          </div>
        ) : status === "active" ? (
          <div className="space-y-3">
            <dl className="grid gap-1 text-sm">
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-28 shrink-0">Google account</dt>
                <dd className="font-medium break-all">{data.googleEmail}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-28 shrink-0">Connected</dt>
                <dd>{formatDateTime(data.connectedAt)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-28 shrink-0">Last used</dt>
                <dd>{data.lastUsedAt ? formatDateTime(data.lastUsedAt) : "Not yet"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-28 shrink-0">Permissions</dt>
                <dd className="flex flex-wrap gap-1">
                  <Badge variant={data.scopes.calendarEvents ? "success" : "destructive"}>Calendar events</Badge>
                  {data.freebusyEnabled && (
                    <Badge variant={data.scopes.freebusy ? "success" : "secondary"}>Free/busy</Badge>
                  )}
                </dd>
              </div>
            </dl>
            {data.isGmail && (
              <p className="text-xs text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
                Personal Gmail accounts limit group Meet calls (about 60 minutes, 100 participants). For longer
                classes host from a Google Workspace account.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={href}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Reconnect
                </a>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <a href="https://calendar.google.com" target="_blank" rel="noreferrer">
                  Open Google Calendar <ExternalLink className="h-3.5 w-3.5 ml-1" />
                </a>
              </Button>
              {confirming ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Disconnect Google?</span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={disconnect.isPending}
                    onClick={() => disconnect.mutate()}
                  >
                    {disconnect.isPending ? "Disconnecting…" : "Yes, disconnect"}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirming(true)}>
                  <Unplug className="h-4 w-4 mr-1" /> Disconnect
                </Button>
              )}
            </div>
            {disconnect.isError && <p className="text-sm text-destructive">{disconnect.error.message}</p>}
          </div>
        ) : status === "needs_reconnect" ? (
          <div className="space-y-3">
            <p className="text-sm text-amber-700">
              Google access for <strong>{data.googleEmail}</strong> stopped working
              {data.lastError ? ` — ${data.lastError}` : "."} New classes you host will not get a Meet link until you
              reconnect.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <a href={href}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Reconnect Google
                </a>
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={disconnect.isPending} onClick={() => disconnect.mutate()}>
                Remove connection
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
              {data.canHost ? (
                <>
                  <li>Creates a Google Meet link for every class you host.</li>
                  <li>Invites enrolled students on your Google Calendar so they get reminders.</li>
                </>
              ) : (
                <>
                  <li>Adds live classes you are enrolled in to your Google Calendar.</li>
                  <li>Only Super Admin, Manager, or Mentor can create a live class.</li>
                </>
              )}
              <li>We only ask for permission to manage calendar events — not your email or files.</li>
            </ul>
            <Button asChild size="sm">
              <a href={href}>
                <CalendarCheck className="h-4 w-4 mr-1" /> Connect Google Calendar
              </a>
            </Button>
          </div>
        )}

        {data && data.configured && (
          <button type="button" className="text-xs text-muted-foreground underline" onClick={() => void refetch()}>
            Refresh status
          </button>
        )}
      </CardContent>
    </Card>
  );
}
