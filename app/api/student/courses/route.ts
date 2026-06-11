import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getStudentEnrollments } from "@/lib/content-access";

export async function GET() {
  const { error, session } = await requireAuth(["student"]);
  if (error) return error;

  const enrollments = await getStudentEnrollments(session!.user.id);

  return NextResponse.json(
    enrollments.map((e) => ({
      enrollmentId: e.enrollmentId,
      courseId: e.courseId,
      courseTitle: e.courseTitle,
      courseSlug: e.courseSlug,
      courseThumbnail: e.courseThumbnail,
      courseDescription: e.courseDescription,
      batchId: e.batchId,
      enrollmentSource: e.enrollmentSource,
      hasLiveAccess: e.batchId !== null,
    }))
  );
}
