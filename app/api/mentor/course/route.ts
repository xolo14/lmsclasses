import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { liveCourses, batches, classRecordings, studentCourses } from "@/lib/db/schema";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getMentorCourseIds } from "@/lib/mentor-courses";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error, session } = await requireAuth(["mentor"]);
  if (error) return error;

  const courseIds = await getMentorCourseIds(session!.user.id);
  if (!courseIds.length) {
    return NextResponse.json({ course: null, courses: [] });
  }

  const courseRows = await db
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
    .where(and(inArray(liveCourses.id, courseIds), isNull(liveCourses.deletedAt)));

  const ordered = courseIds
    .map((id) => courseRows.find((row) => row.id === id))
    .filter((row): row is NonNullable<typeof row> => !!row);

  if (!ordered.length) {
    return NextResponse.json({ course: null, courses: [] });
  }

  const [batchCounts, recordingCounts, studentCounts] = await Promise.all([
    db
      .select({ courseId: batches.courseId, count: sql<number>`count(*)::int` })
      .from(batches)
      .where(and(inArray(batches.courseId, courseIds), isNull(batches.deletedAt)))
      .groupBy(batches.courseId),
    db
      .select({ courseId: classRecordings.courseId, count: sql<number>`count(*)::int` })
      .from(classRecordings)
      .where(and(inArray(classRecordings.courseId, courseIds), isNull(classRecordings.deletedAt)))
      .groupBy(classRecordings.courseId),
    db
      .select({ courseId: studentCourses.liveCourseId, count: sql<number>`count(*)::int` })
      .from(studentCourses)
      .where(and(inArray(studentCourses.liveCourseId, courseIds), eq(studentCourses.isActive, true)))
      .groupBy(studentCourses.liveCourseId),
  ]);

  const batchMap = new Map(batchCounts.map((row) => [row.courseId, row.count]));
  const recordingMap = new Map(recordingCounts.map((row) => [row.courseId, row.count]));
  const studentMap = new Map(studentCounts.map((row) => [row.courseId, row.count]));

  const courses = ordered.map((course) => ({
    ...course,
    batchCount: batchMap.get(course.id) ?? 0,
    recordingCount: recordingMap.get(course.id) ?? 0,
    studentCount: studentMap.get(course.id) ?? 0,
  }));

  return NextResponse.json({
    course: courses[0],
    courses,
  });
}
