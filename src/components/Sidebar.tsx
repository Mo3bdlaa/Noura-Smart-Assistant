"use client";

import { useRouter, useParams } from "next/navigation";
import { useState } from "react";

type Conv = { id: string; type: "main" | "side" | "incognito"; title: string | null };

const TYPE_META: Record<Conv["type"], { icon: string; label: string }> = {
  main: { icon: "📌", label: "الرئيسية" },
  side: { icon: "💬", label: "محادثة جانبية" },
  incognito: { icon: "🕶️", label: "تخيّلي" },
};

export function Sidebar(props: {
  assistantName: string;
  isAdmin: boolean;
  conversations: Conv[];
}) {
  const router = useRouter();
  const params = useParams<{ conversationId?: string }>();
  const [convs, setConvs] = useState<Conv[]>(props.conversations);
  const [busy, setBusy] = useState(false);

  async function create(type: "side" | "incognito") {
    setBusy(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (data.conversation) {
        setConvs((c) => [{ id: data.conversation.id, type, title: null }, ...c]);
        router.push(`/chat/${data.conversation.id}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("تمسح المحادثة دي؟")) return;
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    setConvs((c) => c.filter((x) => x.id !== id));
    if (params.conversationId === id) router.push("/chat");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const main = convs.find((c) => c.type === "main");
  const others = convs.filter((c) => c.type !== "main");

  return (
    <aside className="w-72 shrink-0 h-full flex flex-col bg-surface border-l border-border">
      <div className="p-4 border-b border-border">
        <div className="text-lg font-bold text-ink">{props.assistantName}</div>
        <div className="text-xs text-muted">مساعدتك اللي بتفتكر وبتحس</div>
      </div>

      <div className="p-3 flex gap-2">
        <button
          disabled={busy}
          onClick={() => create("side")}
          className="flex-1 text-sm rounded-lg bg-amber/15 text-ink px-3 py-2 hover:bg-amber/25 transition disabled:opacity-50"
        >
          + جانبية
        </button>
        <button
          disabled={busy}
          onClick={() => create("incognito")}
          className="flex-1 text-sm rounded-lg bg-brown/15 text-ink px-3 py-2 hover:bg-brown/25 transition disabled:opacity-50"
        >
          🕶️ تخيّلي
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 space-y-1">
        {main && <ConvItem conv={main} active={params.conversationId === main.id} onOpen={(id) => router.push(`/chat/${id}`)} />}
        {others.map((c) => (
          <ConvItem
            key={c.id}
            conv={c}
            active={params.conversationId === c.id}
            onOpen={(id) => router.push(`/chat/${id}`)}
            onDelete={() => remove(c.id)}
          />
        ))}
      </nav>

      <div className="p-3 border-t border-border space-y-1 text-sm">
        <button onClick={() => router.push("/memories")} className="w-full text-right px-3 py-2 rounded-lg hover:bg-elevated text-ink">
          🧠 الذاكرة
        </button>
        {props.isAdmin && (
          <button onClick={() => router.push("/admin")} className="w-full text-right px-3 py-2 rounded-lg hover:bg-elevated text-ink">
            👑 لوحة الأدمن
          </button>
        )}
        <button onClick={logout} className="w-full text-right px-3 py-2 rounded-lg hover:bg-elevated text-muted">
          خروج
        </button>
      </div>
    </aside>
  );
}

function ConvItem(props: {
  conv: Conv;
  active: boolean;
  onOpen: (id: string) => void;
  onDelete?: () => void;
}) {
  const meta = TYPE_META[props.conv.type];
  return (
    <div
      className={`group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition ${
        props.active ? "bg-amber/20 text-ink" : "hover:bg-elevated text-ink/90"
      }`}
      onClick={() => props.onOpen(props.conv.id)}
    >
      <span>{meta.icon}</span>
      <span className="flex-1 text-sm truncate">{props.conv.title || meta.label}</span>
      {props.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            props.onDelete?.();
          }}
          className="opacity-0 group-hover:opacity-100 text-muted hover:text-ink text-xs"
          aria-label="حذف"
        >
          ✕
        </button>
      )}
    </div>
  );
}
