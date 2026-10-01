import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { publicUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { liveClassAttendance } from "@/lib/db/schema";
import { getClientIp, logAction } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { authorizeClassAccess, joinHtmlPage } from "@/lib/live-class-join";
import { formatDateTime, portalHomeForRole } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/live-classes/[id]/join
 * The only link students ever receive. Verifies enrollment + access window + time window, records
 * attendance (first click), audits, then 302s to the Meet link. Shows a self-refreshing page when
 * the Meet link is still being created or the class has not opened yet.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    const { id } = await params;
    const login = publicUrl(request, "/login");
    login.searchParams.set("callbackUrl", `/api/live-classes/${id}/join`);
    return NextResponse.redirect(login, 302);
  }
  const user = session.user;
  const { id } = await params;

  const limit = checkRateLimit(`live-class:join:${user.id}`, 30, 60_000);
  if (!limit.allowed) {
    return joinHtmlPage({ title: "Slow down", message: "Too many join attempts. Please wait a minute and try again.", refreshSec: 60 });
  }

  const decision = await authorizeClassAccess(session, id, { enforceTimeWindow: true });
  const backHref = portalHomeForRole(user.role);

  if (!decision.ok) {
    if (decision.code === "too_early") {
      return joinHtmlPage({
        title: "Not open yet",
        message: `"${decision.cls.title}" starts at ${formatDateTime(decision.cls.scheduledAt)}. The join link opens 10 minutes before the class.`,
        refreshSec: 60,
        backHref,
      });
    }
    return NextResponse.json({ error: decision.message, code: decision.code }, { status: decision.status });
  }

  const { cls } = decision;
  if (!cls.meetingLink) {
    const waiting = cls.meetStatus === "pending" || cls.meetStatus === "failed";
    return joinHtmlPage({
      title: waiting ? "Meeting link is being prepared" : "No meeting link yet",
      message: waiting
        ? `The Google Meet link for "${cls.title}" is still being created. Keep this page open — it will refresh on its own.`
        : `"${cls.title}" does not have a meeting link yet. Please check back shortly or contact your mentor.`,
      refreshSec: 30,
      backHref,
    });
  }

  if (decision.isStudent && decision.enrollmentId) {
    try {
      await db
        .insert(liveClassAttendance)
        .values({
          enrollmentId: decision.enrollmentId,
          studentId: user.id,
          liveCourseId: cls.courseId,
          liveClassId: cls.id,
          joinedAt: new Date(),
        })
        .onConflictDoNothing({ target: [liveClassAttendance.enrollmentId, liveClassAttendance.liveClassId] });
    } catch (err) {
      console.error("[join] attendance upsert failed", err instanceof Error ? err.message : err);
    }
  }

  void logAction({
    userId: user.id,
    role: user.role,
    action: "live_class.join_clicked",
    entity: "LiveClass",
    entityId: cls.id,
    metadata: { isStudent: decision.isStudent, meetStatus: cls.meetStatus },
    ipAddress: getClientIp(request),
  });

  const response = NextResponse.redirect(cls.meetingLink, 302);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
