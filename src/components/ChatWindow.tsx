"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Msg = { id: string; role: "user" | "assistant"; content: string };
type Props = {
  conversationId: string;
  conversationType: "main" | "side" | "incognito";
  initialMessages: Msg[];
};

const TYPE_BANNER: Record<Props["conversationType"], string | null> = {
  main: null,
  side: "محادثة جانبية — بتتسجّل في ذاكرتها العامة.",
  incognito: "🕶️ وضع تخيّلي — اللي هنا مش هتفتكره بعد ما تمسحه.",
};

export function ChatWindow({ conversationId, conversationType, initialMessages }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  // Reset when switching conversations.
  useEffect(() => {
    setMessages(initialMessages);
  }, [conversationId, initialMessages]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    const userMsg: Msg = { id: `tmp-${Date.now()}`, role: "user", content: text };
    const draftId = `draft-${Date.now()}`;
    setMessages((m) => [...m, userMsg, { id: draftId, role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "خطأ");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => m.map((x) => (x.id === draftId ? { ...x, content: acc } : x)));
      }
      // refresh server state (memories/mood/theme will reflect on next load)
      router.refresh();
    } catch (e) {
      setMessages((m) =>
        m.map((x) =>
          x.id === draftId ? { ...x, content: `(${(e as Error).message})` } : x,
        ),
      );
    } finally {
      setStreaming(false);
    }
  }

  async function deleteMessage(id: string) {
    if (id.startsWith("tmp-") || id.startsWith("draft-")) return;
    if (!confirm("تمسح الرسالة دي؟ نورا هتنساها.")) return;
    await fetch(`/api/messages/${id}`, { method: "DELETE" });
    setMessages((m) => m.filter((x) => x.id !== id));
    router.refresh();
  }

  const banner = TYPE_BANNER[conversationType];

  return (
    <div className="flex flex-col h-full">
      {banner && (
        <div className="text-center text-xs text-muted py-2 bg-elevated/60 border-b border-border">
          {banner}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted mt-20">اكتب حاجة وابدأ الكلام 👋</div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} msg={m} onDelete={() => deleteMessage(m.id)} />
        ))}
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="اكتب لنورا..."
            className="flex-1 resize-none rounded-2xl bg-surface border border-border px-4 py-3 text-ink outline-none focus:border-amber max-h-40"
          />
          <button
            onClick={send}
            disabled={streaming || !input.trim()}
            className="rounded-2xl bg-amber text-bg font-bold px-5 py-3 disabled:opacity-40 transition"
          >
            ابعت
          </button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ msg, onDelete }: { msg: Msg; onDelete: () => void }) {
  const isUser = msg.role === "user";
  // multi-bubble realism: split on blank lines
  const parts = msg.content.split(/\n{2,}/).filter(Boolean);
  return (
    <div className={`group flex ${isUser ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[80%] space-y-2 ${isUser ? "order-2" : ""}`}>
        {(parts.length ? parts : [""]).map((p, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 leading-relaxed ${
              isUser
                ? "bg-elevated text-ink rounded-tr-md"
                : "bg-amber/20 text-ink rounded-tl-md"
            }`}
          >
            {p || "…"}
          </div>
        ))}
      </div>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 self-center mx-2 text-xs text-muted hover:text-ink transition"
        aria-label="حذف"
      >
        ✕
      </button>
    </div>
  );
}
