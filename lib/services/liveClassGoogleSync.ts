import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  batches,
  liveClasses,
  liveCourses,
  studentCourses,
  users,
  type LiveClass,
  type Role,
} from "@/lib/db/schema";
import { hasLiveAccess } from "@/lib/content-access";
import { logAction } from "@/lib/audit";
import { getAppUrl } from "@/lib/app-url";
import { formatDateTime, integrationsPathForRole, ROLE_ROUTES } from "@/lib/utils";
import { getConnection, getPlatformConnection } from "@/lib/services/googleAuth";
import { getPlatformGoogleEmail, isPlatformGoogleEmail } from "@/lib/google-platform";
import {
  cancelLiveClassEvent,
  createLiveClassCalendarEvent,
  createLiveClassEvent,
  getLiveClassEvent,
  syncEventAttendees,
  updateLiveClassEvent,
  type LiveClassEventInput,
  type LiveClassEventResult,
} from "@/lib/services/googleCalendar";
import {
  GoogleEventNotFoundError,
  GoogleNotConnectedError,
  GoogleReconnectRequiredError,
  describeGoogleError,
  scrubGoogleError,
} from "@/lib/services/googleErrors";
import { getLiveClassEmailPrefs } from "@/lib/live-class-email-prefs";
import { notifyStudentsLiveClassMeetingLink } from "@/lib/live-class-whatsapp";
import {
  sendGoogleHostConnectEmail,
  sendGoogleMeetFailureEmail,
  sendLiveClassScheduledEmail,
} from "@/lib/email";

/**
 * Glue between live_classes rows and Google Calendar.
 *
 * Rules (see docs/GOOGLE_INTEGRATION.md):
 *  - The LMS row is always written first; Google is a side effect that may fail.
 *  - Never run inside a DB transaction (neon-http has none anyway).
 *  - requestId = lms-<classId>-v<googleRequestVersion> so retries never duplicate conferences.
 *  - Students get the LMS join URL, never the raw Meet link.
 *
 * Extension point (OFF): verified attendance via Google Meet REST API
 * (`conferenceRecords.participants`, scope meetings.space.readonly) could be reconciled against
 * live_class_attendance here after the class ends.
 */

export const MAX_MEET_RETRIES = 5;

type Actor = { id: string; role: Role } | null;

export function requestIdFor(classId: string, version: number): string {
  return `lms-${classId}-v${version}`;
}

export function joinUrlFor(classId: string): string {
  return `${getAppUrl()}/api/live-classes/${classId}/join`;
}

export function meetModeUsesGoogle(mode: string | null | undefined): boolean {
  return mode === "google_platform" || mode === "google_host" || mode === "google_scheduler";
}

export function classUsesPlatformHost(cls: Pick<LiveClass, "googleOrganizerEmail">): boolean {
  return isPlatformGoogleEmail(cls.googleOrganizerEmail);
}

async function googleActor(cls: Pick<LiveClass, "hostUserId" | "googleOrganizerEmail">): Promise<{
  userId: string;
  platform: boolean;
}> {
  if (classUsesPlatformHost(cls)) {
    const platform = await getPlatformConnection();
    if (!platform) throw new GoogleNotConnectedError(cls.hostUserId ?? "platform");
    return { userId: platform.userId, platform: true };
  }
  if (!cls.hostUserId) throw new GoogleNotConnectedError("host");
  return { userId: cls.hostUserId, platform: false };
}

/* ------------------------------------------------------------------ */
/* Data helpers                                                        */
/* ------------------------------------------------------------------ */

type ClassContext = {
  cls: LiveClass;
  course: { title: string } | null;
  batch: { name: string; organisationId: string | null } | null;
  mentor: { id: string; name: string; email: string; role: Role } | null;
  host: { id: string; name: string; email: string; role: Role } | null;
};

async function loadContext(classId: string, opts: { includeDeleted?: boolean } = {}): Promise<ClassContext | null> {
  const where = opts.includeDeleted ? eq(liveClasses.id, classId) : and(eq(liveClasses.id, classId), isNull(liveClasses.deletedAt));
  const [cls] = await db.select().from(liveClasses).where(where).limit(1);
  if (!cls) return null;

  const userCols = { id: users.id, name: users.name, email: users.email, role: users.role };
  const [[course], [batch], [mentor], [host]] = await Promise.all([
    db.select({ title: liveCourses.title }).from(liveCourses).where(eq(liveCourses.id, cls.courseId)).limit(1),
    cls.batchId
      ? db.select({ name: batches.name, organisationId: batches.organisationId }).from(batches).where(eq(batches.id, cls.batchId)).limit(1)
      : Promise.resolve([] as Array<{ name: string; organisationId: string | null }>),
    db.select(userCols).from(users).where(eq(users.id, cls.mentorId)).limit(1),
    cls.hostUserId
      ? db.select(userCols).from(users).where(eq(users.id, cls.hostUserId)).limit(1)
      : Promise.resolve([] as Array<{ id: string; name: string; email: string; role: Role }>),
  ]);

  return { cls, course: course ?? null, batch: batch ?? null, mentor: mentor ?? null, host: host ?? null };
}

