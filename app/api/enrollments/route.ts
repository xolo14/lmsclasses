import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { listEnrollmentsForAdmin } from "@/lib/enrollment-service";
import type { EnrollmentAccessType, EnrollmentStatus } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { error, session } = await requireAuth(["super_admin", "org_admin", "manager"]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId") ?? undefined;
  const courseId = searchParams.get("courseId") ?? undefined;
  const status = searchParams.get("status") as EnrollmentStatus | null;
  const accessType = searchParams.get("accessType") as EnrollmentAccessType | null;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500);

  let orgId = searchParams.get("orgId") ?? undefined;
  if (session!.user.role === "org_admin") {
    orgId = session!.user.organisationId ?? orgId;
  }

  const rows = await listEnrollmentsForAdmin({
    studentId,
    orgId,
    courseId,
    status: status ?? undefined,
    accessType: accessType ?? undefined,
    limit,
  });

  const data = rows.map((r) => ({
    id: r.enrollment.id,
    studentId: r.enrollment.studentId,
    studentName: r.studentName,
    studentEmail: r.studentEmail,
    orgName: r.orgName,
    courseTitle: r.liveTitle ?? r.recordTitle,
    courseId: r.enrollment.liveCourseId ?? r.enrollment.recordCourseId,
    courseType: r.enrollment.liveCourseId ? "live" : "record",
    accessType: r.enrollment.accessType,
    status: r.enrollment.status,
    completionPercentage: r.enrollment.completionPercentage,
    liveClassesAttended: r.enrollment.liveClassesAttended,
    recordedModulesWatched: r.enrollment.recordedModulesWatched,
    enrolledAt: r.enrollment.enrolledAt,
    lastAccessedAt: r.enrollment.lastAccessedAt,
  }));

  return NextResponse.json({ data });
}
