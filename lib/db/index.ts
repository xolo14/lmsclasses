import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// PERF: Single connection instance shared across all requests in the same serverless function instance.
const sql = neon(process.env.DATABASE_URL!);

class CustomLogger {
  logQuery(query: string, params: unknown[]) {
    // PERF: Profiling slow query logging
    console.log('[DB QUERY]', query.substring(0, 200));
  }
}

export const db = drizzle(sql, {
  schema,
  logger: process.env.NODE_ENV === "development" ? new CustomLogger() : false,
});
