import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Db = NeonHttpDatabase<typeof schema>;

class CustomLogger {
  logQuery(query: string, _params: unknown[]) {
    console.log("[DB QUERY]", query.substring(0, 200));
  }
}

function createDb(): Db {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it in Hostinger hPanel → Environment variables, then redeploy."
    );
  }
  const sql = neon(url);
  // Auto-migrate: ensure users.course_id column exists
  sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES live_courses(id);`
    .then(() => sql`CREATE INDEX IF NOT EXISTS users_course_id_idx ON users(course_id);`)
    .then(
      () => sql`CREATE TABLE IF NOT EXISTS mentor_courses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        mentor_id UUID NOT NULL REFERENCES users(id),
        course_id UUID NOT NULL REFERENCES live_courses(id),
        created_at TIMESTAMP DEFAULT NOW()
      )`
    )
    .then(() => sql`CREATE UNIQUE INDEX IF NOT EXISTS mentor_courses_mentor_course_uidx ON mentor_courses(mentor_id, course_id)`)
    .then(() => sql`CREATE INDEX IF NOT EXISTS mentor_courses_mentor_id_idx ON mentor_courses(mentor_id)`)
    .then(
      () => sql`INSERT INTO mentor_courses (mentor_id, course_id)
        SELECT id, course_id FROM users
        WHERE role = 'mentor' AND course_id IS NOT NULL
        ON CONFLICT DO NOTHING`
    )
    // Google Calendar/Meet: classes that already carry a hand-pasted link are "manual".
    // Runs only after `npm run db:push` created meet_status; errors are ignored until then.
    .then(
      () => sql`UPDATE live_classes
        SET meet_status = 'manual'
        WHERE meet_status = 'not_requested'
          AND meeting_link IS NOT NULL
          AND btrim(meeting_link) <> ''`
    )
    .then(() => sql`ALTER TABLE live_classes ADD COLUMN IF NOT EXISTS google_organizer_email TEXT`)
    .then(() => sql`ALTER TABLE google_connections ADD COLUMN IF NOT EXISTS is_platform_account BOOLEAN NOT NULL DEFAULT false`)
    .then(() => sql`ALTER TABLE google_connections DROP CONSTRAINT IF EXISTS google_connections_user_id_unique`)
    .then(() => sql`ALTER TABLE google_connections DROP CONSTRAINT IF EXISTS google_connections_user_id_key`)
    .then(() => sql`DROP INDEX IF EXISTS google_connections_user_id_unique`)
    .then(() => sql`DROP INDEX IF EXISTS google_connections_user_id_key`)
    .then(
      () => sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_gconn_user_personal
        ON google_connections (user_id) WHERE is_platform_account = false`
    )
    .then(
      () => sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_gconn_one_platform
        ON google_connections (is_platform_account) WHERE is_platform_account = true`
    )
    .catch(() => {});

  return drizzle(sql, {
    schema,
    logger: process.env.NODE_ENV === "development" ? new CustomLogger() : false,
  });
}

let cached: Db | undefined;

function getDb(): Db {
  if (!cached) cached = createDb();
  return cached;
}

/**
 * Lazy DB client — Hostinger hbuild collects route data without runtime env,
 * so neon() must not run at module import time.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const instance = getDb() as unknown as Record<PropertyKey, unknown>;
    const value = instance[prop];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
