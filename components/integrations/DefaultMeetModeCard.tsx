"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGoogleStatus } from "@/lib/hooks/useGoogle";

export function DefaultMeetModeCard() {
  const { data } = useGoogleStatus();
  const email = data?.platformEmail ?? "info@lmsclasses.com";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Default live class host</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          New classes use the platform Google account ({email}) unless the scheduler pastes a meeting link.
        </p>
        <p className="text-sm font-medium">Platform account ({email})</p>
        <p className="text-xs text-muted-foreground">One calendar hosts every class. Mentors are invited as attendees.</p>
      </CardContent>
    </Card>
  );
}
