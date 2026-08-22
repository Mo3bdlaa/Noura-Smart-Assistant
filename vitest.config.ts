import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Some pure modules import the db client transitively, which refuses to load
    // without a connection string. Tests never connect — this only satisfies the
    // module-load guard.
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      SESSION_SECRET: "test-secret-not-used-at-least-32-characters-long",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
