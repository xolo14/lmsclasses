import { neon } from "@neondatabase/serverless";
import { loadEnvLocal } from "../lib/load-env";

loadEnvLocal();

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  await sql`
    DO $$ BEGIN
      CREATE TYPE course_type AS ENUM ('live', 'record');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `;

  await sql`
    ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS course_type course_type NOT NULL DEFAULT 'live';
  `;

  await sql`
    ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS duration text;
  `;

  console.log("✅ course_type and duration columns ready on courses");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
