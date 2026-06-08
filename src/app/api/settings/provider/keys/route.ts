import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { AuthError, requireAdmin } from "@/lib/auth/guard";
import { getSetting, setSetting } from "@/lib/settings";
import { splitKeys } from "@/lib/llm/keys";

/**
 * Individual management of every editable LLM key (admin only).
 *
 * Keys can live in several places — the pool (`llm_api_keys`), a single
 * (`llm_api_key`), the first-run setup key (`gemini_api_key`), and env vars. The
 * old textarea only touched the pool, so a key added during setup couldn't be
 * removed and kept getting used. This endpoint lists ALL of them (masked) and can
 * delete any DB-stored one by a stable id. Env keys are shown locked (remove from
 * the host's env). Full keys are never returned to the client.
 */
const POOL = "llm_api_keys";

const idFor = (key: string) => createHash("sha256").update(key).digest("hex").slice(0, 16);

function mask(key: string): string {
  const k = key.trim();
  if (k.length <= 8) return `${k.slice(0, 2)}••••`;
  return `${k.slice(0, 4)}••••••${k.slice(-4)}`;
}

type KeyView = { id: string; masked: string; editable: boolean; source: string };

async function dbSources() {
  return {
    pool: splitKeys(await getSetting(POOL)),
    single: ((await getSetting("llm_api_key")) ?? "").trim(),
    gemini: ((await getSetting("gemini_api_key")) ?? "").trim(),
  };
}

async function present(): Promise<KeyView[]> {
  const { pool, single, gemini } = await dbSources();
  const env = [
    ...splitKeys(process.env.LLM_API_KEYS),
    (process.env.LLM_API_KEY ?? "").trim(),
    (process.env.GEMINI_API_KEY ?? "").trim(),
  ].filter(Boolean);

  // editable (DB) keys first, then env (locked). Dedupe by key string.
  const seen = new Set<string>();
  const out: KeyView[] = [];
  const add = (key: string, editable: boolean, source: string) => {
    const k = key.trim();
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push({ id: idFor(k), masked: mask(k), editable, source });
  };
  for (const k of pool) add(k, true, "pool");
  if (single) add(single, true, "single");
  if (gemini) add(gemini, true, "setup");
  for (const k of env) add(k, false, "env");
  return out;
}

async function guard(): Promise<NextResponse | null> {
  try {
    await requireAdmin();
    return null;
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  return NextResponse.json({ keys: await present() });
}

const AddBody = z.object({ key: z.string().trim().min(8).max(400) });

export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;

  const parsed = AddBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "مفتاح غير صالح" }, { status: 400 });
  const key = parsed.data.key.trim();

  const { pool } = await dbSources();
  if (pool.includes(key)) {
    return NextResponse.json({ error: "duplicate", keys: await present() }, { status: 409 });
  }
  pool.push(key);
  await setSetting(POOL, pool.join("\n"));
  return NextResponse.json({ keys: await present() });
}

const DelBody = z.object({ id: z.string().trim().min(4).max(64) });

export async function DELETE(req: Request) {
  const denied = await guard();
  if (denied) return denied;

  const parsed = DelBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });
  const id = parsed.data.id;

  const { pool, single, gemini } = await dbSources();
  // Remove the matching key from EVERY editable source it appears in.
  const newPool = pool.filter((k) => idFor(k) !== id);
  if (newPool.length !== pool.length) await setSetting(POOL, newPool.join("\n"));
  if (single && idFor(single) === id) await setSetting("llm_api_key", "");
  if (gemini && idFor(gemini) === id) await setSetting("gemini_api_key", "");

  return NextResponse.json({ keys: await present() });
}
