import { isNull, isNotNull, lt, and, eq, or, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  organisations,
  users,
  liveCourses,
  recordCourses,
  batches,
  liveClasses,
  classRecordings,
  coupons,
  studentCourses,
  liveClassAttendance,
  slots,
  payments,
  issuedCertificates,
  certificateTemplates,
  apiKeys,
  courseRecordings,
} from "@/lib/db/schema";
import { hardDeleteOrganisations, hardDeleteUsers } from "@/lib/organisation-cascade";

export const TRASH_RETENTION_DAYS = 30;

export type TrashEntityType =
  | "organisation"
  | "live_course"
  | "record_course"
  | "batch"
  | "student"
  | "manager"
  | "mentor"
  | "live_class"
  | "class_recording"
  | "coupon";

export function trashCutoffDate(): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - TRASH_RETENTION_DAYS);
  return cutoff;
}

/** Remove FK dependents so trashed batches can be hard-deleted. */
async function hardDeleteBatches(batchIds: string[]) {
  if (batchIds.length === 0) return;

  // Templates may reference batch_id
  await db
    .update(certificateTemplates)
    .set({ batchId: null, updatedAt: new Date() })
    .where(inArray(certificateTemplates.batchId, batchIds));

  const classRows = await db
    .select({ id: liveClasses.id })
    .from(liveClasses)
    .where(inArray(liveClasses.batchId, batchIds));
  const classIds = classRows.map((r) => r.id);

  if (classIds.length > 0) {
    await db.delete(liveClassAttendance).where(inArray(liveClassAttendance.liveClassId, classIds));
  }

  await db.delete(classRecordings).where(inArray(classRecordings.batchId, batchIds));
  await db.delete(liveClasses).where(inArray(liveClasses.batchId, batchIds));
  // Keep batchEndDate eligibility stable: freeze by leaving a snapshot is hard;
  // clear batchId but auto-issue ignores soft-deleted batch end dates already.
  await db
    .update(studentCourses)
    .set({ batchId: null })
    .where(inArray(studentCourses.batchId, batchIds));
  await db.delete(batches).where(inArray(batches.id, batchIds));
}

async function hardDeleteLiveClasses(classIds: string[]) {
  if (classIds.length === 0) return;
  await db.delete(liveClassAttendance).where(inArray(liveClassAttendance.liveClassId, classIds));
  await db.delete(liveClasses).where(inArray(liveClasses.id, classIds));
}

async function hardDeleteLiveCourses(courseIds: string[]) {
  if (courseIds.length === 0) return;

  // Certs before enrollments (enrollment_id FK)
  await db.delete(issuedCertificates).where(inArray(issuedCertificates.courseId, courseIds));
  await db.delete(certificateTemplates).where(inArray(certificateTemplates.courseId, courseIds));

  const courseBatches = await db
    .select({ id: batches.id })
    .from(batches)
    .where(inArray(batches.courseId, courseIds));
  await hardDeleteBatches(courseBatches.map((b) => b.id));

  const classRows = await db
    .select({ id: liveClasses.id })
    .from(liveClasses)
    .where(inArray(liveClasses.courseId, courseIds));
  await hardDeleteLiveClasses(classRows.map((r) => r.id));

  await db.delete(classRecordings).where(inArray(classRecordings.courseId, courseIds));
  await db.delete(liveClassAttendance).where(inArray(liveClassAttendance.liveCourseId, courseIds));
  await db.delete(studentCourses).where(inArray(studentCourses.liveCourseId, courseIds));
  await db.delete(slots).where(inArray(slots.courseId, courseIds));
  await db.update(payments).set({ liveCourseId: null }).where(inArray(payments.liveCourseId, courseIds));

  await db.delete(liveCourses).where(inArray(liveCourses.id, courseIds));
}

async function hardDeleteRecordCourses(courseIds: string[]) {
  if (courseIds.length === 0) return;

  await db.delete(issuedCertificates).where(inArray(issuedCertificates.courseId, courseIds));
  await db.delete(certificateTemplates).where(inArray(certificateTemplates.courseId, courseIds));

  await db.delete(courseRecordings).where(inArray(courseRecordings.recordCourseId, courseIds));
  await db.delete(studentCourses).where(inArray(studentCourses.recordCourseId, courseIds));
  await db.delete(slots).where(inArray(slots.recordCourseId, courseIds));
  await db
    .update(payments)
    .set({ recordCourseId: null })
    .where(inArray(payments.recordCourseId, courseIds));
  await db.update(apiKeys).set({ courseId: null }).where(inArray(apiKeys.courseId, courseIds));

  await db.delete(recordCourses).where(inArray(recordCourses.id, courseIds));
}

