import { db } from "@/lib/db";
import { courses } from "@/lib/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { toSlug } from "@/lib/slug";

async function main() {
  const all = await db
    .select({ id: courses.id, title: courses.title, slug: courses.slug })
    .from(courses)
    .where(isNull(courses.deletedAt));

  const used = new Set(
    all.map((c) => c.slug).filter((s): s is string => !!s)
  );

  let updated = 0;
  for (const c of all) {
    if (c.slug) continue;

    let base = toSlug(c.title) || "course";
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(candidate);

    await db.update(courses).set({ slug: candidate }).where(eq(courses.id, c.id));
    updated += 1;
  }

  console.log(`✅ Slugs generated for ${updated} courses (${all.length} total)`);

  const { sql } = await import("drizzle-orm");
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS courses_slug_unique ON courses (slug)
    WHERE slug IS NOT NULL
  `);
  console.log("✅ Unique index on courses.slug ensured");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
