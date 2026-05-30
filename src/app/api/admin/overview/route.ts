import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { AuthError, requireAdmin } from "@/lib/auth/guard";
import { db } from "@/lib/db/client";

/** Admin-only: every user with usage stats, mood, and their personality read. */
export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }

  const rows = await db.execute(sql`
    select
      u.id, u.email, u.display_name as "displayName", u.role, u.created_at as "createdAt",
      u.locale, u.timezone,
      a.id as "assistantId", a.name as "assistantName",
      m.happiness, m.annoyance,
      (select count(*) from messages msg join conversations c on msg.conversation_id = c.id
         where c.user_id = u.id and msg.role = 'user')::int as "userMessages",
      (select count(*) from memories mem where mem.user_id = u.id)::int as "memoryCount",
      (select max(msg.created_at) from messages msg join conversations c on msg.conversation_id = c.id
         where c.user_id = u.id) as "lastActive",
      pp.summary as "profileSummary",
      pp.report as "profileReport"
    from users u
    left join assistants a on a.user_id = u.id
    left join mood_state m on m.assistant_id = a.id
    left join personality_profiles pp on pp.assistant_id = a.id
    order by "lastActive" desc nulls last
  `);

  // drizzle/postgres-js returns an array-like of rows
  const users = Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows ?? [];
  return NextResponse.json({ users });
}
