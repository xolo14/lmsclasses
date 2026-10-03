"use client";

import { useCallback, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventSourceFuncArg } from "@fullcalendar/core";
import { EventDetailDialog, type CalendarEventProps, type CalendarEventSummary } from "@/components/calendar/EventDetailDialog";
import { toIstWallClock } from "@/lib/utils";

type Props = {
  role: string;
  /** Live-classes list for the "Manage" button (staff/mentor). */
  editHref?: string;
  /** Mentor/staff toggle: show completed + cancelled classes too. */
  includePast: boolean;
};

/**
 * FullCalendar wrapper. The feed returns IST wall-clock strings without an offset and we render
 * with timeZone "UTC", so every viewer sees IST regardless of their device zone. The "now" line is
 * shifted the same way.
 */
export function LmsCalendar({ role, editHref, includePast }: Props) {
  const [selected, setSelected] = useState<CalendarEventSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(
    async (info: EventSourceFuncArg) => {
      // info.start/end are "UTC" instants for IST wall-clock; widen by a day so edges are safe.
      const start = new Date(info.start.getTime() - 86_400_000).toISOString();
      const end = new Date(info.end.getTime() + 86_400_000).toISOString();
      const params = new URLSearchParams({ start, end });
      if (includePast) params.set("includePast", "1");
      const res = await fetch(`/api/calendar/events?${params}`, { cache: "no-store" });
      if (!res.ok) {
        setError("Could not load classes.");
        return [];
      }
      setError(null);
      return (await res.json()) as unknown[];
    },
    [includePast]
  );

  const onEventClick = (arg: EventClickArg) => {
    setSelected({
      id: arg.event.id,
      title: arg.event.title,
      props: arg.event.extendedProps as CalendarEventProps,
    });
  };

  return (
    <div className="lms-calendar rounded-lg border border-swiss-black/10 bg-swiss-white p-2 sm:p-4">
      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
      <FullCalendar
        key={includePast ? "all" : "upcoming"}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
        }}
        timeZone="UTC"
        now={() => toIstWallClock(new Date())}
        nowIndicator
        height="auto"
        expandRows
        slotMinTime="06:00:00"
        slotMaxTime="23:00:00"
        scrollTime="09:00:00"
        allDaySlot={false}
        navLinks
        dayMaxEvents={3}
        eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
        events={fetchEvents}
        eventClick={onEventClick}
        eventDisplay="block"
      />
      <p className="mt-2 text-xs text-muted-foreground">All times are IST (Asia/Kolkata).</p>
      <EventDetailDialog event={selected} onOpenChange={(o) => !o && setSelected(null)} editHref={editHref} role={role} />
    </div>
  );
}
