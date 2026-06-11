import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

async function main() {
  await db.execute(sql`
    ALTER TABLE student_courses
    ADD COLUMN IF NOT EXISTS enrollment_source text NOT NULL DEFAULT 'org_admin'
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS course_recordings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title text NOT NULL,
      description text,
      video_url text NOT NULL,
      duration_minutes integer,
      sort_order integer NOT NULL DEFAULT 0,
      is_published boolean NOT NULL DEFAULT false,
      created_by uuid NOT NULL REFERENCES users(id),
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);

  console.log("✅ content access schema migration complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
