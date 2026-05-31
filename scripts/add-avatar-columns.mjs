// Add assistants.avatar_url + assistants.appearance to Neon over WebSocket (443).
// Idempotent. Usage: DATABASE_URL=... node scripts/add-avatar-columns.mjs
import { Pool, neonConfig } from "@neondatabase/serverless";

// Node 22 ships a global WebSocket.
neonConfig.webSocketConstructor = WebSocket;

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");

const pool = new Pool({ connectionString: url });
const stmts = [
  "alter table assistants add column if not exists avatar_url text",
  "alter table assistants add column if not exists appearance text",
];

for (const s of stmts) {
  await pool.query(s);
  console.log("✓", s);
}
await pool.end();
console.log("✓ avatar_url + appearance ensured on assistants.");
