import { NextResponse } from "next/server";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { liveCourses, recordCourses, studentCourses, slots } from "@/lib/db/schema";
import { requireAuth, resolveOrganisationId } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { error, session } = await requireAuth(["super_admin", "org_admin", "manager"]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");

  let orgId = session!.user.organisationId;
  if (session!.user.role === "org_admin") {
    orgId = (await resolveOrganisationId(session!)) ?? orgId;
  }

  const enrolledIds = studentId
    ? (
        await db
          .select({
            liveId: studentCourses.liveCourseId,
            recordId: studentCourses.recordCourseId,
          })
          .from(studentCourses)
          .where(
            and(
              eq(studentCourses.studentId, studentId),
              or(eq(studentCourses.status, "active"), eq(studentCourses.status, "paused"))
            )
          )
      ).flatMap((r) => [r.liveId, r.recordId].filter(Boolean) as string[])
    : [];

  const liveRows = await db
    .select()
    .from(liveCourses)
    .where(and(eq(liveCourses.isActive, true), isNull(liveCourses.deletedAt)));

  const recordRows = await db
    .select()
    .from(recordCourses)
    .where(and(eq(recordCourses.isActive, true), isNull(recordCourses.deletedAt)));

  let purchasedLiveIds: string[] | null = null;
  let purchasedRecordIds: string[] | null = null;

  if (session!.user.role === "org_admin" && orgId) {
    const slotRows = await db.select().from(slots).where(eq(slots.organisationId, orgId));
    purchasedLiveIds = slotRows.map((s) => s.courseId).filter(Boolean) as string[];
    purchasedRecordIds = slotRows.map((s) => s.recordCourseId).filter(Boolean) as string[];
  }

  const data = [
    ...liveRows
      .filter((c) => !purchasedLiveIds || purchasedLiveIds.includes(c.id))
      .map((c) => ({
        id: c.id,
        title: c.title,
        type: "live" as const,
        hasLive: c.hasLive ?? true,
        hasRecorded: c.hasRecorded ?? false,
        price: c.price,
        enrolled: enrolledIds.includes(c.id),
      })),
    ...recordRows
      .filter((c) => !purchasedRecordIds || purchasedRecordIds.includes(c.id))
      .map((c) => ({
        id: c.id,
        title: c.title,
        type: "record" as const,
        hasLive: c.hasLive ?? false,
        hasRecorded: c.hasRecorded ?? true,
        price: c.price,
        enrolled: enrolledIds.includes(c.id),
      })),
  ];

  return NextResponse.json({ data });
}
