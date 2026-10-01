"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { LmsCalendar } from "@/components/calendar/LmsCalendar";
import { ROLE_ROUTES } from "@/lib/utils";

type CalendarRole = "super_admin" | "manager" | "org_admin" | "mentor" | "student";

const DESCRIPTIONS: Record<CalendarRole, string> = {
  super_admin: "Every scheduled live class across all courses and batches.",
  manager: "Every scheduled live class across all courses and batches.",
  org_admin: "Live classes for your organisation's batches.",
  mentor: "Classes you teach or host. Google Meet links are created automatically for connected hosts.",
  student: "Your upcoming live classes. Join opens 10 minutes before each class.",
};

export function CalendarPage({ role }: { role: CalendarRole }) {
  const [includePast, setIncludePast] = useState(false);
  const canManage = role !== "student" && role !== "org_admin";
  const editHref = canManage ? `${ROLE_ROUTES[role]}/live-classes` : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title="Calendar" description={DESCRIPTIONS[role]}>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 accent-swiss-red"
            checked={includePast}
            onChange={(e) => setIncludePast(e.target.checked)}
          />
          Show completed &amp; cancelled
        </label>
      </PageHeader>
      <LmsCalendar role={role} editHref={editHref} includePast={includePast} />
    </div>
  );
}
