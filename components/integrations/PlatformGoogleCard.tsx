"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, RefreshCw } from "lucide-react";
import { connectGoogleHref, useGoogleStatus } from "@/lib/hooks/useGoogle";
import { formatDateTime } from "@/lib/utils";

const CALLBACK_MESSAGES: Record<string, { tone: "ok" | "error" | "info"; text: string }> = {
  platform_connected: { tone: "ok", text: "Platform Google account connected. New live classes will use this host by default." },
  wrong_account: { tone: "error", text: "That Google account is not the platform host. Sign in as the configured platform email." },
  reserved: { tone: "error", text: "That Google account is reserved for the platform host. Connect it from Connect platform account." },
  denied: { tone: "info", text: "You cancelled the Google sign-in. Nothing was changed." },
  scope: { tone: "error", text: "Calendar permission was not granted. Reconnect and tick the Calendar checkbox." },
  in_use: { tone: "error", text: "That Google account is already connected to a different LMS user." },
  no_refresh: {
    tone: "error",
    text: "Google did not return a long-lived token. Remove this app at myaccount.google.com → Security → Third-party access, then connect again.",
  },
  state: { tone: "error", text: "The sign-in link expired or was tampered with. Please try connecting again." },
  not_configured: { tone: "error", text: "Google integration is not configured on this server yet." },
  rate_limited: { tone: "error", text: "Too many connection attempts. Please wait a few minutes and try again." },
  error: { tone: "error", text: "Google sign-in failed. Please try again." },
};

export function PlatformGoogleCard({ returnTo }: { returnTo: string }) {
  const searchParams = useSearchParams();
  const callbackCode = searchParams.get("google");
  const { data, isLoading, refetch } = useGoogleStatus();
  const [notice, setNotice] = useState<{ tone: "ok" | "error" | "info"; text: string } | null>(null);

  useEffect(() => {
    if (callbackCode && CALLBACK_MESSAGES[callbackCode]) {
      setNotice(CALLBACK_MESSAGES[callbackCode]);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("google");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, [callbackCode]);

  const platform = data?.platform;
  const email = platform?.googleEmail ?? data?.platformEmail ?? "info@lmsclasses.com";
  const status = platform?.status ?? null;
  const badge = !data
    ? null
    : !data.configured
      ? { variant: "secondary" as const, label: "Not configured" }
      : status === "active"
        ? { variant: "success" as const, label: "Connected" }
        : status === "needs_reconnect"
          ? { variant: "warning" as const, label: "Reconnect required" }
          : { variant: "secondary" as const, label: "Not connected" };

  const href = connectGoogleHref(returnTo, { platform: true });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-sky-600" />
            Platform Google account
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Connect <strong>{email}</strong> as the default Meet host for every live class. Mentors are added as
            attendees and remain the LMS owners.
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
        ) : !data?.configured ? (
          <p className="text-sm text-muted-foreground">
            The server is missing Google OAuth settings. See <code className="text-xs">docs/GOOGLE_INTEGRATION.md</code>.
          </p>
        ) : status === "active" ? (
          <div className="space-y-3">
            <dl className="grid gap-1 text-sm">
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-28 shrink-0">Google account</dt>
                <dd className="font-medium break-all">{email}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-28 shrink-0">Connected</dt>
                <dd>{platform?.connectedAt ? formatDateTime(platform.connectedAt) : "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-28 shrink-0">Last used</dt>
                <dd>{platform?.lastUsedAt ? formatDateTime(platform.lastUsedAt) : "Not yet"}</dd>
              </div>
            </dl>
            {platform?.isGmail && (
              <p className="text-xs text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
                This is a personal Gmail account. Free Meet calls are limited to about 60 minutes and 100 participants.
                Prefer a Google Workspace address for longer or larger classes.
              </p>
            )}
            <Button asChild variant="outline" size="sm">
              <a href={href}>
                <RefreshCw className="h-4 w-4 mr-1" /> Reconnect
              </a>
            </Button>
          </div>
        ) : status === "needs_reconnect" ? (
          <div className="space-y-3">
            <p className="text-sm text-amber-700">
              Platform Google access for <strong>{email}</strong> stopped working
              {platform?.lastError ? ` — ${platform.lastError}` : "."} New classes will not get a Meet link until you
              reconnect.
            </p>
            <Button asChild size="sm">
              <a href={href}>
                <RefreshCw className="h-4 w-4 mr-1" /> Reconnect platform account
              </a>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sign in as <strong>{email}</strong> only. Any other Google account is rejected.
            </p>
            <Button asChild size="sm">
              <a href={href}>Connect platform account</a>
            </Button>
          </div>
        )}

        {data?.configured && (
          <button type="button" className="text-xs text-muted-foreground underline" onClick={() => void refetch()}>
            Refresh status
          </button>
        )}
      </CardContent>
    </Card>
  );
}
