import { db } from "@/lib/db";
import {
  studentCourses,
  liveCourses,
  recordCourses,
  courseRecordings,
  liveClasses,
} from "@/lib/db/schema";
import { eq, and, isNotNull, isNull, asc } from "drizzle-orm";

/**
 * Returns all courses a student is enrolled in, with batchId and enrollmentSource.
 */
export async function getStudentEnrollments(studentId: string) {
  const rows = await db
    .select({
      enrollmentId: studentCourses.id,
      liveCourseId: studentCourses.liveCourseId,
      recordCourseId: studentCourses.recordCourseId,
      batchId: studentCourses.batchId,
      enrollmentSource: studentCourses.enrollmentSource,
      organisationId: studentCourses.organisationId,
      liveTitle: liveCourses.title,
      liveSlug: liveCourses.slug,
      liveThumbnail: liveCourses.thumbnailUrl,
      liveDescription: liveCourses.description,
      liveIsActive: liveCourses.isActive,
      recordTitle: recordCourses.title,
      recordSlug: recordCourses.slug,
      recordThumbnail: recordCourses.thumbnailUrl,
      recordDescription: recordCourses.description,
      recordIsActive: recordCourses.isActive,
    })
    .from(studentCourses)
    .leftJoin(liveCourses, eq(liveCourses.id, studentCourses.liveCourseId))
    .leftJoin(recordCourses, eq(recordCourses.id, studentCourses.recordCourseId))
    .where(
      and(
        eq(studentCourses.studentId, studentId),
        eq(studentCourses.isActive, true)
      )
    );

  return rows
    .filter((row) => {
      if (row.liveCourseId) {
        return row.liveIsActive === true;
      }
      if (row.recordCourseId) {
        return row.recordIsActive === true;
      }
      return false;
    })
    .map((row) => {
      const isLive = !!row.liveCourseId;
      return {
        enrollmentId: row.enrollmentId,
        courseId: (isLive ? row.liveCourseId : row.recordCourseId)!,
        batchId: row.batchId,
        enrollmentSource: row.enrollmentSource,
        organisationId: row.organisationId,
        courseTitle: (isLive ? row.liveTitle : row.recordTitle)!,
        courseSlug: (isLive ? row.liveSlug : row.recordSlug)!,
        courseThumbnail: isLive ? row.liveThumbnail : row.recordThumbnail,
        courseDescription: isLive ? row.liveDescription : row.recordDescription,
        courseType: isLive ? ("live" as const) : ("record" as const),
      };
    });
}

/**
 * Course recordings for a course — any enrolled student may access.
 * Caller must verify enrollment before exposing results to the student.
 * Does not filter by studentId or organisationId — access is recordCourseId + isPublished only.
 */
export async function getCourseRecordings(recordCourseId: string) {
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
    .where(and(eq(courseRecordings.recordCourseId, recordCourseId), eq(courseRecordings.isPublished, true)))
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
  const [liveEnrollment] = await db
    .select({
      batchId: studentCourses.batchId,
      enrollmentSource: studentCourses.enrollmentSource,
      courseTitle: liveCourses.title,
    })
    .from(studentCourses)
    .innerJoin(liveCourses, eq(liveCourses.id, studentCourses.liveCourseId))
    .where(
      and(
        eq(studentCourses.studentId, studentId),
        eq(studentCourses.liveCourseId, courseId),
        eq(studentCourses.isActive, true)
      )
    )
    .limit(1);

  if (liveEnrollment) {
    const batchId = liveEnrollment.batchId ?? null;
    const liveClassList = await getLiveClassesForStudent(batchId);
    const liveRecordings = await getLiveClassRecordingsForStudent(batchId);
    return {
      courseTitle: liveEnrollment.courseTitle,
      courseType: "live",
      enrollment: {
        batchId: liveEnrollment.batchId,
        enrollmentSource: liveEnrollment.enrollmentSource,
        hasLiveAccess: liveEnrollment.batchId !== null,
      },
      courseRecordings: [],
      liveClasses: liveClassList,
      liveClassRecordings: liveRecordings,
    };
  }

  const [recordEnrollment] = await db
    .select({
      enrollmentSource: studentCourses.enrollmentSource,
      courseTitle: recordCourses.title,
    })
    .from(studentCourses)
    .innerJoin(recordCourses, eq(recordCourses.id, studentCourses.recordCourseId))
    .where(
      and(
        eq(studentCourses.studentId, studentId),
        eq(studentCourses.recordCourseId, courseId),
        eq(studentCourses.isActive, true)
      )
    )
    .limit(1);

  if (recordEnrollment) {
    const recordings = await getCourseRecordings(courseId);
    return {
      courseTitle: recordEnrollment.courseTitle,
      courseType: "record",
      enrollment: {
        batchId: null,
        enrollmentSource: recordEnrollment.enrollmentSource,
        hasLiveAccess: false,
      },
      courseRecordings: recordings,
      liveClasses: [],
      liveClassRecordings: [],
    };
  }

  return null;
}