async function hardDeleteTrashedUsers() {
  const trashed = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        isNotNull(users.deletedAt),
        or(
          eq(users.role, "student"),
          eq(users.role, "manager"),
          eq(users.role, "mentor"),
          eq(users.role, "org_admin")
        )
      )
    );
  await hardDeleteUsers(trashed.map((u) => u.id));
}

async function hardDeleteExpiredUsers(cutoff: Date) {
  const trashed = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        isNotNull(users.deletedAt),
        lt(users.deletedAt, cutoff),
        or(
          eq(users.role, "student"),
          eq(users.role, "manager"),
          eq(users.role, "mentor"),
          eq(users.role, "org_admin")
        )
      )
    );
  await hardDeleteUsers(trashed.map((u) => u.id));
}

/** Permanently remove items that have been in trash longer than retention period. */
export async function purgeExpiredTrash() {
  const cutoff = trashCutoffDate();

  const expiredOrgs = await db
    .select({ id: organisations.id })
    .from(organisations)
    .where(and(isNotNull(organisations.deletedAt), lt(organisations.deletedAt, cutoff)));
  await hardDeleteOrganisations(expiredOrgs.map((o) => o.id));

  const expiredRecordings = await db
    .select({ id: classRecordings.id })
    .from(classRecordings)
    .where(and(isNotNull(classRecordings.deletedAt), lt(classRecordings.deletedAt, cutoff)));
  if (expiredRecordings.length > 0) {
    await db
      .delete(classRecordings)
      .where(inArray(classRecordings.id, expiredRecordings.map((r) => r.id)));
  }

  const expiredClasses = await db
    .select({ id: liveClasses.id })
    .from(liveClasses)
    .where(and(isNotNull(liveClasses.deletedAt), lt(liveClasses.deletedAt, cutoff)));
  await hardDeleteLiveClasses(expiredClasses.map((r) => r.id));

  const expiredBatches = await db
    .select({ id: batches.id })
    .from(batches)
    .where(and(isNotNull(batches.deletedAt), lt(batches.deletedAt, cutoff)));
  await hardDeleteBatches(expiredBatches.map((r) => r.id));

  const expiredLiveCourses = await db
    .select({ id: liveCourses.id })
    .from(liveCourses)
    .where(and(isNotNull(liveCourses.deletedAt), lt(liveCourses.deletedAt, cutoff)));
  await hardDeleteLiveCourses(expiredLiveCourses.map((c) => c.id));

  const expiredRecordCourses = await db
    .select({ id: recordCourses.id })
    .from(recordCourses)
    .where(and(isNotNull(recordCourses.deletedAt), lt(recordCourses.deletedAt, cutoff)));
  await hardDeleteRecordCourses(expiredRecordCourses.map((c) => c.id));

  await db.delete(coupons).where(and(isNotNull(coupons.deletedAt), lt(coupons.deletedAt, cutoff)));
  await hardDeleteExpiredUsers(cutoff);
}

export async function clearAllTrashImmediate() {
  const trashedOrgs = await db
    .select({ id: organisations.id })
    .from(organisations)
    .where(isNotNull(organisations.deletedAt));
  await hardDeleteOrganisations(trashedOrgs.map((o) => o.id));

  await db.delete(classRecordings).where(isNotNull(classRecordings.deletedAt));

  const trashedClasses = await db
    .select({ id: liveClasses.id })
    .from(liveClasses)
    .where(isNotNull(liveClasses.deletedAt));
  await hardDeleteLiveClasses(trashedClasses.map((r) => r.id));

  const trashedBatches = await db
    .select({ id: batches.id })
    .from(batches)
    .where(isNotNull(batches.deletedAt));
  await hardDeleteBatches(trashedBatches.map((r) => r.id));

  const trashedLiveCourses = await db
    .select({ id: liveCourses.id })
    .from(liveCourses)
    .where(isNotNull(liveCourses.deletedAt));
  await hardDeleteLiveCourses(trashedLiveCourses.map((c) => c.id));

  const trashedRecordCourses = await db
    .select({ id: recordCourses.id })
    .from(recordCourses)
    .where(isNotNull(recordCourses.deletedAt));
  await hardDeleteRecordCourses(trashedRecordCourses.map((c) => c.id));

  await db.delete(coupons).where(isNotNull(coupons.deletedAt));
  await hardDeleteTrashedUsers();
}

export { isNull as notDeleted };
