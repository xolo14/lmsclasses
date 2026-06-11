import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getStudentEnrollments } from "@/lib/content-access";
import { StudentCourseCard } from "@/components/student/StudentCourseCard";
import { BookOpen } from "lucide-react";

export default async function StudentCoursesPage() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "student") {
    redirect("/login");
  }

  const enrollments = await getStudentEnrollments(session.user.id);
  const mapped = enrollments.map((e) => ({
    enrollmentId: e.enrollmentId,
    courseId: e.courseId,
    courseTitle: e.courseTitle,
    courseSlug: e.courseSlug,
    courseThumbnail: e.courseThumbnail,
    courseDescription: e.courseDescription,
    batchId: e.batchId,
    enrollmentSource: e.enrollmentSource ?? "org_admin",
    hasLiveAccess: e.batchId !== null,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Courses</h1>

      {mapped.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center text-muted-foreground">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted/30">
            <BookOpen className="h-12 w-12 opacity-50" />
          </div>
          <p>You haven&apos;t enrolled in any courses yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mapped.map((enrollment) => (
            <StudentCourseCard key={enrollment.enrollmentId} enrollment={enrollment} />
          ))}
        </div>
      )}
    </div>
  );
}