type AttendeeStudent = { id: string; name: string; email: string; phone: string | null; organisationId: string | null };

/** Students with live access for this class (same batch when the class has one). */
export async function collectStudentAttendees(cls: Pick<LiveClass, "courseId" | "batchId">): Promise<AttendeeStudent[]> {
  const conditions = [
    eq(studentCourses.liveCourseId, cls.courseId),
    eq(studentCourses.isActive, true),
    eq(users.role, "student"),
    isNull(users.deletedAt),
  ];
  if (cls.batchId) conditions.push(eq(studentCourses.batchId, cls.batchId));

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      userActive: users.isActive,
      organisationId: studentCourses.organisationId,
      isActive: studentCourses.isActive,
      status: studentCourses.status,
      liveAccess: studentCourses.liveAccess,
      liveAccessFrom: studentCourses.liveAccessFrom,
      liveAccessUntil: studentCourses.liveAccessUntil,
    })
    .from(studentCourses)
    .innerJoin(users, eq(users.id, studentCourses.studentId))
    .where(and(...conditions));

  const seen = new Set<string>();
  const out: AttendeeStudent[] = [];
  for (const r of rows) {
    if (r.userActive === false) continue;
    if (!hasLiveAccess(r)) continue;
    const email = r.email?.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({ id: r.id, name: r.name, email, phone: r.phone, organisationId: r.organisationId ?? null });
  }
  return out;
}

function attendeeEmails(ctx: ClassContext, students: AttendeeStudent[]): string[] {
  const emails = students.map((s) => s.email);
  const mentorEmail = ctx.mentor?.email?.trim();
  if (classUsesPlatformHost(ctx.cls) && mentorEmail) {
    emails.push(mentorEmail);
  } else if (ctx.mentor && ctx.host && ctx.mentor.id !== ctx.host.id && mentorEmail) {
    emails.push(mentorEmail);
  }
  return emails;
}

function buildDescription(ctx: ClassContext, joinUrl: string): string {
  const pasted = ctx.cls.meetStatus === "manual" ? ctx.cls.meetingLink?.trim() : "";
  const lines = [
    `Course: ${ctx.course?.title ?? "Live course"}`,
    ctx.batch ? `Batch: ${ctx.batch.name}` : null,
    ctx.mentor ? `Mentor: ${ctx.mentor.name}` : null,
    classUsesPlatformHost(ctx.cls) ? `Meet host: ${getPlatformGoogleEmail()}` : null,
    pasted ? `Meeting link: ${pasted}` : null,
    "",
    `Join from your LMS (records attendance): ${joinUrl}`,
    "",
    "The LMS join button opens 10 minutes before the class starts.",
  ];
  return lines.filter((l) => l !== null).join("\n");
}

function eventInput(ctx: ClassContext, students: AttendeeStudent[]): LiveClassEventInput {
  const joinUrl = joinUrlFor(ctx.cls.id);
  const pasted = ctx.cls.meetStatus === "manual" ? ctx.cls.meetingLink?.trim() : "";
  return {
    requestId: requestIdFor(ctx.cls.id, ctx.cls.googleRequestVersion ?? 1),
    lmsClassId: ctx.cls.id,
    title: ctx.cls.title,
    description: buildDescription(ctx, joinUrl),
    startAt: ctx.cls.scheduledAt,
    durationMinutes: ctx.cls.duration ?? 60,
    attendees: attendeeEmails(ctx, students),
    lmsJoinUrl: joinUrl,
    location: pasted || undefined,
    calendarId: classUsesPlatformHost(ctx.cls) ? "primary" : ctx.cls.googleCalendarId ?? "primary",
  };
}

function classPathForRole(role: Role | null | undefined): string {
  const base = role && ROLE_ROUTES[role] ? ROLE_ROUTES[role] : "/super-admin";
  return `${base}/live-classes`;
}

function isUpcoming(cls: Pick<LiveClass, "scheduledAt" | "duration">): boolean {
  const end = cls.scheduledAt.getTime() + (cls.duration ?? 60) * 60_000;
  return end > Date.now();
}

async function audit(action: string, classId: string, actor: Actor, metadata?: Record<string, unknown>) {
  void logAction({
    userId: actor?.id,
    role: actor?.role,
    action,
    entity: "LiveClass",
    entityId: classId,
    metadata,
  });
}

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

export type SyncOutcome =
  | { ok: true; meetLink: string | null; eventId: string }
  | { ok: false; reason: "no_class" | "no_host" | "host_not_connected" | "failed" | "skipped"; message: string };

/**
 * Creates the Google event + Meet for a class whose meet_status is pending/failed.
 * Updates the row afterwards; never throws.
 */
