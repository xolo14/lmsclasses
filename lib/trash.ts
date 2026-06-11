import { isNull, isNotNull, lt, and, eq, or } from "drizzle-orm";
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
} from "@/lib/db/schema";

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

/** Permanently remove items that have been in trash longer than retention period. */
export async function purgeExpiredTrash() {
  const cutoff = trashCutoffDate();

  await db.delete(classRecordings).where(and(isNotNull(classRecordings.deletedAt), lt(classRecordings.deletedAt, cutoff)));
  await db.delete(liveClasses).where(and(isNotNull(liveClasses.deletedAt), lt(liveClasses.deletedAt, cutoff)));
  await db.delete(batches).where(and(isNotNull(batches.deletedAt), lt(batches.deletedAt, cutoff)));
  await db.delete(liveCourses).where(and(isNotNull(liveCourses.deletedAt), lt(liveCourses.deletedAt, cutoff)));
  await db.delete(recordCourses).where(and(isNotNull(recordCourses.deletedAt), lt(recordCourses.deletedAt, cutoff)));
  await db.delete(organisations).where(and(isNotNull(organisations.deletedAt), lt(organisations.deletedAt, cutoff)));
  await db.delete(coupons).where(and(isNotNull(coupons.deletedAt), lt(coupons.deletedAt, cutoff)));
  await db
    .delete(users)
    .where(
      and(
        isNotNull(users.deletedAt),
        lt(users.deletedAt, cutoff),
        eq(users.role, "student")
      )
    );
  await db
    .delete(users)
    .where(
      and(
        isNotNull(users.deletedAt),
        lt(users.deletedAt, cutoff),
        eq(users.role, "manager")
      )
    );
  await db
    .delete(users)
    .where(
      and(
        isNotNull(users.deletedAt),
        lt(users.deletedAt, cutoff),
        eq(users.role, "mentor")
      )
    );
  await db
    .delete(users)
    .where(
      and(
        isNotNull(users.deletedAt),
        lt(users.deletedAt, cutoff),
        eq(users.role, "org_admin")
      )
    );
}

export async function clearAllTrashImmediate() {
  await db.delete(classRecordings).where(isNotNull(classRecordings.deletedAt));
  await db.delete(liveClasses).where(isNotNull(liveClasses.deletedAt));
  await db.delete(batches).where(isNotNull(batches.deletedAt));
  await db.delete(liveCourses).where(isNotNull(liveCourses.deletedAt));
  await db.delete(recordCourses).where(isNotNull(recordCourses.deletedAt));
  await db.delete(organisations).where(isNotNull(organisations.deletedAt));
  await db.delete(coupons).where(isNotNull(coupons.deletedAt));
  await db
    .delete(users)
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
}

export { isNull as notDeleted };
