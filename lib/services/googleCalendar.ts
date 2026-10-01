import { google, type calendar_v3 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { IST_TIMEZONE } from "@/lib/utils";
import { appName } from "@/lib/mail";
import { freeBusyEnabled, getConnection, scopesGranted, GOOGLE_SCOPE_FREEBUSY, withGoogle } from "@/lib/services/googleAuth";
import { GoogleEventNotFoundError, googleErrorStatus } from "@/lib/services/googleErrors";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type LiveClassEventInput = {
  /** Stable per class version: `lms-<classId>-v<n>` so retries never create duplicate conferences. */
  requestId: string;
  lmsClassId: string;
  title: string;
  description: string;
  startAt: Date;
  durationMinutes: number;
  /** Lower-cased, de-duplicated by the caller. Host is the organizer and need not be listed. */
  attendees: string[];
  /** LMS join URL shown as the event "source" link. Never the raw Meet link. */
  lmsJoinUrl: string;
  calendarId?: string;
};

export type LiveClassEventResult = {
  eventId: string;
  calendarId: string;
  meetLink: string | null;
  htmlLink: string | null;
  /** "success" | "pending" | "failure" from Google's createRequest status, when present. */
  conferenceStatus: string | null;
};

export type BusyInterval = { start: Date; end: Date };

const DEFAULT_CALENDAR_ID = "primary";
/** Google caps attendees per event; stay well below so inserts never fail outright. */
export const MAX_EVENT_ATTENDEES = 200;

export type GoogleCallOptions = { platform?: boolean };

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function calendarFor(client: OAuth2Client): calendar_v3.Calendar {
  return google.calendar({ version: "v3", auth: client });
}

function endOf(startAt: Date, durationMinutes: number): Date {
  const minutes = Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 60;
  return new Date(startAt.getTime() + minutes * 60_000);
}

function toAttendees(emails: string[]): calendar_v3.Schema$EventAttendee[] {
  const seen = new Set<string>();
  const out: calendar_v3.Schema$EventAttendee[] = [];
  for (const raw of emails) {
    const email = (raw ?? "").trim().toLowerCase();
    if (!email || !email.includes("@") || seen.has(email)) continue;
    seen.add(email);
    out.push({ email });
    if (out.length >= MAX_EVENT_ATTENDEES) break;
  }
  return out;
}

export function extractMeetLink(event: calendar_v3.Schema$Event | null | undefined): string | null {
  if (!event) return null;
  if (event.hangoutLink) return event.hangoutLink;
  const video = event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video" && e.uri);
  return video?.uri ?? null;
}

function toResult(event: calendar_v3.Schema$Event, calendarId: string): LiveClassEventResult {
  if (!event.id) throw new Error("Google returned an event without an id.");
  return {
    eventId: event.id,
    calendarId,
    meetLink: extractMeetLink(event),
    htmlLink: event.htmlLink ?? null,
    conferenceStatus: event.conferenceData?.createRequest?.status?.statusCode ?? null,
  };
}

function buildBody(input: LiveClassEventInput, options: { withConference: boolean }): calendar_v3.Schema$Event {
  const start = input.startAt;
  const end = endOf(start, input.durationMinutes);
  const body: calendar_v3.Schema$Event = {
    summary: input.title,
    description: input.description,
    start: { dateTime: start.toISOString(), timeZone: IST_TIMEZONE },
    end: { dateTime: end.toISOString(), timeZone: IST_TIMEZONE },
    attendees: toAttendees(input.attendees),
    guestsCanInviteOthers: false,
    guestsCanModify: false,
    guestsCanSeeOtherGuests: false,
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 60 },
        { method: "popup", minutes: 10 },
      ],
    },
    source: { title: appName, url: input.lmsJoinUrl },
    extendedProperties: { private: { lmsClassId: input.lmsClassId } },
  };
  if (options.withConference) {
    body.conferenceData = {
      createRequest: {
        requestId: input.requestId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }
  return body;
}

function isGone(err: unknown): boolean {
  const status = googleErrorStatus(err);
  return status === 404 || status === 410;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Creates the calendar event with a Google Meet conference on the host's primary calendar and
 * emails invites to attendees (`sendUpdates: all`).
 */
export async function createLiveClassEvent(
  hostUserId: string,
  input: LiveClassEventInput,
  options: GoogleCallOptions = {}
): Promise<LiveClassEventResult> {
  const calendarId = input.calendarId ?? DEFAULT_CALENDAR_ID;
  return withGoogle(hostUserId, async (client) => {
    const res = await calendarFor(client).events.insert({
      calendarId,
      conferenceDataVersion: 1,
      sendUpdates: "all",
      requestBody: buildBody(input, { withConference: true }),
    });
    return toResult(res.data, calendarId);
  }, options);
}

/** Re-reads an event (used when Meet creation came back as "pending"). */
export async function getLiveClassEvent(
  hostUserId: string,
  eventId: string,
  calendarId = DEFAULT_CALENDAR_ID,
  options: GoogleCallOptions = {}
): Promise<LiveClassEventResult> {
  return withGoogle(hostUserId, async (client) => {
    try {
      const res = await calendarFor(client).events.get({ calendarId, eventId });
      return toResult(res.data, calendarId);
    } catch (err) {
      if (isGone(err)) throw new GoogleEventNotFoundError(eventId);
      throw err;
    }
  }, options);
}

/**
 * Patches title/time/description/attendees on the existing event. The Meet link is preserved —
 * reschedules never create a new conference.
 */
export async function updateLiveClassEvent(
  hostUserId: string,
  eventId: string,
  input: LiveClassEventInput,
  options: GoogleCallOptions = {}
): Promise<LiveClassEventResult> {
  const calendarId = input.calendarId ?? DEFAULT_CALENDAR_ID;
  return withGoogle(hostUserId, async (client) => {
    try {
      const body = buildBody(input, { withConference: false });
      const res = await calendarFor(client).events.patch({
        calendarId,
        eventId,
        conferenceDataVersion: 1,
        sendUpdates: "all",
        requestBody: body,
      });
      return toResult(res.data, calendarId);
    } catch (err) {
      if (isGone(err)) throw new GoogleEventNotFoundError(eventId);
      throw err;
    }
  }, options);
}

/** Deletes the event and notifies attendees. Already-deleted events are treated as success. */
export async function cancelLiveClassEvent(
  hostUserId: string,
  eventId: string,
  calendarId = DEFAULT_CALENDAR_ID,
  options: GoogleCallOptions = {}
): Promise<void> {
  await withGoogle(hostUserId, async (client) => {
    try {
      await calendarFor(client).events.delete({ calendarId, eventId, sendUpdates: "all" });
    } catch (err) {
      if (isGone(err)) return;
      throw err;
    }
  }, options);
}

/** Replaces the attendee list (enrollment add/remove/pause). */
export async function syncEventAttendees(
  hostUserId: string,
  eventId: string,
  attendees: string[],
  calendarId = DEFAULT_CALENDAR_ID,
  options: GoogleCallOptions = {}
): Promise<LiveClassEventResult> {
  return withGoogle(hostUserId, async (client) => {
    try {
      const res = await calendarFor(client).events.patch({
        calendarId,
        eventId,
        sendUpdates: "all",
        requestBody: { attendees: toAttendees(attendees) },
      });
      return toResult(res.data, calendarId);
    } catch (err) {
      if (isGone(err)) throw new GoogleEventNotFoundError(eventId);
      throw err;
    }
  }, options);
}

/**
 * Host conflict check against Google (only when ENABLE_FREEBUSY=true and the host granted the
 * freebusy scope). Returns null when the check is unavailable so callers fall back to LMS data.
 */
export async function checkHostBusy(hostUserId: string, start: Date, end: Date): Promise<BusyInterval[] | null> {
  if (!freeBusyEnabled()) return null;
  const connection = await getConnection(hostUserId);
  if (!connection || connection.status !== "active") return null;
  if (!scopesGranted(connection.scopes, [GOOGLE_SCOPE_FREEBUSY])) return null;

  return withGoogle(hostUserId, async (client) => {
    const res = await calendarFor(client).freebusy.query({
      requestBody: {
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        timeZone: IST_TIMEZONE,
        items: [{ id: DEFAULT_CALENDAR_ID }],
      },
    });
    const busy = res.data.calendars?.[DEFAULT_CALENDAR_ID]?.busy ?? [];
    return busy
      .filter((b) => b.start && b.end)
      .map((b) => ({ start: new Date(b.start as string), end: new Date(b.end as string) }));
  });
}
