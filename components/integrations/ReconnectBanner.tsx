"use client";

import { usePathname } from "next/navigation";
import { AlertTriangle, CalendarCheck } from "lucide-react";
import { connectGoogleHref, useGoogleStatus } from "@/lib/hooks/useGoogle";
import { canConnectGoogleCalendar, isPortalHomePath } from "@/lib/utils";

/**
 * Portal-wide reconnect warning, plus a dashboard banner for anyone who has
 * not connected Google Calendar yet. Clicking Connect starts OAuth immediately.
 */
export function ReconnectBanner({ userRole }: { userRole: string }) {
  const pathname = usePathname();
  const canConnect = canConnectGoogleCalendar(userRole);
  const { data } = useGoogleStatus({ enabled: canConnect });

  const personalBroken = data?.status === "needs_reconnect";
  const platformBroken = userRole === "super_admin" && data?.platform?.status === "needs_reconnect";
  const onIntegrations = !!data && pathname === data.integrationsPath;
  const onHome = isPortalHomePath(pathname, userRole);

  if (!canConnect || !data || onIntegrations) return null;

  if (platformBroken) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
        <span className="flex-1 min-w-[12rem]">
          The platform Google account ({data.platform?.googleEmail ?? data.platformEmail}) stopped working. New live
          classes will not get a Meet link until you reconnect.
        </span>
        <a
          href={connectGoogleHref(data.integrationsPath, { platform: true })}
          className="rounded-sm bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
        >
          Reconnect platform account
        </a>
      </div>
    );
  }

  if (personalBroken) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
        <span className="flex-1 min-w-[12rem]">
          Your Google Calendar connection ({data.googleEmail}) stopped working. Reconnect so class times stay on your
          calendar.
        </span>
        <a
          href={connectGoogleHref(pathname)}
          className="rounded-sm bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
        >
          Reconnect Google
        </a>
      </div>
    );
  }

  if (!onHome || !data.configured || data.connected) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-950">
      <CalendarCheck className="h-4 w-4 shrink-0 text-sky-600" />
      <span className="flex-1 min-w-[12rem]">
        Connect Google Calendar so live class times appear on your calendar. Super Admin, Manager, and Mentor create
        the classes — you only need to connect once.
      </span>
      <a
        href={connectGoogleHref(pathname)}
        className="rounded-sm bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
      >
        Connect
      </a>
    </div>
  );
}
