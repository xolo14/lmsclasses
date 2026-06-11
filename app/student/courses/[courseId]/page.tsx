import { redirect, notFound } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getStudentCourseContent } from "@/lib/content-access";
import { StudentCourseDetail } from "@/components/student/StudentCourseDetail";

const courseIdSchema = z.string().uuid();

export default async function StudentCourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "student") {
    redirect("/login");
  }

  const { courseId } = await params;
  const parsed = courseIdSchema.safeParse(courseId);
  if (!parsed.success) {
    notFound();
  }

  const content = await getStudentCourseContent(session.user.id, parsed.data);
  if (!content) {
    redirect("/student/courses?error=not-enrolled");
  }

  const { courseTitle, courseType, ...courseContent } = content;

  return (
    <StudentCourseDetail
      courseTitle={courseTitle}
      courseType={courseType}
      content={JSON.parse(JSON.stringify(courseContent))}
    />
  );
}
