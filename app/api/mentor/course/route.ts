import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { users, liveCourses, batches, classRecordings, studentCourses } from "@/lib/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error, session } = await requireAuth(["mentor"]);
  if (error) return error;

  let mentor;
  try {
    const [row] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        courseId: users.courseId,
      })
      .from(users)
      .where(eq(users.id, session!.user.id))
      .limit(1);
    mentor = row;
  } catch {
    return NextResponse.json({ course: null });
  }

  if (!mentor || !mentor.courseId) {
    return NextResponse.json({ course: null });
  }

  const [course] = await db
    .select({
      id: liveCourses.id,
      title: liveCourses.title,
      slug: liveCourses.slug,
      description: liveCourses.description,
      thumbnailUrl: liveCourses.thumbnailUrl,
      level: liveCourses.level,
      language: liveCourses.language,
      totalHours: liveCourses.totalHours,
      totalLiveHours: liveCourses.totalLiveHours,
      createdAt: liveCourses.createdAt,
    })
    .from(liveCourses)
    .where(and(eq(liveCourses.id, mentor.courseId), isNull(liveCourses.deletedAt)))
    .limit(1);

  if (!course) {
    return NextResponse.json({ course: null });
  }

  const [batchCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(batches)
    .where(and(eq(batches.courseId, course.id), isNull(batches.deletedAt)));

  const [recordingCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(classRecordings)
    .where(and(eq(classRecordings.courseId, course.id), isNull(classRecordings.deletedAt)));

  const [studentCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(studentCourses)
    .where(and(eq(studentCourses.liveCourseId, course.id), eq(studentCourses.isActive, true)));

  return NextResponse.json({
    course: {
      ...course,
      batchCount: batchCountRow?.count ?? 0,
      recordingCount: recordingCountRow?.count ?? 0,
      studentCount: studentCountRow?.count ?? 0,
    },
  });
}
