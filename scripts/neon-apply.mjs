// Apply drizzle/0000_init.sql to Neon over WebSocket (port 443) — used when direct
// TCP (5432) isn't reachable. Usage: DATABASE_URL=... node scripts/neon-apply.mjs
import { readFileSync } from "node:fs";
import { Pool, neonConfig } from "@neondatabase/serverless";

// Node 22 ships a global WebSocket.
neonConfig.webSocketConstructor = WebSocket;

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");

const pool = new Pool({ connectionString: url });
const file = readFileSync("drizzle/0000_init.sql", "utf8");
const statements = file
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);

console.log(`Applying ${statements.length} statements to Neon...`);
let ok = 0;
for (const stmt of statements) {
  try {
    await pool.query(stmt);
    ok++;
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (/already exists|duplicate/i.test(msg)) {
      ok++;
      continue;
    }
    console.error("FAILED:\n", stmt.slice(0, 140), "\n->", msg);
    await pool.end();
    process.exit(1);
  }
}
await pool.end();
console.log(`✓ Applied ${ok}/${statements.length} statements.`);
