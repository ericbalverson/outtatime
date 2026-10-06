import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

export const PGLITE_DIR = ".pglite";

function createDb(): DB {
  const url = process.env.DATABASE_URL;
  if (url) {
    const pool = new Pool({ connectionString: url, max: 5 });
    return drizzlePg(pool, { schema });
  }
  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL is not set. Connect a Postgres database (e.g. Neon) in Vercel.");
  }
  // Local development: embedded Postgres stored on disk. During `next build` several
  // workers load this module at once and can't share the directory, so use memory.
  const building = process.env.NEXT_PHASE === "phase-production-build";
  const client = building ? new PGlite() : new PGlite(PGLITE_DIR);
  return drizzlePglite(client, { schema }) as unknown as DB;
}

// Reuse a single connection across hot reloads in development.
const g = globalThis as unknown as { __outtatimeDb?: DB };
export const db: DB = g.__outtatimeDb ?? (g.__outtatimeDb = createDb());
