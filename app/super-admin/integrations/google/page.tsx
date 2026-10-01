"use client";

import Link from "next/link";
import { AlertTriangle, CalendarCheck, Link2, Users, Video } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/charts/KpiCard";
import { Button } from "@/components/ui/button";
import { GoogleConnectionsTable, useGoogleConnections } from "@/components/integrations/GoogleConnectionsTable";

export default function GoogleConnectionsPage() {
  const { data, isLoading, isError, error } = useGoogleConnections();
  const stats = data?.stats;

  return (
    <div className="space-y-6">
      <PageHeader title="Google Connections" description="Who can host Google Meet classes, and which upcoming classes still need a link.">
        <Button asChild variant="outline" size="sm">
          <Link href="/super-admin/settings/integrations">My integration settings</Link>
        </Button>
      </PageHeader>

      {stats && !stats.configured && (
        <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
          <span>
            Google OAuth is not configured on this server. Set <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>,{" "}
            <code>GOOGLE_REDIRECT_URI</code>, <code>GOOGLE_TOKEN_ENCRYPTION_KEY</code> and <code>GOOGLE_STATE_SECRET</code> (see{" "}
            <code>docs/GOOGLE_INTEGRATION.md</code>), then restart the app.
          </span>
        </div>
      )}

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Connected hosts"
            value={`${stats.connected} / ${stats.hosts}`}
            icon={Users}
            description={`${stats.notConnected} not connected`}
          />
          <KpiCard
            title="Needs reconnect"
            value={stats.needsReconnect}
            icon={AlertTriangle}
            description="Tokens revoked or expired"
            className={stats.needsReconnect > 0 ? "border-amber-500/40" : undefined}
          />
          <KpiCard
            title="Classes missing Meet link"
            value={stats.missingMeetLink}
            icon={stats.upcomingMeetFailed > 0 ? Video : Link2}
            description={`${stats.upcomingMeetPending} pending · ${stats.upcomingMeetFailed} failed`}
            className={stats.missingMeetLink > 0 ? "border-amber-500/40" : undefined}
          />
          <KpiCard
            title="Meet links created this month"
            value={stats.createdThisMonth}
            icon={CalendarCheck}
            description={`${stats.upcomingMeetCreated} upcoming with a Meet link`}
          />
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : isError ? (
        <p className="text-destructive">{(error as Error).message}</p>
      ) : (
        <GoogleConnectionsTable rows={data?.rows ?? []} />
      )}
    </div>
  );
}
