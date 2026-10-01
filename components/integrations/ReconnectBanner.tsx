"use client";

import { usePathname } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { connectGoogleHref, useGoogleStatus } from "@/lib/hooks/useGoogle";
import { canHostLiveClass } from "@/lib/utils";

/**
 * Portal-wide warning shown to hosts whose Google connection needs a reconnect.
 * Rendered inside PortalLayout; students and HR skip the query entirely.
 */
export function ReconnectBanner({ userRole }: { userRole: string }) {
  const pathname = usePathname();
  const canHost = canHostLiveClass(userRole);
  const { data } = useGoogleStatus({ enabled: canHost });

  const personalBroken = data?.status === "needs_reconnect";
  const platformBroken = userRole === "super_admin" && data?.platform?.status === "needs_reconnect";
  if (!canHost || !data || (!personalBroken && !platformBroken)) return null;
  // The integrations page already shows the full card.
  if (pathname === data.integrationsPath) return null;

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

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
      <span className="flex-1 min-w-[12rem]">
        Your Google Calendar connection ({data.googleEmail}) stopped working. New live classes you host will not get a
        Meet link until you reconnect.
      </span>
      <a
        href={connectGoogleHref(data.integrationsPath)}
        className="rounded-sm bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
      >
        Reconnect Google
      </a>
    </div>
  );
}
