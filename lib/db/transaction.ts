import "server-only";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { NeonQueryResultHKT } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

type Tx = PgTransaction<
  NeonQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

let txDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getTransactionDb() {
  if (!txDb) {
    neonConfig.webSocketConstructor = ws;
    const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
    txDb = drizzle(pool, { schema });
  }
  return txDb;
}

/** Run queries in a real Postgres transaction (Neon WebSocket driver). */
export async function runTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getTransactionDb().transaction(fn);
}
