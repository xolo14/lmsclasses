import { NextResponse } from "next/server";
import { and, inArray, isNull, ne, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { liveClasses } from "@/lib/db/schema";
import { parseDatetimeLocalAsIst } from "@/lib/utils";
import { collectStudentAttendees } from "@/lib/services/liveClassGoogleSync";
import { checkHostBusy } from "@/lib/services/googleCalendar";
import { scrubGoogleError } from "@/lib/services/googleErrors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/live-classes/conflicts?hostUserId&scheduledAt&duration&courseId&batchId&excludeClassId
 * Soft warning used by the schedule form: the host's overlapping LMS classes (plus Google busy
 * blocks when ENABLE_FREEBUSY=true) and how many students would be invited.
 */
export async function GET(request: Request) {
  const { error, session } = await requireAuth(["super_admin", "manager", "mentor"]);
  if (error) return error;
  const user = session!.user;

  const p = new URL(request.url).searchParams;
  const hostUserId = p.get("hostUserId")?.trim();
  const scheduledAtRaw = p.get("scheduledAt")?.trim();
  const duration = Math.max(15, Math.min(600, Number(p.get("duration") ?? 60) || 60));
  const courseId = p.get("courseId")?.trim() || null;
  const batchId = p.get("batchId")?.trim() || null;
  const excludeClassId = p.get("excludeClassId")?.trim() || null;

  const uuid = /^[0-9a-f-]{36}$/i;
  if (!hostUserId || !uuid.test(hostUserId) || !scheduledAtRaw) {
    return NextResponse.json({ error: "hostUserId and scheduledAt are required" }, { status: 400 });
  }
  if (user.role === "mentor" && hostUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const start = parseDatetimeLocalAsIst(scheduledAtRaw);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "Invalid scheduledAt" }, { status: 400 });
  }
  const end = new Date(start.getTime() + duration * 60_000);

  // Overlap: existing.start < newEnd AND existing.end > newStart. Host = hostUserId or mentorId.
  const conditions = [
    isNull(liveClasses.deletedAt),
    inArray(liveClasses.status, ["scheduled", "live"]),
    sql`(${liveClasses.hostUserId} = ${hostUserId} OR (${liveClasses.hostUserId} IS NULL AND ${liveClasses.mentorId} = ${hostUserId}))`,
    // scheduled_at is a naive timestamp holding UTC digits; cast the ISO string the same way.
    sql`${liveClasses.scheduledAt} < ${end.toISOString()}::timestamp`,
    sql`(${liveClasses.scheduledAt} + (COALESCE(${liveClasses.duration}, 60) * INTERVAL '1 minute')) > ${start.toISOString()}::timestamp`,
  ];
  if (excludeClassId && uuid.test(excludeClassId)) conditions.push(ne(liveClasses.id, excludeClassId));

  const rows = await db
    .select({ id: liveClasses.id, title: liveClasses.title, scheduledAt: liveClasses.scheduledAt, duration: liveClasses.duration })
    .from(liveClasses)
    .where(and(...conditions))
    .limit(10);

  const conflicts: Array<{ id: string; title: string; scheduledAt: string; duration: number | null; source: "lms" | "google" }> = rows.map((r) => ({
    id: r.id,
    title: r.title,
    scheduledAt: r.scheduledAt.toISOString(),
    duration: r.duration,
    source: "lms",
  }));

  // Optional Google free/busy (never blocks the form if it fails).
  try {
    const busy = await checkHostBusy(hostUserId, start, end);
    if (busy) {
      for (const b of busy) {
        // Skip blocks that are exactly one of our own LMS classes (already listed).
        const dup = rows.some((r) => Math.abs(r.scheduledAt.getTime() - b.start.getTime()) < 60_000);
        if (dup) continue;
        conflicts.push({
          id: `google-${b.start.getTime()}`,
          title: "Busy (Google Calendar)",
          scheduledAt: b.start.toISOString(),
          duration: Math.round((b.end.getTime() - b.start.getTime()) / 60_000),
          source: "google",
        });
      }
    }
  } catch (err) {
    console.warn("[conflicts] freebusy skipped", scrubGoogleError(err).message);
  }

  let attendeeCount = 0;
  if (courseId && uuid.test(courseId)) {
    try {
      attendeeCount = (await collectStudentAttendees({ courseId, batchId: batchId && uuid.test(batchId) ? batchId : null })).length;
    } catch {
      /* non-critical */
    }
  }

  return NextResponse.json({ conflicts, attendeeCount }, { headers: { "Cache-Control": "no-store" } });
}
