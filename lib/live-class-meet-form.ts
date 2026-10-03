import type { MeetModeValue } from "@/components/live-classes/MeetModeSelector";
import { isAllowedMeetingLink } from "@/lib/validations";

/** Client helpers shared by the three schedule/edit modals. */

export const DEFAULT_MEET_VALUE: MeetModeValue = { meetMode: "manual", manualMeetLink: "" };

export const MANUAL_LINK_ERROR = "Use a Google Meet, Zoom, or Microsoft Teams link";

export function isValidManualLink(link: string): boolean {
  return isAllowedMeetingLink(link.trim());
}

/**
 * Fields to merge into the POST/PATCH body. `meetingLink` is kept in sync for the manual mode so
 * older readers of the payload keep working.
 */
export function meetFieldsForSubmit(meet: MeetModeValue): {
  meetMode?: MeetModeValue["meetMode"];
  hostUserId?: string;
  manualMeetLink?: string;
  meetingLink?: string;
} {
  if (meet.preserveExistingGoogle && meet.meetMode !== "manual") {
    return {};
  }
  const manual = meet.meetMode === "manual" ? meet.manualMeetLink.trim() : "";
  return {
    meetMode: meet.meetMode === "manual" ? "manual" : "google_platform",
    hostUserId: meet.meetMode === "manual" ? undefined : meet.hostUserId,
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
    const platform = (platformEmail ?? "info@lmsclasses.com").trim().toLowerCase();
    const isPlatform = !!organizer && organizer === platform;
    return {
      meetMode: "google_platform",
      hostUserId: existing.hostUserId ?? undefined,
      manualMeetLink: "",
      preserveExistingGoogle: !isPlatform,
    };
  }
  if (existing.meetingLink?.trim()) {
    return { meetMode: "manual", manualMeetLink: existing.meetingLink.trim() };
  }
  return { ...DEFAULT_MEET_VALUE };
}
