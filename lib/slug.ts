import { db } from "@/lib/db";
import { liveCourses, recordCourses } from "@/lib/db/schema";
import { eq, isNull, and } from "drizzle-orm";

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
