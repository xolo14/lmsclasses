import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Db = NeonHttpDatabase<typeof schema>;

class CustomLogger {
  logQuery(query: string, _params: unknown[]) {
    console.log("[DB QUERY]", query.substring(0, 200));
  }
}

async function runIgnored(task: () => Promise<unknown>) {
  try {
    await task();
  } catch (err) {
    console.warn("[db-migrate]", err instanceof Error ? err.message : err);
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
  // Auto-migrate: each step is independent so one missing column cannot abort the rest.
  void (async () => {
    await runIgnored(() => sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES live_courses(id);`);
    await runIgnored(() => sql`CREATE INDEX IF NOT EXISTS users_course_id_idx ON users(course_id);`);
    await runIgnored(
      () => sql`CREATE TABLE IF NOT EXISTS mentor_courses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        mentor_id UUID NOT NULL REFERENCES users(id),
        course_id UUID NOT NULL REFERENCES live_courses(id),
        created_at TIMESTAMP DEFAULT NOW()
      )`
    );
    await runIgnored(() => sql`CREATE UNIQUE INDEX IF NOT EXISTS mentor_courses_mentor_course_uidx ON mentor_courses(mentor_id, course_id)`);
    await runIgnored(() => sql`CREATE INDEX IF NOT EXISTS mentor_courses_mentor_id_idx ON mentor_courses(mentor_id)`);
    await runIgnored(
      () => sql`INSERT INTO mentor_courses (mentor_id, course_id)
        SELECT id, course_id FROM users
        WHERE role = 'mentor' AND course_id IS NOT NULL
        ON CONFLICT DO NOTHING`
    );

    await runIgnored(() => sql`ALTER TABLE live_classes ADD COLUMN IF NOT EXISTS host_user_id UUID REFERENCES users(id)`);
    await runIgnored(() => sql`ALTER TABLE live_classes ADD COLUMN IF NOT EXISTS google_organizer_email TEXT`);
    await runIgnored(() => sql`ALTER TABLE live_classes ADD COLUMN IF NOT EXISTS google_event_id TEXT`);
    await runIgnored(() => sql`ALTER TABLE live_classes ADD COLUMN IF NOT EXISTS google_calendar_id TEXT DEFAULT 'primary'`);
    await runIgnored(() => sql`ALTER TABLE live_classes ADD COLUMN IF NOT EXISTS calendar_html_link TEXT`);
    await runIgnored(() => sql`ALTER TABLE live_classes ADD COLUMN IF NOT EXISTS meet_status TEXT NOT NULL DEFAULT 'not_requested'`);
    await runIgnored(() => sql`ALTER TABLE live_classes ADD COLUMN IF NOT EXISTS meet_error TEXT`);
    await runIgnored(() => sql`ALTER TABLE live_classes ADD COLUMN IF NOT EXISTS google_synced_at TIMESTAMPTZ`);
    await runIgnored(() => sql`ALTER TABLE live_classes ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0`);
    await runIgnored(() => sql`ALTER TABLE live_classes ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ`);
    await runIgnored(() => sql`ALTER TABLE live_classes ADD COLUMN IF NOT EXISTS google_request_version INTEGER NOT NULL DEFAULT 1`);
    await runIgnored(
      () => sql`UPDATE live_classes
        SET meet_status = 'manual'
        WHERE meet_status = 'not_requested'
          AND meeting_link IS NOT NULL
          AND btrim(meeting_link) <> ''`
    );

    await runIgnored(
      () => sql`CREATE TABLE IF NOT EXISTS google_connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        google_email TEXT NOT NULL,
        google_sub TEXT NOT NULL,
        refresh_token_enc TEXT NOT NULL,
        access_token_enc TEXT,
        access_token_expires_at TIMESTAMPTZ,
        scopes TEXT[] NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        last_error TEXT,
        is_platform_account BOOLEAN NOT NULL DEFAULT false,
        connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_used_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    );
    await runIgnored(() => sql`ALTER TABLE google_connections ADD COLUMN IF NOT EXISTS is_platform_account BOOLEAN NOT NULL DEFAULT false`);
    await runIgnored(() => sql`ALTER TABLE google_connections DROP CONSTRAINT IF EXISTS google_connections_user_id_unique`);
    await runIgnored(() => sql`ALTER TABLE google_connections DROP CONSTRAINT IF EXISTS google_connections_user_id_key`);
    await runIgnored(() => sql`DROP INDEX IF EXISTS google_connections_user_id_unique`);
    await runIgnored(() => sql`DROP INDEX IF EXISTS google_connections_user_id_key`);
    await runIgnored(
      () => sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_gconn_user_personal
        ON google_connections (user_id) WHERE is_platform_account = false`
    );
    await runIgnored(
      () => sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_gconn_one_platform
        ON google_connections (is_platform_account) WHERE is_platform_account = true`
    );
  })();

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
