import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);

class CustomLogger {
  logQuery(query: string, _params: unknown[]) {
    console.log("[DB QUERY]", query.substring(0, 200));
  }
}

/** Default DB client (HTTP) — fast, works everywhere including static generation. */
export const db = drizzle(sql, {
  schema,
  logger: process.env.NODE_ENV === "development" ? new CustomLogger() : false,
});
