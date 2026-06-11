import { db } from "@/lib/db";
import { liveCourses, recordCourses } from "@/lib/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { toSlug } from "@/lib/slug";

async function main() {
  const allLive = await db
    .select({ id: liveCourses.id, title: liveCourses.title, slug: liveCourses.slug })
    .from(liveCourses)
    .where(isNull(liveCourses.deletedAt));

  const allRecord = await db
    .select({ id: recordCourses.id, title: recordCourses.title, slug: recordCourses.slug })
    .from(recordCourses)
    .where(isNull(recordCourses.deletedAt));

  const used = new Set([
    ...allLive.map((c) => c.slug).filter((s): s is string => !!s),
    ...allRecord.map((c) => c.slug).filter((s): s is string => !!s),
  ]);

  let updated = 0;
  for (const c of allLive) {
    if (c.slug) continue;
    let base = toSlug(c.title) || "course";
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(candidate);
    await db.update(liveCourses).set({ slug: candidate }).where(eq(liveCourses.id, c.id));
    updated += 1;
  }

  for (const c of allRecord) {
    if (c.slug) continue;
    let base = toSlug(c.title) || "course";
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(candidate);
    await db.update(recordCourses).set({ slug: candidate }).where(eq(recordCourses.id, c.id));
    updated += 1;
  }

  console.log(`✅ Slugs generated for ${updated} courses`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
