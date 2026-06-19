import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getStudentEnrollmentsRich } from "@/lib/enrollment-service";

export async function GET() {
  const { error, session } = await requireAuth(["student"]);
  if (error) return error;

  const enrollments = await getStudentEnrollmentsRich(session!.user.id);

  return NextResponse.json({
    data: enrollments.map((e) => ({
      enrollmentId: e.id,
      courseId: e.courseId,
      courseTitle: e.courseTitle,
      courseSlug: e.courseSlug,
      courseThumbnail: e.courseThumbnail,
      courseType: e.courseType,
      accessType: e.accessType,
      liveAccess: e.liveAccess,
      recordedAccess: e.recordedAccess,
      batchId: e.batchId,
      status: e.status,
      completionPercentage: e.completionPercentage,
      liveClassesAttended: e.liveClassesAttended,
      recordedModulesWatched: e.recordedModulesWatched,
      totalModules: e.totalModules,
      certificate: e.certificate,
      nextLiveClassAt: e.nextLiveClassAt,
      hasLiveAccess: e.liveAccess && !!e.batchId,
    })),
  });
}
