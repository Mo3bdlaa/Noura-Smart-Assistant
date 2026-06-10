import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { secretaryItems } from "@/lib/db/schema";
import type { TenantContext } from "@/lib/db/tenant";

export type ItemKind = "todo" | "note";
export type Item = { id: string; kind: ItemKind; content: string; done: boolean; createdAt: string };

export async function addItem(ctx: TenantContext, kind: ItemKind, content: string) {
  const text = content.trim().slice(0, 400);
  if (!text) return null;
  const [row] = await db
    .insert(secretaryItems)
    .values({ userId: ctx.userId, assistantId: ctx.assistantId, kind, content: text })
    .returning({
      id: secretaryItems.id,
      kind: secretaryItems.kind,
      content: secretaryItems.content,
      done: secretaryItems.done,
      createdAt: secretaryItems.createdAt,
    });
  return row;
}

export async function listItems(ctx: TenantContext): Promise<{ todos: Item[]; notes: Item[] }> {
  const rows = await db
    .select({
      id: secretaryItems.id,
      kind: secretaryItems.kind,
      content: secretaryItems.content,
      done: secretaryItems.done,
      createdAt: secretaryItems.createdAt,
    })
    .from(secretaryItems)
    .where(eq(secretaryItems.assistantId, ctx.assistantId))
    .orderBy(desc(secretaryItems.createdAt))
    .limit(200);
  const map = (r: (typeof rows)[number]): Item => ({
    id: r.id,
    kind: r.kind,
    content: r.content,
    done: r.done,
    createdAt: r.createdAt as unknown as string,
  });
  return {
    todos: rows.filter((r) => r.kind === "todo").map(map),
    notes: rows.filter((r) => r.kind === "note").map(map),
  };
}

/** Open to-dos + recent notes, as short text for the prompt context. */
export async function secretaryContext(assistantId: string): Promise<string | null> {
  const rows = await db
    .select({ kind: secretaryItems.kind, content: secretaryItems.content, done: secretaryItems.done })
    .from(secretaryItems)
    .where(eq(secretaryItems.assistantId, assistantId))
    .orderBy(desc(secretaryItems.createdAt))
    .limit(60);
  const todos = rows.filter((r) => r.kind === "todo" && !r.done).slice(0, 20);
  const notes = rows.filter((r) => r.kind === "note").slice(0, 15);
  if (todos.length === 0 && notes.length === 0) return null;
  const parts: string[] = [];
  if (todos.length) parts.push("مهام مفتوحة عليه:\n" + todos.map((t) => `- ${t.content}`).join("\n"));
  if (notes.length) parts.push("نوتس محفوظة ليه:\n" + notes.map((n) => `- ${n.content}`).join("\n"));
  return parts.join("\n");
}

export async function toggleDone(ctx: TenantContext, id: string) {
  const [row] = await db
    .select({ done: secretaryItems.done })
    .from(secretaryItems)
    .where(and(eq(secretaryItems.id, id), eq(secretaryItems.userId, ctx.userId)))
    .limit(1);
  if (!row) return;
  const next = !row.done;
  await db
    .update(secretaryItems)
    .set({ done: next, doneAt: next ? new Date() : null })
    .where(and(eq(secretaryItems.id, id), eq(secretaryItems.userId, ctx.userId)));
}

export async function deleteItem(ctx: TenantContext, id: string) {
  await db
    .delete(secretaryItems)
    .where(and(eq(secretaryItems.id, id), eq(secretaryItems.userId, ctx.userId)));
}

/** Mark the most recent open to-do matching a phrase as done (from her <done:…> tag). */
export async function markDoneByText(ctx: TenantContext, phrase: string) {
  const p = phrase.replace(/[%_]/g, " ").trim().slice(0, 60);
  if (p.length < 2) return;
  const [row] = await db
    .select({ id: secretaryItems.id })
    .from(secretaryItems)
    .where(
      and(
        eq(secretaryItems.assistantId, ctx.assistantId),
        eq(secretaryItems.kind, "todo"),
        eq(secretaryItems.done, false),
        sql`${secretaryItems.content} ILIKE ${"%" + p + "%"}`,
      ),
    )
    .orderBy(desc(secretaryItems.createdAt))
    .limit(1);
  if (row) {
    await db
      .update(secretaryItems)
      .set({ done: true, doneAt: new Date() })
      .where(eq(secretaryItems.id, row.id));
  }
}

/** Strip + extract her secretary capture tags: <todo:…> <note:…> <done:…>. */
export const SECRETARY_TAG_RE = /<\s*(todo|note|done)\s*:\s*([^>]{1,200}?)\s*>/gi;
export function parseSecretaryTags(text: string): {
  todos: string[];
  notes: string[];
  dones: string[];
} {
  const todos: string[] = [];
  const notes: string[] = [];
  const dones: string[] = [];
  for (const m of text.matchAll(SECRETARY_TAG_RE)) {
    const kind = m[1]!.toLowerCase();
    const content = (m[2] ?? "").trim();
    if (!content) continue;
    if (kind === "todo") todos.push(content);
    else if (kind === "note") notes.push(content);
    else dones.push(content);
  }
  return { todos, notes, dones };
}
