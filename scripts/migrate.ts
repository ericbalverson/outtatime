import "dotenv/config";
import { config } from "dotenv";

config({ path: ".env.local", override: true });

async function main() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const pool = new Pool({ connectionString: url });
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
    await pool.end();
    console.log("Migrations applied (Postgres).");
  } else {
    if (process.env.VERCEL) throw new Error("DATABASE_URL is not set.");
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const client = new PGlite(".pglite");
    await migrate(drizzle(client), { migrationsFolder: "drizzle" });
    await client.close();
    console.log("Migrations applied (local PGlite in ./.pglite).");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
