import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://noura:noura@localhost:5432/noura",
  },
  // pgvector + pgcrypto extensions are created by our migration bootstrap.
  verbose: true,
  strict: true,
});
