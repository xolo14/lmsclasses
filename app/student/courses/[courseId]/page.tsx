import { redirect, notFound } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { courses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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

  const [course] = await db
    .select({ title: courses.title })
    .from(courses)
    .where(eq(courses.id, parsed.data))
    .limit(1);

  return (
    <StudentCourseDetail
      courseTitle={course?.title ?? "Course"}
      content={JSON.parse(JSON.stringify(content))}
    />
  );
}
