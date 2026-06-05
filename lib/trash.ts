import { isNull, isNotNull, lt, and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  organisations,
  users,
  courses,
  batches,
  liveClasses,
  classRecordings,
} from "@/lib/db/schema";

export const TRASH_RETENTION_DAYS = 30;

export type TrashEntityType =
  | "organisation"
  | "course"
  | "batch"
  | "student"
  | "manager"
  | "mentor"
  | "live_class"
  | "class_recording";

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
  await db.delete(courses).where(and(isNotNull(courses.deletedAt), lt(courses.deletedAt, cutoff)));
  await db.delete(organisations).where(and(isNotNull(organisations.deletedAt), lt(organisations.deletedAt, cutoff)));
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
}

export async function clearAllTrash() {
  await db.delete(classRecordings).where(isNotNull(classRecordings.deletedAt));
  await db.delete(liveClasses).where(isNotNull(liveClasses.deletedAt));
  await db.delete(batches).where(isNotNull(batches.deletedAt));
  await db.delete(courses).where(isNotNull(courses.deletedAt));
  await db.delete(organisations).where(isNotNull(organisations.deletedAt));
  await db.delete(users).where(and(isNotNull(users.deletedAt), eq(users.role, "student")));
  await db.delete(users).where(and(isNotNull(users.deletedAt), eq(users.role, "manager")));
  await db.delete(users).where(and(isNotNull(users.deletedAt), eq(users.role, "mentor")));
}

export { isNull as notDeleted };
