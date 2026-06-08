import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { AuthError, requireAdmin } from "@/lib/auth/guard";
import { getSetting, setSetting } from "@/lib/settings";
import { splitKeys } from "@/lib/llm/keys";

/**
 * Individual management of the global LLM key pool (admin only).
 *
 * The old UI was a single write-only textarea: keys never loaded back, and saving
 * empty meant "keep" — so a bad key that spammed 401/400s was unremovable. This
 * endpoint lets the UI list keys (masked), add one, or delete one by a stable id.
 *
 * Keys are still stored in the same `llm_api_keys` setting (newline-joined), so the
 * rest of the app (getApiKeys / rotation) is unchanged. Full keys are NEVER sent
 * back to the client — only a masked preview + a non-reversible id (hash prefix).
 */
const SETTING = "llm_api_keys";

const idFor = (key: string) => createHash("sha256").update(key).digest("hex").slice(0, 16);

function mask(key: string): string {
  const k = key.trim();
  if (k.length <= 8) return `${k.slice(0, 2)}••••`;
  return `${k.slice(0, 4)}••••••${k.slice(-4)}`;
}

async function readKeys(): Promise<string[]> {
  return splitKeys(await getSetting(SETTING));
}

function present(keys: string[]) {
  return keys.map((k) => ({ id: idFor(k), masked: mask(k), length: k.length }));
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
  return NextResponse.json({ keys: present(await readKeys()) });
}

const AddBody = z.object({ key: z.string().trim().min(8).max(400) });

export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;

  const parsed = AddBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "مفتاح غير صالح" }, { status: 400 });
  }
  const key = parsed.data.key.trim();

  const keys = await readKeys();
  if (keys.includes(key)) {
    return NextResponse.json({ error: "duplicate", keys: present(keys) }, { status: 409 });
  }
  keys.push(key);
  await setSetting(SETTING, keys.join("\n"));
  return NextResponse.json({ keys: present(keys) });
}

const DelBody = z.object({ id: z.string().trim().min(4).max(64) });

export async function DELETE(req: Request) {
  const denied = await guard();
  if (denied) return denied;

  const parsed = DelBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

  const keys = await readKeys();
  const next = keys.filter((k) => idFor(k) !== parsed.data.id);
  await setSetting(SETTING, next.join("\n"));
  return NextResponse.json({ keys: present(next) });
}
