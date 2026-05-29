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

const client =
  globalForDb.__nouraSql ??
  postgres(connectionString, {
    max: 10,
    prepare: false, // friendlier to poolers if we move off a direct connection later
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__nouraSql = client;
}

export const db = drizzle(client, { schema });
export { client as sql };
export type Db = typeof db;
