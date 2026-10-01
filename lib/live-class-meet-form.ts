import type { MeetModeValue } from "@/components/live-classes/MeetModeSelector";

/** Client helpers shared by the three schedule/edit modals. */

export function isValidManualLink(link: string): boolean {
  const v = link.trim();
  if (!/^https?:\/\//i.test(v)) return false;
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fields to merge into the POST/PATCH body. `meetingLink` is kept in sync for the manual mode so
 * older readers of the payload keep working.
 */
export function meetFieldsForSubmit(meet: MeetModeValue): {
  meetMode: MeetModeValue["meetMode"];
  hostUserId?: string;
  manualMeetLink: string;
  meetingLink: string;
} {
  const manual = meet.meetMode === "manual" ? meet.manualMeetLink.trim() : "";
  return {
    meetMode: meet.meetMode,
    hostUserId: meet.hostUserId,
    manualMeetLink: manual,
    meetingLink: manual,
  };
}

/** Initial selector state when editing an existing class. */
export function meetValueFromExisting(
  existing: {
    hostUserId?: string | null;
    meetStatus?: string | null;
    meetingLink?: string | null;
    googleOrganizerEmail?: string | null;
  },
  platformEmail?: string | null
): MeetModeValue {
  const status = existing.meetStatus ?? null;
  if (status && ["created", "pending", "failed"].includes(status)) {
    const organizer = (existing.googleOrganizerEmail ?? "").trim().toLowerCase();
    const platform = (platformEmail ?? "").trim().toLowerCase();
    if (organizer && platform && organizer === platform) {
      return { meetMode: "google_platform", hostUserId: existing.hostUserId ?? undefined, manualMeetLink: "" };
    }
    return { meetMode: "google_host", hostUserId: existing.hostUserId ?? undefined, manualMeetLink: "" };
  }
  if (existing.meetingLink?.trim()) {
    return { meetMode: "manual", manualMeetLink: existing.meetingLink.trim() };
  }
  return { meetMode: "none", manualMeetLink: "" };
}
