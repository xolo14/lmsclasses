"use client";

import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { DefaultMeetModeCard } from "@/components/integrations/DefaultMeetModeCard";
import { GoogleConnectCard } from "@/components/integrations/GoogleConnectCard";
import { LiveClassEmailSettingsCard } from "@/components/integrations/LiveClassEmailSettingsCard";
import { PlatformGoogleCard } from "@/components/integrations/PlatformGoogleCard";
import { Button } from "@/components/ui/button";
import { ROLE_ROUTES } from "@/lib/utils";

type CalendarRole = "student" | "mentor" | "manager" | "org_admin" | "super_admin";

/** Settings → Integrations for every role that can connect Google Calendar. */
export function IntegrationsPage({ role }: { role: CalendarRole }) {
  const base = ROLE_ROUTES[role];
  const returnTo = `${base}/settings/integrations`;

  return (
    <div className="space-y-6 max-w-2xl w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`${base}/settings`} className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:underline">
            <ArrowLeft className="h-3 w-3" /> Settings
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold">Integrations</h1>
        </div>
        {role === "super_admin" && (
          <Button asChild variant="outline" size="sm">
            <Link href="/super-admin/integrations/google">
              <Users className="h-4 w-4 mr-1" /> All Google connections
            </Link>
          </Button>
        )}
      </div>

      {role === "super_admin" && (
        <Suspense fallback={null}>
          <PlatformGoogleCard returnTo={returnTo} />
        </Suspense>
      )}

      {role === "super_admin" && <DefaultMeetModeCard />}

      <Suspense fallback={null}>
        <GoogleConnectCard returnTo={returnTo} />
      </Suspense>

      {(role === "org_admin" || role === "super_admin") && <LiveClassEmailSettingsCard />}
    </div>
  );
}
