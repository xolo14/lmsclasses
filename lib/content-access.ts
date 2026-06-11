import { db } from "@/lib/db";
import {
  studentCourses,
  courses,
  courseRecordings,
  liveClasses,
} from "@/lib/db/schema";
import { eq, and, isNotNull, isNull, asc } from "drizzle-orm";

/**
 * Returns all courses a student is enrolled in, with batchId and enrollmentSource.
 */
export async function getStudentEnrollments(studentId: string) {
  return db
    .select({
      enrollmentId: studentCourses.id,
      courseId: studentCourses.courseId,
      batchId: studentCourses.batchId,
      enrollmentSource: studentCourses.enrollmentSource,
      organisationId: studentCourses.organisationId,
      courseTitle: courses.title,
      courseSlug: courses.slug,
      courseThumbnail: courses.thumbnailUrl,
      courseDescription: courses.description,
    })
    .from(studentCourses)
    .innerJoin(courses, eq(courses.id, studentCourses.courseId))
    .where(
      and(
        eq(studentCourses.studentId, studentId),
        eq(studentCourses.isActive, true),
        eq(courses.isActive, true)
      )
    );
}

/**
 * Course recordings for a course — any enrolled student may access.
 * Caller must verify enrollment before exposing results to the student.
 * Does not filter by studentId or organisationId — access is courseId + isPublished only.
 */
export async function getCourseRecordings(courseId: string) {
  return db
    .select({
      id: courseRecordings.id,
      title: courseRecordings.title,
      description: courseRecordings.description,
      videoUrl: courseRecordings.videoUrl,
      duration: courseRecordings.duration,
      sortOrder: courseRecordings.sortOrder,
    })
    .from(courseRecordings)
    .where(and(eq(courseRecordings.courseId, courseId), eq(courseRecordings.isPublished, true)))
    .orderBy(asc(courseRecordings.sortOrder));
}

/**
 * Live classes for a student's batch.
 * EXPECTED: getLiveClassesForStudent(null) → [] (no error, no data leakage).
 */
export async function getLiveClassesForStudent(batchId: string | null) {
  if (!batchId) return [];

  return db
    .select({
      id: liveClasses.id,
      title: liveClasses.title,
      scheduledAt: liveClasses.scheduledAt,
      duration: liveClasses.duration,
      meetingLink: liveClasses.meetingLink,
      status: liveClasses.status,
      recordingUrl: liveClasses.recordingUrl,
    })
    .from(liveClasses)
    .where(and(eq(liveClasses.batchId, batchId), isNull(liveClasses.deletedAt)))
    .orderBy(asc(liveClasses.scheduledAt));
}

/** Completed live session recordings for a batch — empty when batchId is null. */
export async function getLiveClassRecordingsForStudent(batchId: string | null) {
  if (!batchId) return [];

  return db
    .select({
      id: liveClasses.id,
      title: liveClasses.title,
      scheduledAt: liveClasses.scheduledAt,
      recordingUrl: liveClasses.recordingUrl,
      duration: liveClasses.duration,
    })
    .from(liveClasses)
    .where(
      and(
        eq(liveClasses.batchId, batchId),
        eq(liveClasses.status, "completed"),
        isNotNull(liveClasses.recordingUrl),
        isNull(liveClasses.deletedAt)
      )
    )
    .orderBy(asc(liveClasses.scheduledAt));
}

export async function getStudentCourseContent(studentId: string, courseId: string) {
  const [enrollment] = await db
    .select({
      batchId: studentCourses.batchId,
      enrollmentSource: studentCourses.enrollmentSource,
    })
    .from(studentCourses)
    .where(
      and(
        eq(studentCourses.studentId, studentId),
        eq(studentCourses.courseId, courseId),
        eq(studentCourses.isActive, true)
      )
    )
    .limit(1);

  if (!enrollment) return null;

  const recordings = await getCourseRecordings(courseId);
  const batchId = enrollment.batchId ?? null;
  const liveClassList = await getLiveClassesForStudent(batchId);
  const liveRecordings = await getLiveClassRecordingsForStudent(batchId);

  return {
    enrollment: {
      batchId: enrollment.batchId,
      enrollmentSource: enrollment.enrollmentSource,
      hasLiveAccess: enrollment.batchId !== null,
    },
    courseRecordings: recordings,
    liveClasses: liveClassList,
    liveClassRecordings: liveRecordings,
  };
}
