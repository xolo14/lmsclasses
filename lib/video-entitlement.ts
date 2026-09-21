import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  batches,
  classRecordings,
  courseRecordings,
  liveClasses,
  studentCourses,
  users,
} from "@/lib/db/schema";
import { orgAdminVisibleBatches } from "@/lib/batch-scope";
import { hasLiveAccess, hasRecordedAccess } from "@/lib/content-access";
import { parseGcsObjectKey } from "@/lib/gcs";
import { isPublicCourseDemoReference } from "@/lib/public-demo-access";
import type { Session } from "next-auth";

function keysMatch(stored: string | null | undefined, requested: string) {
  if (!stored) return false;
  const a = stored.trim();
  const b = requested.trim();
  if (!a || !b) return false;
  if (a === b) return true;
  const keyA = parseGcsObjectKey(a);
  const keyB = parseGcsObjectKey(b);
  if (keyA && keyB && keyA === keyB) return true;
  if (keyA && keyA === b) return true;
  if (keyB && keyB === a) return true;
  return false;
}

/**
 * Whether this session may receive a signed read URL for `videoKey`.
 * super_admin/manager: yes. hr: no. Everyone else must own the recording.
 */
export async function assertVideoEntitlement(
  session: Session | null,
  videoKey: string
): Promise<boolean> {
  if (await isPublicCourseDemoReference(videoKey)) return true;
  if (!session?.user) return false;

  const role = session.user.role;
  if (role === "super_admin" || role === "manager") return true;
  if (role === "hr") return false;

  const requested = videoKey.trim();

  if (role === "mentor") {
    const [mentor] = await db
      .select({ courseId: users.courseId })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    const courseId = mentor?.courseId ?? session.user.courseId;
    if (!courseId) return false;

    const [classRecs, liveRecs, courseRecs] = await Promise.all([
      db
        .select({ videoUrl: classRecordings.videoUrl })
        .from(classRecordings)
        .where(and(eq(classRecordings.courseId, courseId), isNull(classRecordings.deletedAt))),
      db
        .select({ recordingUrl: liveClasses.recordingUrl })
        .from(liveClasses)
        .where(and(eq(liveClasses.courseId, courseId), isNull(liveClasses.deletedAt))),
      db
        .select({ videoUrl: courseRecordings.videoUrl })
        .from(courseRecordings)
        .where(eq(courseRecordings.recordCourseId, courseId)),
    ]);
    return (
      classRecs.some((r) => keysMatch(r.videoUrl, requested)) ||
      liveRecs.some((r) => keysMatch(r.recordingUrl, requested)) ||
      courseRecs.some((r) => keysMatch(r.videoUrl, requested))
    );
  }

  if (role === "student") {
    const enrollments = await db
      .select()
      .from(studentCourses)
      .where(eq(studentCourses.studentId, session.user.id));

    const recorded = enrollments.filter((e) => hasRecordedAccess(e));
    const liveWatch = enrollments.filter((e) => hasLiveAccess(e) || hasRecordedAccess(e));
    const batchIds = recorded.map((e) => e.batchId).filter((id): id is string => !!id);
    const recordCourseIds = recorded
      .map((e) => e.recordCourseId)
      .filter((id): id is string => !!id);
    const liveCourseIds = recorded
      .map((e) => e.liveCourseId)
      .filter((id): id is string => !!id);
    const liveWatchCourseIds = liveWatch
      .map((e) => e.liveCourseId)
      .filter((id): id is string => !!id);

    const checks: Promise<{ videoUrl?: string | null; recordingUrl?: string | null }[]>[] = [];
    if (batchIds.length) {
      checks.push(
        db
          .select({ videoUrl: classRecordings.videoUrl })
          .from(classRecordings)
          .where(
            and(
              isNull(classRecordings.deletedAt),
              or(
                ...batchIds.map((id) => eq(classRecordings.batchId, id)),
                ...liveCourseIds.map((id) => eq(classRecordings.courseId, id))
              )!
            )
          )
      );
    }
    if (recordCourseIds.length) {
      checks.push(
        db
          .select({ videoUrl: courseRecordings.videoUrl })
          .from(courseRecordings)
          .where(or(...recordCourseIds.map((id) => eq(courseRecordings.recordCourseId, id)))!)
      );
    }
    if (liveWatchCourseIds.length) {
      checks.push(
        db
          .select({ recordingUrl: liveClasses.recordingUrl })
          .from(liveClasses)
          .where(
            and(
              isNull(liveClasses.deletedAt),
              or(...liveWatchCourseIds.map((id) => eq(liveClasses.courseId, id)))!
            )
          )
      );
    }
    const rows = (await Promise.all(checks)).flat();
    return rows.some((r) => keysMatch(r.videoUrl ?? r.recordingUrl, requested));
  }

  if (role === "org_admin") {
    const orgId = session.user.organisationId;
    if (!orgId) return false;
    const recs = await db
      .select({ videoUrl: classRecordings.videoUrl })
      .from(classRecordings)
      .innerJoin(batches, eq(classRecordings.batchId, batches.id))
      .where(and(isNull(classRecordings.deletedAt), orgAdminVisibleBatches(orgId)));
    return recs.some((r) => keysMatch(r.videoUrl, requested));
  }

  return false;
}
