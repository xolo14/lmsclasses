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
