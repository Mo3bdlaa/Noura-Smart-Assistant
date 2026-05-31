// Timeline + dreams schema: mood_snapshots table, assistants.last_seen_at,
// and the "dream" initiative kind (kind is a free text column, no enum change needed in PG).
// Idempotent. Usage: DATABASE_URL=... node scripts/add-timeline-dreams.mjs
import { Pool, neonConfig } from "@neondatabase/serverless";

// Node 22 ships a global WebSocket.
neonConfig.webSocketConstructor = WebSocket;

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");

const pool = new Pool({ connectionString: url });
const stmts = [
  `create table if not exists mood_snapshots (
     id uuid primary key default gen_random_uuid(),
     assistant_id uuid not null references assistants(id) on delete cascade,
     happiness real not null,
     affection real not null,
     annoyance real not null,
     energy real not null,
     captured_at timestamptz not null default now()
   )`,
  `create index if not exists mood_snapshots_time_idx on mood_snapshots (assistant_id, captured_at)`,
  `alter table assistants add column if not exists last_seen_at timestamptz`,
];

for (const s of stmts) {
  await pool.query(s);
  console.log("✓", s.split("\n")[0].trim());
}
await pool.end();
console.log("✓ timeline + dreams schema ensured.");
