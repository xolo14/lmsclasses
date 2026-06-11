import { db } from "@/lib/db";
import { courses } from "@/lib/db/schema";
import { eq, isNull, and } from "drizzle-orm";

export function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function ensureUniqueCourseSlug(title: string, excludeId?: string): Promise<string> {
  const base = toSlug(title) || "course";
  let candidate = base;
  let suffix = 2;

  while (true) {
    const conditions = [eq(courses.slug, candidate), isNull(courses.deletedAt)];
    const [existing] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(and(...conditions))
      .limit(1);

    if (!existing || (excludeId && existing.id === excludeId)) {
      return candidate;
    }

    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}