export async function createForClass(
  classId: string,
  opts: { actor?: Actor; notify?: boolean } = {}
): Promise<SyncOutcome> {
  const actor = opts.actor ?? null;
  const ctx = await loadContext(classId);
  if (!ctx) return { ok: false, reason: "no_class", message: "Class not found" };
  const { cls } = ctx;

  if (!["pending", "failed"].includes(cls.meetStatus)) {
    return { ok: false, reason: "skipped", message: `meet_status is ${cls.meetStatus}` };
  }
  if (cls.status === "cancelled" || cls.status === "completed") {
    return { ok: false, reason: "skipped", message: `class is ${cls.status}` };
  }
  if (!cls.hostUserId || !ctx.host) {
    await db
      .update(liveClasses)
      .set({ meetStatus: "failed", meetError: "No host selected for the Google event.", lastAttemptAt: new Date() })
      .where(eq(liveClasses.id, classId));
    return { ok: false, reason: "no_host", message: "No host" };
  }

  if (classUsesPlatformHost(cls)) {
    const platform = await getPlatformConnection();
    if (!platform || platform.status !== "active") {
      const message =
        platform?.status === "needs_reconnect"
          ? `Platform Google account (${getPlatformGoogleEmail()}) must be reconnected before the Meet link can be created.`
          : `Platform Google account (${getPlatformGoogleEmail()}) is not connected.`;
      await db
        .update(liveClasses)
        .set({ meetStatus: "failed", meetError: message, lastAttemptAt: new Date() })
        .where(eq(liveClasses.id, classId));
      void notifyPlatformHostUnavailable(ctx, message).catch(() => {});
      await audit("live_class.meet_waiting_host", classId, actor, { platform: true, message });
      return { ok: false, reason: "host_not_connected", message };
    }
  } else {
    // Cheap pre-check so a disconnected host does not burn retries.
    const connection = await getConnection(cls.hostUserId);
    if (!connection || connection.status !== "active") {
      const message =
        connection?.status === "needs_reconnect"
          ? `${ctx.host.name} must reconnect Google before the Meet link can be created.`
          : `${ctx.host.name} has not connected Google yet.`;
      const firstTime = cls.meetError === null && cls.retryCount === 0;
      await db
        .update(liveClasses)
        .set({ meetStatus: "pending", meetError: message, lastAttemptAt: new Date() })
        .where(eq(liveClasses.id, classId));
      if (firstTime) {
        void sendGoogleHostConnectEmail({
          email: ctx.host.email,
          name: ctx.host.name,
          classTitle: cls.title,
          scheduledAt: formatDateTime(cls.scheduledAt),
          integrationsPath: integrationsPathForRole(ctx.host.role),
        }).catch((err) => console.error("[google-sync] host connect email failed", err instanceof Error ? err.message : err));
        await audit("live_class.meet_waiting_host", classId, actor, { hostUserId: cls.hostUserId });
      }
      return { ok: false, reason: "host_not_connected", message };
    }
  }

  const students = await collectStudentAttendees(cls);

  try {
    const actorGoogle = await googleActor(cls);
    const callOpts = { platform: actorGoogle.platform };
    let result = await createLiveClassEvent(actorGoogle.userId, eventInput(ctx, students), callOpts);
    if (!result.meetLink && result.conferenceStatus === "pending") {
      // Google occasionally finalizes the conference a moment later.
      await new Promise((r) => setTimeout(r, 2_500));
      try {
        result = await getLiveClassEvent(actorGoogle.userId, result.eventId, result.calendarId, callOpts);
      } catch {
        /* keep the insert result */
      }
    }
    await persistCreated(classId, result, cls);
    await audit("live_class.meet_created", classId, actor, {
      eventId: result.eventId,
      hostUserId: cls.hostUserId,
      organizer: cls.googleOrganizerEmail,
      attendees: students.length,
      meetLink: !!result.meetLink,
    });

    if (opts.notify !== false && result.meetLink) {
      void notifyAfterMeetReady(classId).catch((err) =>
        console.error("[google-sync] notify failed", err instanceof Error ? err.message : err)
      );
    }
    return { ok: true, meetLink: result.meetLink, eventId: result.eventId };
  } catch (err) {
    return handleCreateFailure(ctx, err, actor);
  }
}

async function persistCreated(classId: string, result: LiveClassEventResult, cls: LiveClass) {
  const now = new Date();
  await db
    .update(liveClasses)
    .set({
      googleEventId: result.eventId,
      googleCalendarId: result.calendarId,
      calendarHtmlLink: result.htmlLink,
      meetingLink: result.meetLink,
      meetStatus: result.meetLink ? "created" : "pending",
      meetError: result.meetLink ? null : "Google is still provisioning the Meet link.",
      googleOrganizerEmail: cls.googleOrganizerEmail ?? (classUsesPlatformHost(cls) ? getPlatformGoogleEmail() : null),
      googleSyncedAt: now,
      lastAttemptAt: now,
    })
    .where(eq(liveClasses.id, classId));
}

