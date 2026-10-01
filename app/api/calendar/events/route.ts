import { NextResponse } from "next/server";
import { and, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { requireAuth, resolveOrganisationId } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { batches, liveClasses, liveCourses, studentCourses, users } from "@/lib/db/schema";
import { hasLiveAccess } from "@/lib/content-access";
import { toIstWallClock } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/calendar/events?start=ISO&end=ISO&includePast=1
 * Role-scoped FullCalendar feed. Times are IST wall-clock (no offset) so the calendar renders IST
 * on every device (the client uses timeZone "UTC" with these strings).
 *
 * Scope:
 *  super_admin / manager → everything
 *  org_admin             → classes of batches in their organisation
 *  mentor                → classes they teach or host
 *  student               → classes of live-access enrollments (own batch or course-wide)
 */
export async function GET(request: Request) {
  const { error, session } = await requireAuth(["super_admin", "manager", "org_admin", "mentor", "student"]);
  if (error) return error;
  const user = session!.user;

  const p = new URL(request.url).searchParams;
  const start = p.get("start") ? new Date(p.get("start") as string) : new Date(Date.now() - 30 * 86_400_000);
  const end = p.get("end") ? new Date(p.get("end") as string) : new Date(Date.now() + 60 * 86_400_000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }
  // Guard against huge ranges.
  if (end.getTime() - start.getTime() > 200 * 86_400_000) {
    return NextResponse.json({ error: "Range too large" }, { status: 400 });
  }
  const includePast = p.get("includePast") === "1";

  const conditions = [isNull(liveClasses.deletedAt), gte(liveClasses.scheduledAt, start), lte(liveClasses.scheduledAt, end)];
  if (!includePast) conditions.push(inArray(liveClasses.status, ["scheduled", "live"]));

  let studentEnrollments: Array<{ liveCourseId: string | null; batchId: string | null }> = [];

  if (user.role === "org_admin") {
    const orgId = await resolveOrganisationId(session!);
    if (!orgId) return NextResponse.json([]);
    const orgBatches = await db
      .select({ id: batches.id })
      .from(batches)
      .where(and(eq(batches.organisationId, orgId), isNull(batches.deletedAt)));
    if (orgBatches.length === 0) return NextResponse.json([]);
    conditions.push(inArray(liveClasses.batchId, orgBatches.map((b) => b.id)));
  } else if (user.role === "mentor") {
    conditions.push(or(eq(liveClasses.mentorId, user.id), eq(liveClasses.hostUserId, user.id))!);
  } else if (user.role === "student") {
    const rows = await db
      .select()
      .from(studentCourses)
      .where(and(eq(studentCourses.studentId, user.id), eq(studentCourses.isActive, true)));
    studentEnrollments = rows.filter((r) => r.liveCourseId && hasLiveAccess(r)).map((r) => ({ liveCourseId: r.liveCourseId, batchId: r.batchId }));
    if (studentEnrollments.length === 0) return NextResponse.json([]);
    const courseIds = Array.from(new Set(studentEnrollments.map((e) => e.liveCourseId as string)));
    const batchIds = studentEnrollments.map((e) => e.batchId).filter((b): b is string => !!b);
    conditions.push(inArray(liveClasses.courseId, courseIds));
    conditions.push(batchIds.length ? or(isNull(liveClasses.batchId), inArray(liveClasses.batchId, batchIds))! : isNull(liveClasses.batchId));
  }

  const hostUsers = alias(users, "host_users");
  const rows = await db
    .select({
      id: liveClasses.id,
      title: liveClasses.title,
      courseId: liveClasses.courseId,
      courseTitle: liveCourses.title,
      batchId: liveClasses.batchId,
      batchName: batches.name,
      mentorId: liveClasses.mentorId,
      mentorName: users.name,
      hostUserId: liveClasses.hostUserId,
      hostName: hostUsers.name,
      scheduledAt: liveClasses.scheduledAt,
      duration: liveClasses.duration,
      status: liveClasses.status,
      meetStatus: liveClasses.meetStatus,
      meetingLink: liveClasses.meetingLink,
      calendarHtmlLink: liveClasses.calendarHtmlLink,
      googleOrganizerEmail: liveClasses.googleOrganizerEmail,
      hasRecording: sql<boolean>`(${liveClasses.recordingUrl} IS NOT NULL OR ${liveClasses.recordingUrlB} IS NOT NULL OR ${liveClasses.recordingUrlC} IS NOT NULL)`,
    })
    .from(liveClasses)
    .leftJoin(liveCourses, eq(liveClasses.courseId, liveCourses.id))
    .leftJoin(batches, eq(liveClasses.batchId, batches.id))
    .leftJoin(users, eq(liveClasses.mentorId, users.id))
    .leftJoin(hostUsers, eq(liveClasses.hostUserId, hostUsers.id))
    .where(and(...conditions))
    .orderBy(liveClasses.scheduledAt)
    .limit(1000);

  // Students: a class with a batch must match one of *their* batch enrollments for that course.
  const visible =
    user.role === "student"
      ? rows.filter((r) =>
          studentEnrollments.some((e) => e.liveCourseId === r.courseId && (r.batchId === null || e.batchId === r.batchId))
        )
      : rows;

  const isStaff = user.role === "super_admin" || user.role === "manager";
  const events = visible.map((r) => {
    const startAt = r.scheduledAt;
    const endAt = new Date(startAt.getTime() + (r.duration ?? 60) * 60_000);
    const isHost = r.hostUserId === user.id || (r.hostUserId === null && r.mentorId === user.id);
    const canEdit = isStaff || (user.role === "mentor" && r.mentorId === user.id);
    return {
      id: r.id,
      title: r.title,
      start: toIstWallClock(startAt),
      end: toIstWallClock(endAt),
      backgroundColor: colorFor(r.status, r.meetStatus),
      borderColor: colorFor(r.status, r.meetStatus),
      extendedProps: {
        courseId: r.courseId,
        courseTitle: r.courseTitle,
        batchName: r.batchName,
        mentorName: r.mentorName,
        hostName: r.hostName ?? r.mentorName,
        googleOrganizerEmail: r.googleOrganizerEmail,
        status: r.status,
        meetStatus: r.meetStatus,
        duration: r.duration ?? 60,
        scheduledAtIso: startAt.toISOString(),
        hasRecording: !!r.hasRecording,
        joinUrl: `/api/live-classes/${r.id}/join`,
        icsUrl: `/api/live-classes/${r.id}/ics`,
        // Raw link only for staff and the host/mentor (students always go through the join route).
        meetingLink: isStaff || isHost || (user.role === "mentor" && r.mentorId === user.id) ? r.meetingLink : null,
        calendarHtmlLink: isHost || isStaff ? r.calendarHtmlLink : null,
        canEdit,
      },
    };
  });

  return NextResponse.json(events, { headers: { "Cache-Control": "no-store" } });
}

function colorFor(status: string | null, meetStatus: string | null): string {
  if (status === "live") return "#dc2626";
  if (status === "cancelled") return "#94a3b8";
  if (status === "completed") return "#64748b";
  if (meetStatus === "failed") return "#b45309";
  if (meetStatus === "pending") return "#d97706";
  return "#0f766e";
}
