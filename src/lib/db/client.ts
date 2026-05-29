import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Single shared postgres.js connection + Drizzle instance.
 * Reused across hot-reloads in dev to avoid exhausting connections.
 */
const globalForDb = globalThis as unknown as {
  __nouraSql?: ReturnType<typeof postgres>;
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Local dev needs no SSL; managed Postgres (e.g. Neon) requires it. Detect by host.
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);

const client =
  globalForDb.__nouraSql ??
  postgres(connectionString, {
    max: 10,
    prepare: false, // works with transaction-pooled connections (pgbouncer / Neon pooler)
    ssl: isLocal ? false : "require",
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__nouraSql = client;
}

export const db = drizzle(client, { schema });
export { client as sql };
export type Db = typeof db;