async function handleCreateFailure(ctx: ClassContext, err: unknown, actor: Actor): Promise<SyncOutcome> {
  const { cls } = ctx;
  const now = new Date();

  if (err instanceof GoogleNotConnectedError || err instanceof GoogleReconnectRequiredError) {
    const message = describeGoogleError(err);
    const platform = classUsesPlatformHost(cls);
    await db
      .update(liveClasses)
      .set({ meetStatus: platform ? "failed" : "pending", meetError: message, lastAttemptAt: now })
      .where(eq(liveClasses.id, cls.id));
    if (platform) void notifyPlatformHostUnavailable(ctx, message).catch(() => {});
    await audit("live_class.meet_waiting_host", cls.id, actor, { hostUserId: cls.hostUserId, platform, message });
    return { ok: false, reason: "host_not_connected", message };
  }

  const message = describeGoogleError(err);
  const retryCount = (cls.retryCount ?? 0) + 1;
  console.error("[google-sync] create failed", { classId: cls.id, retryCount, ...scrubGoogleError(err) });
  await db
    .update(liveClasses)
    .set({ meetStatus: "failed", meetError: message, retryCount, lastAttemptAt: now })
    .where(eq(liveClasses.id, cls.id));
  await audit("live_class.meet_failed", cls.id, actor, { retryCount, message });

  if (retryCount >= MAX_MEET_RETRIES) {
    void alertMeetFailure(ctx, message).catch(() => {});
  }
  return { ok: false, reason: "failed", message };
}

async function notifyPlatformHostUnavailable(ctx: ClassContext, error: string) {
  const scheduledAt = formatDateTime(ctx.cls.scheduledAt);
  const admins = await db
    .select({ email: users.email, name: users.name, role: users.role })
    .from(users)
    .where(and(eq(users.role, "super_admin"), isNull(users.deletedAt), eq(users.isActive, true)))
    .limit(8);
  for (const t of admins) {
    if (!t.email) continue;
    try {
      await sendGoogleMeetFailureEmail({
        email: t.email,
        name: t.name,
        classTitle: ctx.cls.title,
        scheduledAt,
        error,
        classPath: "/super-admin/settings/integrations",
      });
    } catch (err) {
      console.error("[google-sync] platform unavailable email failed", err instanceof Error ? err.message : err);
    }
  }
}

