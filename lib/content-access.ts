import { db } from "@/lib/db";
import {
  studentCourses,
  liveCourses,
  recordCourses,
  courseRecordings,
  liveClasses,
  classRecordings,
} from "@/lib/db/schema";
import { eq, and, isNotNull, isNull, asc, desc, or, inArray, sql } from "drizzle-orm";
import {
  liveRecordingDisplayTitle,
  liveRecordingSlotsFromRow,
} from "@/lib/live-recording-slots";
import { withLiveRecordingSlotColumns } from "@/lib/live-recording-query";

export type AccessEnrollment = {
  isActive?: boolean | null;
  status?: string | null;
  liveAccess?: boolean | null;
  recordedAccess?: boolean | null;
  liveAccessFrom?: Date | string | null;
  liveAccessUntil?: Date | string | null;
  recordedAccessFrom?: Date | string | null;
  recordedAccessUntil?: Date | string | null;
};

function inAccessWindow(
  from: Date | string | null | undefined,
  until: Date | string | null | undefined,
  now: Date
) {
  if (from && new Date(from).getTime() > now.getTime()) return false;
  if (until && new Date(until).getTime() <= now.getTime()) return false;
  return true;
}

function enrollmentStillValid(enrollment: AccessEnrollment) {
  const status = enrollment.status ?? null;
  if (status === "revoked" || status === "expired" || status === "paused") return false;
  if (status === "active" || status === "completed") return true;
  return enrollment.isActive !== false;
}

export function hasLiveAccess(enrollment: AccessEnrollment, now = new Date()) {
  if (!enrollmentStillValid(enrollment)) return false;
  if (enrollment.liveAccess === false) return false;
  return inAccessWindow(enrollment.liveAccessFrom, enrollment.liveAccessUntil, now);
}

export function hasRecordedAccess(enrollment: AccessEnrollment, now = new Date()) {
  if (!enrollmentStillValid(enrollment)) return false;
  if (enrollment.recordedAccess === false) return false;
  return inAccessWindow(enrollment.recordedAccessFrom, enrollment.recordedAccessUntil, now);
}

/** Batch class recordings belong to live courses, so live-enrolled students must see them too. */
export function hasClassRecordingAccess(enrollment: AccessEnrollment, now = new Date()) {
  return hasLiveAccess(enrollment, now) || hasRecordedAccess(enrollment, now);
}

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

  const core = {
    id: liveClasses.id,
    title: liveClasses.title,
    scheduledAt: liveClasses.scheduledAt,
    duration: liveClasses.duration,
    meetingLink: liveClasses.meetingLink,
    status: liveClasses.status,
    recordingUrl: liveClasses.recordingUrl,
  };

  return withLiveRecordingSlotColumns(
    () =>
      db
        .select({
          ...core,
          recordingUrlB: liveClasses.recordingUrlB,
          recordingUrlC: liveClasses.recordingUrlC,
        })
        .from(liveClasses)
        .where(and(eq(liveClasses.batchId, batchId), isNull(liveClasses.deletedAt)))
        .orderBy(asc(liveClasses.scheduledAt)),
    async () => {
      const rows = await db
        .select(core)
        .from(liveClasses)
        .where(and(eq(liveClasses.batchId, batchId), isNull(liveClasses.deletedAt)))
        .orderBy(asc(liveClasses.scheduledAt));
      return rows.map((row) => ({ ...row, recordingUrlB: null, recordingUrlC: null }));
    }
  );
}

