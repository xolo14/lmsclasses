import { db } from "@/lib/db";
import { liveCourses, recordCourses } from "@/lib/db/schema";
import { eq, isNull, and, or } from "drizzle-orm";

export function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function ensureUniqueLiveCourseSlug(title: string, excludeId?: string): Promise<string> {
  const base = toSlug(title) || "course";
  let candidate = base;
  let suffix = 2;

  while (true) {
    const conditions = [eq(liveCourses.slug, candidate), isNull(liveCourses.deletedAt)];
    const [existing] = await db
      .select({ id: liveCourses.id })
      .from(liveCourses)
      .where(and(...conditions))
      .limit(1);

    if (!existing || (excludeId && existing.id === excludeId)) {
      return candidate;
    }

    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

export async function ensureUniqueRecordCourseSlug(title: string, excludeId?: string): Promise<string> {
  const base = toSlug(title) || "course";
  let candidate = base;
  let suffix = 2;

  while (true) {
    const conditions = [eq(recordCourses.slug, candidate), isNull(recordCourses.deletedAt)];
    const [existing] = await db
      .select({ id: recordCourses.id })
      .from(recordCourses)
      .where(and(...conditions))
      .limit(1);

    if (!existing || (excludeId && existing.id === excludeId)) {
      return candidate;
    }

    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

/** Assign URL slugs to record courses that were bulk-imported or migrated without one. */
export async function backfillMissingRecordCourseSlugs() {
  const missing = await db
    .select({ id: recordCourses.id, title: recordCourses.title })
    .from(recordCourses)
    .where(
      and(
        isNull(recordCourses.deletedAt),
        or(isNull(recordCourses.slug), eq(recordCourses.slug, ""))
      )
    );

  for (const course of missing) {
    const slug = await ensureUniqueRecordCourseSlug(course.title, course.id);
    await db
      .update(recordCourses)
      .set({ slug, updatedAt: new Date() })
      .where(eq(recordCourses.id, course.id));
  }

  return missing.length;
}
