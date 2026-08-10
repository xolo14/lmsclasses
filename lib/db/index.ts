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
