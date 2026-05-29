"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Mem = { id: string; type: string; content: string; importance: number; createdAt: string };

const TYPE_AR: Record<string, string> = {
  profile: "معلومة",
  preference: "تفضيل",
  topic: "موضوع",
  moment: "لحظة",
  person: "شخص",
  emotional: "مشاعر",
};

export default function MemoriesPage() {
  const [mems, setMems] = useState<Mem[]>([]);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/memories");
    const data = await res.json();
    setMems(data.memories ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function del(id: string) {
    await fetch(`/api/memories/${id}`, { method: "DELETE" });
    setMems((m) => m.filter((x) => x.id !== id));
  }

  async function forget() {
    if (!topic.trim()) return;
    const res = await fetch("/api/memories/forget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
    });
    const data = await res.json();
    alert(`نسيت ${data.forgotten ?? 0} حاجة عن "${topic}".`);
    setTopic("");
    load();
  }

  return (
    <div className="min-h-screen max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ink">🧠 اللي نورا فاكراه عنك</h1>
        <Link href="/chat" className="text-sm text-accent">← رجوع</Link>
      </div>

      <div className="flex gap-2 mb-6">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="انسي كل حاجة عن... (موضوع)"
          className="flex-1 rounded-xl bg-surface border border-border px-4 py-2 text-ink outline-none focus:border-amber"
        />
        <button onClick={forget} className="rounded-xl bg-brown/20 text-ink px-4 py-2">انسي</button>
      </div>

      {loading ? (
        <p className="text-muted">بحمّل...</p>
      ) : mems.length === 0 ? (
        <p className="text-muted">لسه مفيش ذكريات.</p>
      ) : (
        <ul className="space-y-2">
          {mems.map((m) => (
            <li key={m.id} className="group flex items-start gap-3 bg-surface border border-border rounded-xl px-4 py-3">
              <span className="text-xs bg-amber/20 text-ink rounded-full px-2 py-0.5 mt-0.5">{TYPE_AR[m.type] ?? m.type}</span>
              <span className="flex-1 text-ink text-sm">{m.content}</span>
              <button onClick={() => del(m.id)} className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-600 text-xs">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
