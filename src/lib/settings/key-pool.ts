import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { AuthError, requireAdmin } from "@/lib/auth/guard";
import { getSetting, setSetting } from "@/lib/settings";

/**
 * Reusable admin key-pool endpoint (GET/POST/DELETE) — the same card-based
 * management the LLM keys use, for any pool (ElevenLabs voice keys, image-gen
 * tokens, …). Keys are stored newline-joined in `pool`, shown masked, deletable by
 * a stable id; env-provided keys are listed locked. Full keys never leave the server.
 */
export type KeyPoolConfig = {
  pool: string; // setting key holding the newline-joined pool
  singles?: string[]; // other single-value settings each holding one key
  envVars?: string[]; // env var names (may be comma/newline lists), shown locked
};

const idFor = (k: string) => createHash("sha256").update(k).digest("hex").slice(0, 16);

function mask(key: string): string {
  const k = key.trim();
  if (k.length <= 8) return `${k.slice(0, 2)}••••`;
  return `${k.slice(0, 4)}••••••${k.slice(-4)}`;
}

function split(s?: string | null): string[] {
  return (s ?? "")
    .split(/[\n,]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

type KeyView = { id: string; masked: string; editable: boolean; source: string };

export function keyPoolHandlers(cfg: KeyPoolConfig) {
  async function readSingles(): Promise<string[]> {
    const out: string[] = [];
    for (const s of cfg.singles ?? []) out.push(((await getSetting(s)) ?? "").trim());
    return out.filter(Boolean);
  }

  async function present(): Promise<KeyView[]> {
    const pool = split(await getSetting(cfg.pool));
    const singles = await readSingles();
    const env = (cfg.envVars ?? []).flatMap((v) => split(process.env[v])).filter(Boolean);
    const seen = new Set<string>();
    const out: KeyView[] = [];
    const add = (key: string, editable: boolean, source: string) => {
      const k = key.trim();
      if (!k || seen.has(k)) return;
      seen.add(k);
      out.push({ id: idFor(k), masked: mask(k), editable, source });
    };
    for (const k of pool) add(k, true, "pool");
    for (const k of singles) add(k, true, "single");
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

  const AddBody = z.object({ key: z.string().trim().min(6).max(400) });
  const DelBody = z.object({ id: z.string().trim().min(4).max(64) });

  return {
    GET: async () => {
      const denied = await guard();
      if (denied) return denied;
      return NextResponse.json({ keys: await present() });
    },
    POST: async (req: Request) => {
      const denied = await guard();
      if (denied) return denied;
      const parsed = AddBody.safeParse(await req.json().catch(() => null));
      if (!parsed.success) return NextResponse.json({ error: "مفتاح غير صالح" }, { status: 400 });
      const key = parsed.data.key.trim();
      const pool = split(await getSetting(cfg.pool));
      if (pool.includes(key)) return NextResponse.json({ error: "duplicate", keys: await present() }, { status: 409 });
      pool.push(key);
      await setSetting(cfg.pool, pool.join("\n"));
      return NextResponse.json({ keys: await present() });
    },
    DELETE: async (req: Request) => {
      const denied = await guard();
      if (denied) return denied;
      const parsed = DelBody.safeParse(await req.json().catch(() => null));
      if (!parsed.success) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });
      const id = parsed.data.id;
      const pool = split(await getSetting(cfg.pool));
      const newPool = pool.filter((k) => idFor(k) !== id);
      if (newPool.length !== pool.length) await setSetting(cfg.pool, newPool.join("\n"));
      for (const sk of cfg.singles ?? []) {
        const v = ((await getSetting(sk)) ?? "").trim();
        if (v && idFor(v) === id) await setSetting(sk, "");
      }
      return NextResponse.json({ keys: await present() });
    },
  };
}