async function alertMeetFailure(ctx: ClassContext, error: string) {
  const scheduledAt = formatDateTime(ctx.cls.scheduledAt);
  const targets: Array<{ email: string; name: string; role: Role }> = [];
  if (ctx.host) targets.push(ctx.host);
  const admins = await db
    .select({ email: users.email, name: users.name, role: users.role })
    .from(users)
    .where(and(eq(users.role, "super_admin"), isNull(users.deletedAt), eq(users.isActive, true)))
    .limit(5);
  for (const a of admins) if (!targets.some((t) => t.email === a.email)) targets.push(a);

  for (const t of targets) {
    try {
      await sendGoogleMeetFailureEmail({
        email: t.email,
        name: t.name,
        classTitle: ctx.cls.title,
        scheduledAt,
        error,
        classPath: classPathForRole(t.role),
      });
    } catch (err) {
      console.error("[google-sync] failure alert email failed", err instanceof Error ? err.message : err);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Notifications after the Meet link exists                            */
/* ------------------------------------------------------------------ */

/**
 * WhatsApp + optional LMS emails once a link exists. Uses the LMS join URL so access and
 * attendance are enforced server-side. Safe to call for manual links too.
 */
export async function notifyAfterMeetReady(classId: string): Promise<void> {
  const ctx = await loadContext(classId);
  if (!ctx || !ctx.cls.meetingLink) return;
  const { cls } = ctx;
  const joinUrl = joinUrlFor(cls.id);
  const when = formatDateTime(cls.scheduledAt);
  const courseName = ctx.course?.title ?? "Live course";

  try {
    const wa = await notifyStudentsLiveClassMeetingLink({
      liveClassId: cls.id,
      courseId: cls.courseId,
      batchId: cls.batchId,
      title: cls.title,
      scheduledAt: cls.scheduledAt,
      meetingLink: joinUrl,
    });
    console.log("[google-sync] WhatsApp notify:", { sent: wa.sent, failed: wa.failed, skippedNoPhone: wa.skippedNoPhone });
  } catch (err) {
    console.error("[google-sync] WhatsApp notify failed", err instanceof Error ? err.message : err);
  }

  // Host / mentor email (branded) — honours org / system preference.
  const hostPrefs = await getLiveClassEmailPrefs(ctx.batch?.organisationId ?? null);
  const hostTargets = new Map<string, { name: string; isHost: boolean }>();
  if (ctx.host?.email) hostTargets.set(ctx.host.email, { name: ctx.host.name, isHost: true });
  if (ctx.mentor?.email && !hostTargets.has(ctx.mentor.email)) hostTargets.set(ctx.mentor.email, { name: ctx.mentor.name, isHost: false });
  if (hostPrefs.emailMentor) {
    for (const [email, t] of hostTargets) {
      try {
        await sendLiveClassScheduledEmail({
          email,
          name: t.name,
          classTitle: cls.title,
          courseName,
          batchName: ctx.batch?.name ?? null,
          scheduledAt: when,
          durationMinutes: cls.duration,
          joinUrl,
          calendarHtmlLink: cls.calendarHtmlLink,
          isHost: t.isHost,
        });
      } catch (err) {
        console.error("[google-sync] host email failed", err instanceof Error ? err.message : err);
      }
    }
  }

  // Student emails — default off (Google already sent the invite); per-organisation preference.
  const students = await collectStudentAttendees(cls);
  const prefsByOrg = new Map<string, boolean>();
  const started = Date.now();
  for (const s of students) {
    if (Date.now() - started > 45_000) break;
    const key = s.organisationId ?? "__system__";
    let allowed = prefsByOrg.get(key);
    if (allowed === undefined) {
      allowed = (await getLiveClassEmailPrefs(s.organisationId)).emailStudents;
      prefsByOrg.set(key, allowed);
    }
    if (!allowed) continue;
    try {
      await sendLiveClassScheduledEmail({
        email: s.email,
        name: s.name,
        classTitle: cls.title,
        courseName,
        batchName: ctx.batch?.name ?? null,
        scheduledAt: when,
        durationMinutes: cls.duration,
        joinUrl,
      });
    } catch (err) {
      console.error("[google-sync] student email failed", err instanceof Error ? err.message : err);
    }
  }
}

/**
 * Puts a pasted Zoom/Teams/Meet link on the platform Google Calendar and invites
 * enrolled students. Does not create a new Google Meet. Never throws.
 */
export async function syncManualCalendarForClass(
  classId: string,
  opts: { actor?: Actor } = {}
): Promise<SyncOutcome> {
  const actor = opts.actor ?? null;
  const ctx = await loadContext(classId);
  if (!ctx) return { ok: false, reason: "no_class", message: "Class not found" };
  const { cls } = ctx;
  if (cls.meetStatus !== "manual" || !cls.meetingLink?.trim()) {
    return { ok: false, reason: "skipped", message: "Not a pasted meeting link" };
  }
  if (cls.status === "cancelled" || cls.status === "completed") {
    return { ok: false, reason: "skipped", message: `class is ${cls.status}` };
  }

  const platform = await getPlatformConnection();
  if (!platform || platform.status !== "active") {
    const message =
      platform?.status === "needs_reconnect"
        ? `Platform Google account (${getPlatformGoogleEmail()}) must be reconnected before calendar invites can be sent.`
        : `Platform Google account (${getPlatformGoogleEmail()}) is not connected. The class is saved; students still see it in the LMS calendar.`;
    await db.update(liveClasses).set({ meetError: message, lastAttemptAt: new Date() }).where(eq(liveClasses.id, classId));
    await audit("live_class.manual_calendar_skipped", classId, actor, { message });
    return { ok: false, reason: "host_not_connected", message };
  }

  const hosted = {
    ...ctx,
    cls: { ...cls, googleOrganizerEmail: getPlatformGoogleEmail(), hostUserId: cls.hostUserId ?? cls.mentorId },
  };
  const students = await collectStudentAttendees(cls);
  const input = eventInput(hosted, students);
  const callOpts = { platform: true };

  try {
    let result: LiveClassEventResult;
    if (cls.googleEventId) {
      try {
        result = await updateLiveClassEvent(platform.userId, cls.googleEventId, input, callOpts);
      } catch (err) {
        if (!(err instanceof GoogleEventNotFoundError)) throw err;
        result = await createLiveClassCalendarEvent(platform.userId, input, callOpts);
      }
    } else {
      result = await createLiveClassCalendarEvent(platform.userId, input, callOpts);
    }

    const now = new Date();
    await db
      .update(liveClasses)
      .set({
        googleEventId: result.eventId,
        googleCalendarId: result.calendarId,
        calendarHtmlLink: result.htmlLink,
        googleOrganizerEmail: getPlatformGoogleEmail(),
        hostUserId: cls.hostUserId ?? cls.mentorId,
        meetingLink: cls.meetingLink,
        meetStatus: "manual",
        meetError: null,
        googleSyncedAt: now,
        lastAttemptAt: now,
      })
      .where(eq(liveClasses.id, classId));
    await audit("live_class.manual_calendar_synced", classId, actor, {
      eventId: result.eventId,
      attendees: students.length,
    });
    return { ok: true, meetLink: cls.meetingLink, eventId: result.eventId };
  } catch (err) {
    const message = describeGoogleError(err);
    console.error("[google-sync] manual calendar failed", { classId, ...scrubGoogleError(err) });
    await db.update(liveClasses).set({ meetError: message, lastAttemptAt: new Date() }).where(eq(liveClasses.id, classId));
    await audit("live_class.manual_calendar_failed", classId, actor, { message });
    return { ok: false, reason: "failed", message };
  }
}

/* ------------------------------------------------------------------ */
/* Update                                                              */
/* ------------------------------------------------------------------ */

export type PreviousClassState = Pick<
  LiveClass,
  "hostUserId" | "scheduledAt" | "duration" | "title" | "batchId" | "courseId" | "meetStatus" | "googleEventId" | "googleOrganizerEmail" | "googleCalendarId"
>;

/**
 * After a PATCH: patch the Google event (same Meet link) or, when the host changed, cancel the
 * old event and create a new one. Pending/failed classes are simply (re)created.
 */
export async function updateForClass(classId: string, previous: PreviousClassState, opts: { actor?: Actor } = {}): Promise<SyncOutcome> {
  const actor = opts.actor ?? null;
  const ctx = await loadContext(classId);
  if (!ctx) return { ok: false, reason: "no_class", message: "Class not found" };
  const { cls } = ctx;

  if (!["created", "pending", "failed"].includes(cls.meetStatus)) {
    return { ok: false, reason: "skipped", message: `meet_status is ${cls.meetStatus}` };
  }

  const hostChanged =
    (!!previous.hostUserId && !!cls.hostUserId && previous.hostUserId !== cls.hostUserId) ||
    (previous.googleOrganizerEmail ?? "") !== (cls.googleOrganizerEmail ?? "");

  if (cls.meetStatus !== "created" || !cls.googleEventId) {
    return createForClass(classId, { actor });
  }

  if (hostChanged) {
    if (previous.googleEventId && previous.hostUserId) {
      try {
        const prevActor = await googleActor(previous);
        await cancelLiveClassEvent(
          prevActor.userId,
          previous.googleEventId,
          previous.googleCalendarId ?? cls.googleCalendarId ?? "primary",
          { platform: prevActor.platform }
        );
      } catch (err) {
        console.warn("[google-sync] cancel old host event failed", scrubGoogleError(err).message);
      }
    }
    await db
      .update(liveClasses)
      .set({
        googleEventId: null,
        calendarHtmlLink: null,
        meetingLink: null,
        meetStatus: "pending",
        meetError: null,
        retryCount: 0,
        googleRequestVersion: sql`${liveClasses.googleRequestVersion} + 1`,
      })
      .where(eq(liveClasses.id, classId));
    await audit("live_class.meet_host_changed", classId, actor, { from: previous.hostUserId, to: cls.hostUserId });
    return createForClass(classId, { actor });
  }

  if (!cls.hostUserId) return { ok: false, reason: "no_host", message: "No host" };

  const students = await collectStudentAttendees(cls);
  try {
    const actorGoogle = await googleActor(cls);
    const result = await updateLiveClassEvent(
      actorGoogle.userId,
      cls.googleEventId,
      eventInput(ctx, students),
      { platform: actorGoogle.platform }
    );
    const now = new Date();
    await db
      .update(liveClasses)
      .set({
        calendarHtmlLink: result.htmlLink ?? cls.calendarHtmlLink,
        meetingLink: result.meetLink ?? cls.meetingLink,
        meetStatus: "created",
        meetError: null,
        googleSyncedAt: now,
        lastAttemptAt: now,
      })
      .where(eq(liveClasses.id, classId));
    await audit("live_class.meet_updated", classId, actor, {
      eventId: result.eventId,
      rescheduled: previous.scheduledAt.getTime() !== cls.scheduledAt.getTime(),
    });
    return { ok: true, meetLink: result.meetLink ?? cls.meetingLink, eventId: result.eventId };
  } catch (err) {
    if (err instanceof GoogleEventNotFoundError) {
      // Someone deleted it in Google Calendar — recreate under a new requestId.
      await db
        .update(liveClasses)
        .set({
          googleEventId: null,
          calendarHtmlLink: null,
          meetingLink: null,
          meetStatus: "pending",
          meetError: "Google event was deleted; recreating.",
          googleRequestVersion: sql`${liveClasses.googleRequestVersion} + 1`,
        })
        .where(eq(liveClasses.id, classId));
      return createForClass(classId, { actor });
    }
    if (err instanceof GoogleNotConnectedError || err instanceof GoogleReconnectRequiredError) {
      const message = describeGoogleError(err);
      // Keep the existing link usable; flag that the invite could not be updated.
      await db.update(liveClasses).set({ meetError: message, lastAttemptAt: new Date() }).where(eq(liveClasses.id, classId));
      await audit("live_class.meet_update_blocked", classId, actor, { message });
      return { ok: false, reason: "host_not_connected", message };
    }
    const message = describeGoogleError(err);
    console.error("[google-sync] update failed", { classId, ...scrubGoogleError(err) });
    await db.update(liveClasses).set({ meetError: message, lastAttemptAt: new Date() }).where(eq(liveClasses.id, classId));
    await audit("live_class.meet_update_failed", classId, actor, { message });
    return { ok: false, reason: "failed", message };
  }
}

/* ------------------------------------------------------------------ */
/* Cancel / delete                                                     */
/* ------------------------------------------------------------------ */

/** Deletes the Google event (attendees are notified by Google). Row may already be soft-deleted. */
export async function cancelForClass(classId: string, opts: { actor?: Actor; reason?: string } = {}): Promise<void> {
  const actor = opts.actor ?? null;
  const ctx = await loadContext(classId, { includeDeleted: true });
  if (!ctx) return;
  const { cls } = ctx;
  if (!cls.googleEventId && !["created", "pending", "failed"].includes(cls.meetStatus)) return;

  if (cls.googleEventId) {
    try {
      let actorGoogle: { userId: string; platform: boolean };
      try {
        actorGoogle = await googleActor(cls);
      } catch {
        const platform = await getPlatformConnection();
        if (!platform) throw new GoogleNotConnectedError("platform");
        actorGoogle = { userId: platform.userId, platform: true };
      }
      await cancelLiveClassEvent(actorGoogle.userId, cls.googleEventId, cls.googleCalendarId ?? "primary", {
        platform: actorGoogle.platform,
      });
    } catch (err) {
      console.error("[google-sync] cancel failed", { classId, ...scrubGoogleError(err) });
      await db
        .update(liveClasses)
        .set({ meetStatus: "cancelled", meetError: `Event may still exist in Google Calendar: ${describeGoogleError(err)}`, lastAttemptAt: new Date() })
        .where(eq(liveClasses.id, classId));
      await audit("live_class.meet_cancel_failed", classId, actor, { reason: opts.reason });
      return;
    }
  }

  await db
    .update(liveClasses)
    .set({ meetStatus: "cancelled", meetError: null, googleSyncedAt: new Date(), lastAttemptAt: new Date() })
    .where(eq(liveClasses.id, classId));
  await audit("live_class.meet_cancelled", classId, actor, { reason: opts.reason, eventId: cls.googleEventId });
}

/* ------------------------------------------------------------------ */
/* Retry                                                               */
/* ------------------------------------------------------------------ */

export async function retryForClass(classId: string, opts: { actor?: Actor } = {}): Promise<SyncOutcome> {
  const [cls] = await db
    .select({
      id: liveClasses.id,
      meetStatus: liveClasses.meetStatus,
      status: liveClasses.status,
      scheduledAt: liveClasses.scheduledAt,
      duration: liveClasses.duration,
      deletedAt: liveClasses.deletedAt,
    })
    .from(liveClasses)
    .where(eq(liveClasses.id, classId))
    .limit(1);
  if (!cls || cls.deletedAt) return { ok: false, reason: "no_class", message: "Class not found" };
  if (!["pending", "failed"].includes(cls.meetStatus)) {
    return { ok: false, reason: "skipped", message: "This class is not waiting for a Meet link." };
  }
  if (!isUpcoming(cls)) return { ok: false, reason: "skipped", message: "This class has already ended." };

  // Manual retry resets the counter so the cron keeps helping afterwards.
  await db.update(liveClasses).set({ retryCount: 0 }).where(eq(liveClasses.id, classId));
  return createForClass(classId, { actor: opts.actor ?? null });
}

/** Called right after a host connects Google: pick up everything waiting on them. */
export async function retryPendingForHost(hostUserId: string): Promise<number> {
  const rows = await db
    .select({ id: liveClasses.id })
    .from(liveClasses)
    .where(
      and(
        eq(liveClasses.hostUserId, hostUserId),
        isNull(liveClasses.deletedAt),
        inArray(liveClasses.meetStatus, ["pending", "failed"]),
        inArray(liveClasses.status, ["scheduled", "live"]),
        gt(liveClasses.scheduledAt, new Date(Date.now() - 60 * 60_000))
      )
    )
    .limit(25);
  let created = 0;
  for (const row of rows) {
    await db.update(liveClasses).set({ retryCount: 0 }).where(eq(liveClasses.id, row.id));
    const outcome = await createForClass(row.id);
    if (outcome.ok) created += 1;
  }
  return created;
}

/** Called after the platform Google account is connected or reconnected. */
export async function retryPendingForPlatform(): Promise<number> {
  const email = getPlatformGoogleEmail();
  const rows = await db
    .select({ id: liveClasses.id })
    .from(liveClasses)
    .where(
      and(
        eq(liveClasses.googleOrganizerEmail, email),
        isNull(liveClasses.deletedAt),
        inArray(liveClasses.meetStatus, ["pending", "failed"]),
        inArray(liveClasses.status, ["scheduled", "live"]),
        gt(liveClasses.scheduledAt, new Date(Date.now() - 60 * 60_000))
      )
    )
    .limit(25);
  let created = 0;
  for (const row of rows) {
    await db.update(liveClasses).set({ retryCount: 0 }).where(eq(liveClasses.id, row.id));
    const outcome = await createForClass(row.id);
    if (outcome.ok) created += 1;
  }
  return created;
}

/* ------------------------------------------------------------------ */
/* Attendee sync (enrollment changes)                                  */
/* ------------------------------------------------------------------ */

/**
 * Re-sends the attendee list for every upcoming Google-backed class of a course.
 * Callers fire-and-forget; errors are logged, never thrown.
 */
export async function syncCourseAttendees(courseId: string, opts: { batchId?: string | null } = {}): Promise<{ synced: number; failed: number }> {
  const conditions = [
    eq(liveClasses.courseId, courseId),
    isNull(liveClasses.deletedAt),
    inArray(liveClasses.meetStatus, ["created", "manual"]),
    inArray(liveClasses.status, ["scheduled", "live"]),
    gt(liveClasses.scheduledAt, new Date(Date.now() - 60 * 60_000)),
  ];
  const rows = await db.select().from(liveClasses).where(and(...conditions)).limit(50);

  let synced = 0;
  let failed = 0;
  for (const cls of rows) {
    if (!isUpcoming(cls)) continue;
    // A class with a batch only cares about enrollment changes in that batch.
    if (cls.batchId && opts.batchId && cls.batchId !== opts.batchId) continue;
    if (!cls.googleEventId) continue;

    try {
      const ctx = await loadContext(cls.id);
      if (!ctx) continue;
      const students = await collectStudentAttendees(cls);
      const actorGoogle = await googleActor(cls);
      await syncEventAttendees(
        actorGoogle.userId,
        cls.googleEventId,
        attendeeEmails(ctx, students),
        cls.googleCalendarId ?? "primary",
        { platform: actorGoogle.platform }
      );
      await db.update(liveClasses).set({ googleSyncedAt: new Date() }).where(eq(liveClasses.id, cls.id));
      synced += 1;
    } catch (err) {
      failed += 1;
      if (err instanceof GoogleEventNotFoundError) {
        if (cls.meetStatus === "manual") {
          await db
            .update(liveClasses)
            .set({
              googleEventId: null,
              calendarHtmlLink: null,
              meetError: "Google Calendar event was deleted. Re-save the class to send a new invite.",
            })
            .where(eq(liveClasses.id, cls.id));
          continue;
        }
        await db
          .update(liveClasses)
          .set({
            googleEventId: null,
            calendarHtmlLink: null,
            meetingLink: null,
            meetStatus: "pending",
            meetError: "Google event was deleted; recreating.",
            googleRequestVersion: sql`${liveClasses.googleRequestVersion} + 1`,
          })
          .where(eq(liveClasses.id, cls.id));
        continue;
      }
      console.error("[google-sync] attendee sync failed", { classId: cls.id, ...scrubGoogleError(err) });
    }
  }
  return { synced, failed };
}

/* ------------------------------------------------------------------ */
/* Helpers for the API handlers                                        */
/* ------------------------------------------------------------------ */

/**
 * Decide host + initial meet_status + meeting_link for a create/update payload.
 * Authorization of `explicitHostId` is the caller's job.
 */
export function resolveMeetPlan(input: {
  meetMode: string | null | undefined;
  explicitHostId?: string | null;
  mentorId: string;
  schedulerId: string;
  manualLink?: string | null;
  legacyLink?: string | null;
}): {
  hostUserId: string | null;
  meetStatus: LiveClass["meetStatus"];
  meetingLink: string | null;
  usesGoogle: boolean;
  usesPlatform: boolean;
  googleOrganizerEmail: string | null;
} {
  const manual = (input.manualLink ?? input.legacyLink ?? "").trim() || null;
  const mode = input.meetMode ?? (manual ? "manual" : "none");
  const none = {
    hostUserId: null as string | null,
    meetStatus: "not_requested" as const,
    meetingLink: null as string | null,
    usesGoogle: false,
    usesPlatform: false,
    googleOrganizerEmail: null as string | null,
  };

  if (mode === "google_platform") {
    return {
      hostUserId: input.explicitHostId ?? input.mentorId,
      meetStatus: "pending",
      meetingLink: null,
      usesGoogle: true,
      usesPlatform: true,
      googleOrganizerEmail: getPlatformGoogleEmail(),
    };
  }
  if (mode === "google_scheduler") {
    return {
      hostUserId: input.schedulerId,
      meetStatus: "pending",
      meetingLink: null,
      usesGoogle: true,
      usesPlatform: false,
      googleOrganizerEmail: null,
    };
  }
  if (mode === "google_host") {
    return {
      hostUserId: input.explicitHostId ?? input.mentorId,
      meetStatus: "pending",
      meetingLink: null,
      usesGoogle: true,
      usesPlatform: false,
      googleOrganizerEmail: null,
    };
  }
  if (mode === "manual" && manual) {
    return {
      hostUserId: input.explicitHostId ?? input.mentorId,
      meetStatus: "manual",
      meetingLink: manual,
      usesGoogle: false,
      usesPlatform: false,
      googleOrganizerEmail: getPlatformGoogleEmail(),
    };
  }
  return none;
}