/** Completed live session recordings for a batch — empty when batchId is null. */
export async function getLiveClassRecordingsForStudent(batchId: string | null) {
  if (!batchId) return [];

  const core = {
    id: liveClasses.id,
    title: liveClasses.title,
    scheduledAt: liveClasses.scheduledAt,
    recordingUrl: liveClasses.recordingUrl,
    duration: liveClasses.duration,
  };

  const rows = await withLiveRecordingSlotColumns(
    () =>
      db
        .select({
          ...core,
          recordingUrlB: liveClasses.recordingUrlB,
          recordingUrlC: liveClasses.recordingUrlC,
        })
        .from(liveClasses)
        .where(
          and(
            eq(liveClasses.batchId, batchId),
            eq(liveClasses.status, "completed"),
            isNull(liveClasses.deletedAt),
            or(
              isNotNull(liveClasses.recordingUrl),
              isNotNull(liveClasses.recordingUrlB),
              isNotNull(liveClasses.recordingUrlC)
            )
          )
        )
        .orderBy(asc(liveClasses.scheduledAt)),
    () =>
      db
        .select(core)
        .from(liveClasses)
        .where(
          and(
            eq(liveClasses.batchId, batchId),
            eq(liveClasses.status, "completed"),
            isNotNull(liveClasses.recordingUrl),
            isNull(liveClasses.deletedAt)
          )
        )
        .orderBy(asc(liveClasses.scheduledAt))
  );

  return rows.flatMap((row) => {
    const slots = liveRecordingSlotsFromRow(row);
    return slots.map((slot) => ({
      id: `${row.id}-${slot.slot}`,
      title: liveRecordingDisplayTitle(row.title, slot.slot, slots.length),
      scheduledAt: row.scheduledAt,
      recordingUrl: slot.url,
      duration: row.duration,
    }));
  });
}

/** Batch class recordings (Recording Classes uploads) for a live-course batch. */
export async function getBatchClassRecordings(courseId: string, batchId: string | null) {
  if (!batchId) return [];

  return db
    .select({
      id: classRecordings.id,
      weekName: classRecordings.weekName,
      topicName: classRecordings.topicName,
      videoUrl: classRecordings.videoUrl,
      createdAt: classRecordings.createdAt,
    })
    .from(classRecordings)
    .where(
      and(
        eq(classRecordings.courseId, courseId),
        eq(classRecordings.batchId, batchId),
        isNull(classRecordings.deletedAt)
      )
    )
    .orderBy(desc(classRecordings.createdAt));
}

export async function getStudentCourseContent(studentId: string, courseId: string) {
  const [liveEnrollment] = await db
    .select({
      batchId: studentCourses.batchId,
      enrollmentSource: studentCourses.enrollmentSource,
      courseTitle: liveCourses.title,
      isActive: studentCourses.isActive,
      status: studentCourses.status,
      liveAccess: studentCourses.liveAccess,
      recordedAccess: studentCourses.recordedAccess,
      liveAccessFrom: studentCourses.liveAccessFrom,
      liveAccessUntil: studentCourses.liveAccessUntil,
      recordedAccessFrom: studentCourses.recordedAccessFrom,
      recordedAccessUntil: studentCourses.recordedAccessUntil,
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
    try {
      await db
        .update(liveClasses)
        .set({ status: "completed" })
        .where(
          and(
            eq(liveClasses.courseId, courseId),
            isNull(liveClasses.deletedAt),
            inArray(liveClasses.status, ["scheduled", "live"]),
            sql`(${liveClasses.scheduledAt} + (COALESCE(${liveClasses.duration}, 60) * INTERVAL '1 minute')) < NOW()`
          )
        );
    } catch (err) {
      console.error("[getStudentCourseContent] auto-complete failed:", err);
    }
    const [liveClassList, liveRecordings, batchClassRecordings] = await Promise.all([
      getLiveClassesForStudent(batchId),
      getLiveClassRecordingsForStudent(batchId),
      getBatchClassRecordings(courseId, batchId),
    ]);
    const batchKeys = new Set(
      batchClassRecordings.map((row) => row.videoUrl.trim()).filter(Boolean)
    );
    const liveClassRecordings = liveRecordings.filter((row) => {
      const key = row.recordingUrl?.trim();
      return !!key && !batchKeys.has(key);
    });
    return {
      courseTitle: liveEnrollment.courseTitle,
      courseType: "live",
      enrollment: {
        batchId: liveEnrollment.batchId,
        enrollmentSource: liveEnrollment.enrollmentSource,
        hasLiveAccess: hasLiveAccess(liveEnrollment) && liveEnrollment.batchId !== null,
        hasClassRecordingAccess:
          hasClassRecordingAccess(liveEnrollment) && liveEnrollment.batchId !== null,
      },
      courseRecordings: [],
      liveClasses: liveClassList,
      liveClassRecordings,
      batchClassRecordings,
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
        hasClassRecordingAccess: false,
      },
      courseRecordings: recordings,
      liveClasses: [],
      liveClassRecordings: [],
      batchClassRecordings: [],
    };
  }

  return null;
}
